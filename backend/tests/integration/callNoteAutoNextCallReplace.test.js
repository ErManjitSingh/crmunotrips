const request = require('supertest');
const mongoose = require('mongoose');
const db = require('../setup/db');

/**
 * POST /api/leads/:id/call-notes — each saved call schedules an automatic "+2 hrs" call reminder.
 * The next call must complete the earlier automatic reminder (outcome 'auto_replaced') so the lead's
 * nextFollowUp moves to the new one, while follow-ups the executive scheduled by hand stay pending.
 */

let app;
let User;
let Lead;
let FollowUp;
let UserSession;
let leadStatusConfigService;
let generateToken;

beforeAll(async () => {
  await db.connect();
  app = require('../../src/server');
  User = require('../../src/models/User');
  Lead = require('../../src/models/Lead');
  FollowUp = require('../../src/models/FollowUp');
  UserSession = require('../../src/models/UserSession');
  leadStatusConfigService = require('../../src/services/leadStatusConfigService');
  ({ generateToken } = require('../../src/middleware/auth'));
});

afterEach(async () => {
  await db.clearCollections();
  leadStatusConfigService.invalidateCache();
});

afterAll(async () => {
  await db.disconnect();
});

let counter = 0;

async function makeExecutiveWithLead() {
  counter += 1;
  const user = await User.create({
    name: `Exec ${counter}`,
    email: `autonext${counter}@example.com`,
    password: 'password123',
    role: 'sales_executive',
  });
  const session = await UserSession.create({
    userId: user._id,
    sessionId: new mongoose.Types.ObjectId().toString(),
    role: 'sales_executive',
    status: 'active',
    loginAt: new Date(),
    lastActivityAt: new Date(),
  });
  const lead = await Lead.create({
    name: `Lead ${counter}`,
    phone: `8${String(1000000000 + counter).slice(0, 9)}`,
    destination: 'Goa',
    status: 'new',
    createdBy: user._id,
    assignedTo: user._id,
  });
  return { user, lead, token: generateToken(user._id, 'sales_executive', session.sessionId) };
}

function postCall(token, leadId, startedAt, overrides = {}) {
  const start = new Date(startedAt);
  return request(app)
    .post(`/api/leads/${leadId}/call-notes`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      category: 'warm',
      outcome: 'discussed_package',
      notes: 'wants Goa in December',
      startedAt: start.toISOString(),
      endedAt: new Date(start.getTime() + 60_000).toISOString(),
      scheduleNextCall: true,
      ...overrides,
    });
}

const pendingOf = (leadId) => FollowUp.find({ lead: leadId, status: 'pending' }).lean();

describe('automatic "+2 hrs" call reminder on the 2nd call', () => {
  test('the 2nd call completes the 1st automatic reminder and moves nextFollowUp', async () => {
    const { lead, token } = await makeExecutiveWithLead();

    const first = await postCall(token, lead._id, '2026-10-15T10:00:00.000Z', {
      category: 'cold', outcome: 'budget_issues', notes: '',
    });
    expect(first.status).toBe(201);
    const [firstReminder] = await pendingOf(lead._id);
    expect(firstReminder.autoNextCall).toBe(true);
    expect(firstReminder.notes).toMatch(/^Cold — .*\. Auto next call \(2 hrs\) after call — /);

    // Make the 1st reminder clearly earlier so a stale nextFollowUp would be detectable.
    await FollowUp.updateOne({ _id: firstReminder._id }, { $set: { scheduledAt: new Date(Date.now() - 60 * 60 * 1000) } });

    const second = await postCall(token, lead._id, '2026-10-15T15:00:00.000Z');
    expect(second.status).toBe(201);

    const pending = await pendingOf(lead._id);
    expect(pending).toHaveLength(1);
    expect(String(pending[0]._id)).not.toBe(String(firstReminder._id));
    expect(pending[0].autoNextCall).toBe(true);

    const replaced = await FollowUp.findById(firstReminder._id).lean();
    expect(replaced.status).toBe('completed');
    expect(replaced.outcome).toBe('auto_replaced');
    expect(replaced.completedAt).toBeTruthy();

    const saved = await Lead.findById(lead._id).lean();
    expect(new Date(saved.nextFollowUp).getTime()).toBe(new Date(pending[0].scheduledAt).getTime());
  });

  test('a 3rd call still leaves exactly one pending automatic reminder', async () => {
    const { lead, token } = await makeExecutiveWithLead();
    await postCall(token, lead._id, '2026-10-15T10:00:00.000Z');
    await postCall(token, lead._id, '2026-10-15T11:00:00.000Z', { category: 'hot', outcome: 'ready_to_book' });
    await postCall(token, lead._id, '2026-10-15T12:00:00.000Z', { category: 'cold', outcome: 'budget_issues' });

    expect(await pendingOf(lead._id)).toHaveLength(1);
    expect(await FollowUp.countDocuments({ lead: lead._id, outcome: 'auto_replaced' })).toBe(2);
  });

  test('a reminder saved before the autoNextCall flag (matched by notes) is also completed', async () => {
    const { user, lead, token } = await makeExecutiveWithLead();
    const legacy = await FollowUp.create({
      lead: lead._id,
      type: 'call',
      category: 'cold',
      scheduledAt: new Date(Date.now() - 30 * 60 * 1000),
      notes: 'Cold — Just enquiry. Auto next call (2 hrs) after call — just enquiry',
      createdBy: user._id,
      assignedTo: user._id,
    });
    await FollowUp.collection.updateOne({ _id: legacy._id }, { $unset: { autoNextCall: '' } });

    await postCall(token, lead._id, '2026-10-15T15:00:00.000Z');

    expect((await FollowUp.findById(legacy._id).lean()).status).toBe('completed');
    expect(await pendingOf(lead._id)).toHaveLength(1);
  });

  test('a follow-up the executive scheduled by hand stays pending', async () => {
    const { user, lead, token } = await makeExecutiveWithLead();
    const manualAt = new Date(Date.now() + 30 * 60 * 1000);
    const manual = await FollowUp.create({
      lead: lead._id,
      type: 'call',
      category: 'warm',
      scheduledAt: manualAt,
      notes: 'Warm — Discussed package. Call back with the hotel options',
      createdBy: user._id,
      assignedTo: user._id,
    });

    await postCall(token, lead._id, '2026-10-15T10:00:00.000Z');
    await postCall(token, lead._id, '2026-10-15T11:00:00.000Z');

    expect((await FollowUp.findById(manual._id).lean()).status).toBe('pending');
    expect(await pendingOf(lead._id)).toHaveLength(2);
    const saved = await Lead.findById(lead._id).lean();
    expect(new Date(saved.nextFollowUp).getTime()).toBe(manualAt.getTime());
  });

  test('scheduleNextCall: false leaves the existing automatic reminder alone', async () => {
    const { lead, token } = await makeExecutiveWithLead();
    await postCall(token, lead._id, '2026-10-15T10:00:00.000Z');
    const [reminder] = await pendingOf(lead._id);

    await postCall(token, lead._id, '2026-10-15T11:00:00.000Z', { scheduleNextCall: false });

    const pending = await pendingOf(lead._id);
    expect(pending).toHaveLength(1);
    expect(String(pending[0]._id)).toBe(String(reminder._id));
  });

  test('autoNextCall in a client follow-up body is ignored', async () => {
    const { createFollowUpForLead } = require('../../src/services/followUpService');
    const { user, lead } = await makeExecutiveWithLead();
    const created = await createFollowUpForLead({
      body: { lead: lead._id, type: 'call', category: 'warm', scheduledAt: new Date(Date.now() + 3600_000).toISOString(), autoNextCall: true },
      user,
    });
    expect((await FollowUp.findById(created._id).lean()).autoNextCall).toBe(false);
  });
});
