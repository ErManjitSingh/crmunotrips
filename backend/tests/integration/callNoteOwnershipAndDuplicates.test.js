const request = require('supertest');
const mongoose = require('mongoose');
const db = require('../setup/db');

/**
 * POST /api/leads/:id/call-notes
 *  1. A Sales Executive may only log calls on leads assigned to them.
 *  2. The same call (lead + caller + startedAt) is saved once: a retry / double submit returns the
 *     saved call with `duplicate: true` and creates no CallNote, follow-up, activity, audit or
 *     status-movement record.
 */

let app;
let User;
let Lead;
let CallNote;
let FollowUp;
let LeadActivity;
let AuditLog;
let LeadStatusMovement;
let UserSession;
let leadStatusConfigService;
let generateToken;

beforeAll(async () => {
  await db.connect();
  app = require('../../src/server');
  User = require('../../src/models/User');
  Lead = require('../../src/models/Lead');
  CallNote = require('../../src/models/CallNote');
  FollowUp = require('../../src/models/FollowUp');
  LeadActivity = require('../../src/models/LeadActivity');
  AuditLog = require('../../src/models/AuditLog');
  LeadStatusMovement = require('../../src/models/LeadStatusMovement');
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

async function makeAuthedUser(role = 'sales_executive') {
  counter += 1;
  const user = await User.create({
    name: `User ${counter}`,
    email: `ownership${counter}@example.com`,
    password: 'password123',
    role,
  });
  const session = await UserSession.create({
    userId: user._id,
    sessionId: new mongoose.Types.ObjectId().toString(),
    role,
    status: 'active',
    loginAt: new Date(),
    lastActivityAt: new Date(),
  });
  return { user, token: generateToken(user._id, role, session.sessionId) };
}

async function makeLead(overrides = {}) {
  counter += 1;
  const creator = await User.create({
    name: `Creator ${counter}`,
    email: `ownercreator${counter}@example.com`,
    password: 'password123',
    role: 'admin',
  });
  return Lead.create({
    name: `Lead ${counter}`,
    phone: `9${String(1000000000 + counter).slice(0, 9)}`,
    destination: 'Goa',
    status: 'new',
    createdBy: creator._id,
    ...overrides,
  });
}

async function sideEffects(leadId) {
  const [callNotes, followUps, activities, audits, movements] = await Promise.all([
    CallNote.countDocuments({ leadId }),
    FollowUp.countDocuments({ lead: leadId }),
    LeadActivity.countDocuments({ leadId }),
    AuditLog.countDocuments({ entityType: 'lead', entityId: leadId }),
    LeadStatusMovement.countDocuments({ leadId }),
  ]);
  return { callNotes, followUps, activities, audits, movements };
}

function postCallNote(token, leadId, body) {
  return request(app).post(`/api/leads/${leadId}/call-notes`).set('Authorization', `Bearer ${token}`).send(body);
}

function call(startedAt, overrides = {}) {
  const start = new Date(startedAt);
  return {
    category: 'warm',
    outcome: 'discussed_package',
    notes: 'wants Goa in December',
    startedAt: start.toISOString(),
    endedAt: new Date(start.getTime() + 95_000).toISOString(),
    scheduleNextCall: true,
    ...overrides,
  };
}

describe('Sales Executive ownership', () => {
  test('an executive can log a call on their own lead', async () => {
    const { user, token } = await makeAuthedUser();
    const lead = await makeLead({ assignedTo: user._id });

    const res = await postCallNote(token, lead._id, call('2026-10-10T10:00:00.000Z'));

    expect(res.status).toBe(201);
    expect(res.body.duplicate).toBeUndefined();
    expect(res.body.status).toBe('contacted');
    expect(res.body.duration).toBe(95);
    const fx = await sideEffects(lead._id);
    expect(fx.callNotes).toBe(1);
    expect(fx.followUps).toBe(1);
    const saved = await Lead.findById(lead._id).lean();
    expect(saved.statusReason).toBe('discussed_package');
    expect(saved.callStats.count).toBe(1);
  });

  test("an executive cannot log a call on another executive's lead — 404, nothing written", async () => {
    const { user: owner } = await makeAuthedUser();
    const { token: otherToken } = await makeAuthedUser();
    const lead = await makeLead({ assignedTo: owner._id });
    const before = await Lead.findById(lead._id).lean();

    const res = await postCallNote(otherToken, lead._id, call('2026-10-10T10:00:00.000Z', {
      category: 'cold', outcome: 'not_interested',
    }));

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Lead not found');
    expect(await sideEffects(lead._id)).toEqual({ callNotes: 0, followUps: 0, activities: 0, audits: 0, movements: 0 });
    const after = await Lead.findById(lead._id).lean();
    expect(after.status).toBe(before.status);
    expect(after.statusReason).toBe(before.statusReason);
    expect(after.temperature).toBe(before.temperature);
    expect(after.firstOpenedAt ?? null).toBe(before.firstOpenedAt ?? null);
  });

  test('an executive cannot log a call on an unassigned lead', async () => {
    const { token } = await makeAuthedUser();
    const lead = await makeLead();
    const res = await postCallNote(token, lead._id, call('2026-10-10T10:00:00.000Z'));
    expect(res.status).toBe(404);
    expect((await sideEffects(lead._id)).callNotes).toBe(0);
  });

  test.each(['admin', 'sales_manager'])('%s can still log a call on any lead (unchanged)', async (role) => {
    const { user: owner } = await makeAuthedUser();
    const { token } = await makeAuthedUser(role);
    const lead = await makeLead({ assignedTo: owner._id });
    const res = await postCallNote(token, lead._id, call('2026-10-10T10:00:00.000Z'));
    expect(res.status).toBe(201);
  });
});

describe('Duplicate-call protection', () => {
  test('repeating the same call returns the saved call and writes nothing new', async () => {
    const { user, token } = await makeAuthedUser();
    const lead = await makeLead({ assignedTo: user._id });
    const body = call('2026-10-10T10:00:00.000Z');

    const first = await postCallNote(token, lead._id, body);
    const afterFirst = await sideEffects(lead._id);
    const leadAfterFirst = await Lead.findById(lead._id).lean();
    const retry = await postCallNote(token, lead._id, body);

    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.duplicate).toBe(true);
    expect(String(retry.body._id)).toBe(String(first.body._id));
    expect(await sideEffects(lead._id)).toEqual(afterFirst);
    const leadAfterRetry = await Lead.findById(lead._id).lean();
    expect(leadAfterRetry.callStats.count).toBe(1);
    expect(leadAfterRetry.callStats.totalDurationSeconds).toBe(leadAfterFirst.callStats.totalDurationSeconds);
    expect(String(leadAfterRetry.nextFollowUp)).toBe(String(leadAfterFirst.nextFollowUp));
  });

  test('simultaneous identical submissions (double tap) save exactly one call', async () => {
    const { user, token } = await makeAuthedUser();
    const lead = await makeLead({ assignedTo: user._id });
    const body = call('2026-10-10T10:00:00.000Z');

    const results = await Promise.all([1, 2, 3].map(() => postCallNote(token, lead._id, body)));

    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 201]);
    expect(results.filter((r) => r.body.duplicate === true)).toHaveLength(2);
    const fx = await sideEffects(lead._id);
    expect(fx.callNotes).toBe(1);
    expect(fx.followUps).toBe(1);
    expect((await Lead.findById(lead._id).lean()).callStats.count).toBe(1);
  });

  test('a retry that changes the outcome does not re-apply a different status for the same call', async () => {
    const { user, token } = await makeAuthedUser();
    const lead = await makeLead({ assignedTo: user._id });
    await postCallNote(token, lead._id, call('2026-10-10T10:00:00.000Z'));
    const retry = await postCallNote(token, lead._id, call('2026-10-10T10:00:00.000Z', {
      category: 'hot', outcome: 'ready_to_book',
    }));
    expect(retry.status).toBe(200);
    expect(retry.body.duplicate).toBe(true);
    expect(retry.body.outcome).toBe('discussed_package');
    expect((await Lead.findById(lead._id).lean()).statusReason).toBe('discussed_package');
  });

  test('different legitimate calls are saved separately', async () => {
    const { user, token } = await makeAuthedUser();
    const lead = await makeLead({ assignedTo: user._id });

    const a = await postCallNote(token, lead._id, call('2026-10-10T10:00:00.000Z'));
    const b = await postCallNote(token, lead._id, call('2026-10-10T12:30:00.000Z', {
      category: 'hot', outcome: 'ready_to_book',
    }));

    expect([a.status, b.status]).toEqual([201, 201]);
    expect((await sideEffects(lead._id)).callNotes).toBe(2);
    const saved = await Lead.findById(lead._id).lean();
    expect(saved.callStats.count).toBe(2);
    expect(saved.statusReason).toBe('ready_to_book');
    expect(saved.status).toBe('negotiation');
  });

  test('the same start time from a different caller is a different call', async () => {
    const { user: owner, token: ownerToken } = await makeAuthedUser();
    const { token: managerToken } = await makeAuthedUser('sales_manager');
    const lead = await makeLead({ assignedTo: owner._id });
    const body = call('2026-10-10T10:00:00.000Z');

    const a = await postCallNote(ownerToken, lead._id, body);
    const b = await postCallNote(managerToken, lead._id, body);

    expect([a.status, b.status]).toEqual([201, 201]);
    expect((await sideEffects(lead._id)).callNotes).toBe(2);
  });

  test('calls without a start time keep the previous behaviour (not de-duplicated)', async () => {
    const { user, token } = await makeAuthedUser();
    const lead = await makeLead({ assignedTo: user._id });
    const body = { category: 'warm', outcome: 'requested_callback' };

    const a = await postCallNote(token, lead._id, body);
    const b = await postCallNote(token, lead._id, body);

    expect([a.status, b.status]).toEqual([201, 201]);
    expect((await sideEffects(lead._id)).callNotes).toBe(2);
  });

  test('a rejected (invalid) submission does not block a later valid one for the same call', async () => {
    const { user, token } = await makeAuthedUser();
    const lead = await makeLead({ assignedTo: user._id });
    const bad = await postCallNote(token, lead._id, call('2026-10-10T10:00:00.000Z', { category: 'cold', outcome: 'ready_to_book' }));
    const good = await postCallNote(token, lead._id, call('2026-10-10T10:00:00.000Z'));
    expect(bad.status).toBe(400);
    expect(good.status).toBe(201);
    expect((await sideEffects(lead._id)).callNotes).toBe(1);
  });
});
