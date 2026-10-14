/**
 * Cold Calling -> Sales Executive reassignment: one existing lead changes current owner; its identity,
 * status and history stay; the new owner gets the normal workflow; the old owner keeps a read-only view
 * and loses working access (enforced server-side).
 *
 * In-memory MongoDB only (tests/setup/db) — never the real database.
 */
const request = require('supertest');
const mongoose = require('mongoose');
const db = require('../setup/db');

let app;
let User;
let Lead;
let Branch;
let Team;
let UserSession;
let CallNote;
let FollowUp;
let LeadActivity;
let LeadTransferLog;
let ColdCallingAssignment;
let generateToken;
let counter = 0;

const ASSIGN = '/api/leads/analytics/executive-lead-status/cold-calling/assign';

beforeAll(async () => {
  await db.connect();
  app = require('../../src/server');
  User = require('../../src/models/User');
  Lead = require('../../src/models/Lead');
  Branch = require('../../src/models/Branch');
  Team = require('../../src/models/Team');
  UserSession = require('../../src/models/UserSession');
  CallNote = require('../../src/models/CallNote');
  FollowUp = require('../../src/models/FollowUp');
  LeadActivity = require('../../src/models/LeadActivity');
  LeadTransferLog = require('../../src/models/LeadTransferLog');
  ColdCallingAssignment = require('../../src/models/ColdCallingAssignment');
  ({ generateToken } = require('../../src/middleware/auth'));
});

afterEach(async () => {
  await db.clearCollections();
  await require('../../src/services/cacheService').invalidate();
});

afterAll(async () => {
  await db.disconnect();
});

async function makeUser(role, overrides = {}) {
  counter += 1;
  return User.create({ name: overrides.name || `${role} ${counter}`, email: `re${counter}@example.com`, password: 'password123', role, ...overrides });
}
async function tokenFor(user) {
  const session = await UserSession.create({
    userId: user._id, sessionId: new mongoose.Types.ObjectId().toString(), role: user.role, status: 'active', loginAt: new Date(), lastActivityAt: new Date(),
  });
  return generateToken(user._id, user.role, session.sessionId);
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });

let clock = Date.parse('2026-09-21T05:00:00.000Z');
const call = (outcome, seconds = 120) => {
  clock += 3600 * 1000;
  return { outcome, startedAt: new Date(clock).toISOString(), endedAt: new Date(clock + seconds * 1000).toISOString(), notes: `note ${outcome}` };
};

/**
 * Rahul owns a Cold lead (ABC Hotel). Admin sends it to Cold Calling (Yash). Aman and Priya are other
 * Sales Executives in the same branch; Ravi is a second Cold Calling agent; Omar is an exec in another branch.
 */
async function world() {
  await require('../../src/services/leadStatusConfigService').getConfig({ force: true });
  counter += 1;
  const branch = await Branch.create({ name: `Mumbai ${counter}`, code: `RB${counter}` });
  const otherBranch = await Branch.create({ name: `Delhi ${counter}`, code: `RD${counter}` });
  const admin = await makeUser('admin', { name: 'Admin A' });
  const rahul = await makeUser('sales_executive', { name: 'Rahul', branchId: branch._id });
  const aman = await makeUser('sales_executive', { name: 'Aman', branchId: branch._id });
  const priya = await makeUser('sales_executive', { name: 'Priya', branchId: branch._id });
  const omar = await makeUser('sales_executive', { name: 'Omar', branchId: otherBranch._id });
  const inactive = await makeUser('sales_executive', { name: 'Gone', branchId: branch._id, status: 'disabled' });
  const yash = await makeUser('cold_calling', { name: 'Yash', branchId: branch._id });
  const ravi = await makeUser('cold_calling', { name: 'Ravi', branchId: branch._id });
  const lead = await Lead.create({
    leadId: `LD-${9000 + counter}`, name: 'ABC Hotel', phone: `98${String(10000000 + counter).slice(0, 8)}`, email: 'abc@example.com',
    destination: 'Manali', travelDate: new Date('2026-10-15'), budget: 45000, createdBy: admin._id,
    assignedTo: rahul._id, assignedAt: new Date(), branchId: branch._id, status: 'follow_up', statusReason: 'not_interested',
  });
  const adminToken = await tokenFor(admin);
  const assignToCold = (agent, executive) =>
    request(app).post(ASSIGN).set(auth(adminToken)).send({ executiveId: String(executive._id), leadIds: [String(lead._id)], coldCallerId: String(agent._id) });
  expect((await assignToCold(yash, rahul)).status).toBe(201);
  return {
    branch, admin, adminToken, rahul, aman, priya, omar, inactive, yash, ravi, lead, assignToCold,
    yashToken: await tokenFor(yash), rahulToken: await tokenFor(rahul), amanToken: await tokenFor(aman), priyaToken: await tokenFor(priya),
  };
}

const reassign = (t, leadId, body) => request(app).post(`/api/cold-calling/leads/${leadId}/reassign`).set(auth(t)).send(body);
const options = (t, leadId) => request(app).get(`/api/cold-calling/leads/${leadId}/reassign-options`).set(auth(t));
const coldCall = (t, leadId, body) => request(app).post(`/api/cold-calling/leads/${leadId}/call-notes`).set(auth(t)).send(body);

/** Yash makes the lead Warm with a real call, the way it happens in the app. */
async function makeWarm(w) {
  expect((await coldCall(w.yashToken, w.lead._id, call('discussed_package'))).status).toBe(201);
  const warm = await Lead.findById(w.lead._id).lean();
  expect(warm.statusReason).toBe('discussed_package');
  return warm;
}

describe('reassign options', () => {
  test('lists active same-branch Sales Executives except the current owner', async () => {
    const w = await world();
    const res = await options(w.yashToken, w.lead._id);
    expect(res.status).toBe(200);
    expect(res.body.currentOwner.name).toBe('Rahul');
    expect(res.body.executives.map((e) => e.name).sort()).toEqual(['Aman', 'Priya']);
  });
});

describe('Cold Calling user reassigns an eligible lead', () => {
  test('same lead, new current owner, original owner kept, status kept, history intact', async () => {
    const w = await world();
    const before = await makeWarm(w);
    const pending = await FollowUp.create({ lead: w.lead._id, assignedTo: w.rahul._id, scheduledAt: new Date(Date.now() + 86400000), status: 'pending', branchId: w.branch._id, type: 'call', createdBy: w.admin._id });
    const done = await FollowUp.create({ lead: w.lead._id, assignedTo: w.rahul._id, scheduledAt: new Date(Date.now() - 86400000), status: 'completed', branchId: w.branch._id, type: 'call', createdBy: w.admin._id });
    const counts = async () => ({
      leads: await Lead.countDocuments({}),
      calls: await CallNote.countDocuments({ leadId: w.lead._id }),
      followUps: await FollowUp.countDocuments({ lead: w.lead._id }),
      activities: await LeadActivity.countDocuments({ leadId: w.lead._id }),
    });
    const c0 = await counts();

    const res = await reassign(w.yashToken, w.lead._id, { executiveId: String(w.aman._id), expectedCurrentOwnerId: String(w.rahul._id) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      message: 'Lead reassigned to Aman.',
      originalOwner: { name: 'Rahul' },
      previousOwner: { name: 'Rahul' },
      currentOwner: { name: 'Aman' },
      lead: { leadId: before.leadId, status: before.status, statusReason: 'discussed_package' },
    });

    const after = await Lead.findById(w.lead._id).lean();
    // Identity + data unchanged
    for (const key of ['leadId', 'name', 'phone', 'email', 'destination', 'budget', 'status', 'statusReason']) expect([key, after[key]]).toEqual([key, before[key]]);
    expect(after.travelDate.toISOString()).toBe(before.travelDate.toISOString());
    // Ownership
    expect(String(after.assignedTo)).toBe(String(w.aman._id));
    expect(String(after.originalAssignedTo)).toBe(String(w.rahul._id));
    expect(after.assignmentHistoryIds.map(String)).toContain(String(w.rahul._id));
    // No duplicate, nothing lost (one new timeline row: the reassignment)
    const c1 = await counts();
    expect(c1).toEqual({ ...c0, activities: c0.activities + 1 });
    // Pending follow-up moves with the lead; completed history stays as it was
    expect(String((await FollowUp.findById(pending._id).lean()).assignedTo)).toBe(String(w.aman._id));
    expect(String((await FollowUp.findById(done._id).lean()).assignedTo)).toBe(String(w.rahul._id));
    // Cold Calling assignment closed (kept for history), so it leaves Yash's active list
    const assignment = await ColdCallingAssignment.findOne({ leadId: w.lead._id }).lean();
    expect(assignment).toMatchObject({ status: 'closed', closedReason: 'reassigned_to_sales', reassignedToName: 'Aman' });
    const mine = await request(app).get('/api/cold-calling/my-leads').set(auth(w.yashToken));
    expect(mine.body.pagination.total).toBe(0);
    expect((await request(app).get('/api/cold-calling/my-summary').set(auth(w.yashToken))).body.assigned).toBe(0);
  });

  test('audit trail: who, from, to, original owner, when — on the timeline and the transfer ledger', async () => {
    const w = await world();
    await reassign(w.yashToken, w.lead._id, { executiveId: String(w.aman._id) });
    const activity = await LeadActivity.findOne({ leadId: w.lead._id, type: 'lead_reassigned' }).lean();
    expect(activity).toMatchObject({ actorName: 'Yash', actorRole: 'cold_calling', description: 'Rahul → Cold Calling (Yash) → Aman' });
    expect(activity.meta).toMatchObject({ source: 'cold_calling', fromName: 'Rahul', toName: 'Aman', originalOwnerName: 'Rahul', reassignedByName: 'Yash' });
    const log = await LeadTransferLog.findOne({ leadId: w.lead._id }).lean();
    expect(log).toMatchObject({ type: 'reassign', actorName: 'Yash' });
    expect(String(log.fromUserId)).toBe(String(w.rahul._id));
    expect(String(log.toUserId)).toBe(String(w.aman._id));
    expect(log.createdAt).toBeInstanceOf(Date);
  });
});

describe('the new owner gets the normal workflow', () => {
  test('Aman sees it in his leads and can open, call, log a call, add follow-up, note and edit it', async () => {
    const w = await world();
    await makeWarm(w);
    await reassign(w.yashToken, w.lead._id, { executiveId: String(w.aman._id) });
    const id = String(w.lead._id);

    const list = await request(app).get('/api/sales-executive/leads').set(auth(w.amanToken));
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain(id);
    expect((await request(app).get(`/api/sales-executive/leads/${id}`).set(auth(w.amanToken))).status).toBe(200);
    expect((await request(app).post(`/api/sales-executive/leads/${id}/call-access`).set(auth(w.amanToken))).status).toBe(200);
    expect((await request(app).post(`/api/leads/${id}/call-notes`).set(auth(w.amanToken)).send(call('price_negotiation'))).status).toBe(201);
    const fu = await request(app).post('/api/sales-executive/followups').set(auth(w.amanToken))
      .send({ lead: id, type: 'call', scheduledAt: new Date(Date.now() + 3600000).toISOString(), notes: 'call back' });
    expect(fu.status).toBe(201);
    expect((await request(app).put(`/api/sales-executive/followups/${fu.body._id}`).set(auth(w.amanToken)).send({ notes: 'updated' })).status).toBe(200);
    expect((await request(app).post(`/api/sales-executive/leads/${id}/notes`).set(auth(w.amanToken)).send({ text: 'handover received' })).status).toBeLessThan(300);
    expect((await request(app).put(`/api/sales-executive/leads/${id}`).set(auth(w.amanToken)).send({ specialRequirements: 'sea view' })).status).toBe(200);
  });
});

describe('the old owner loses working access (server-side) but keeps a read-only view', () => {
  test('owner-only actions are rejected with the clear reassigned message', async () => {
    const w = await world();
    const old = await FollowUp.create({ lead: w.lead._id, assignedTo: w.rahul._id, scheduledAt: new Date(Date.now() + 86400000), status: 'pending', branchId: w.branch._id, type: 'call', createdBy: w.admin._id });
    await reassign(w.yashToken, w.lead._id, { executiveId: String(w.aman._id) });
    const id = String(w.lead._id);
    const MESSAGE = 'This lead has been reassigned to Aman and is no longer part of your active leads.';

    const attempts = [
      ['open', request(app).get(`/api/sales-executive/leads/${id}`)],
      ['call', request(app).post(`/api/sales-executive/leads/${id}/call-access`)],
      ['log call', request(app).post(`/api/leads/${id}/call-notes`).send(call('price_negotiation'))],
      ['edit / status', request(app).put(`/api/sales-executive/leads/${id}`).send({ status: 'converted' })],
      ['note', request(app).post(`/api/sales-executive/leads/${id}/notes`).send({ text: 'still mine?' })],
      ['new follow-up', request(app).post('/api/sales-executive/followups').send({ lead: id, type: 'call', scheduledAt: new Date(Date.now() + 3600000).toISOString() })],
    ];
    for (const [label, pending] of attempts) {
      const res = await pending.set(auth(w.rahulToken));
      expect([label, res.status, res.body.message]).toEqual([label, 403, MESSAGE]);
    }
    expect((await request(app).get(`/api/sales-executive/leads/${id}`).set(auth(w.rahulToken))).body.code).toBe('LEAD_REASSIGNED');
    // His old pending follow-up moved to Aman, so he can't work it either.
    expect((await request(app).put(`/api/sales-executive/followups/${old._id}`).set(auth(w.rahulToken)).send({ notes: 'x' })).status).toBe(404);
    // Nothing changed on the lead.
    const after = await Lead.findById(id).lean();
    expect(String(after.assignedTo)).toBe(String(w.aman._id));
    expect(after.status).toBe('follow_up');
    // He cannot reassign it (not a Cold Calling user).
    expect((await reassign(w.rahulToken, id, { executiveId: String(w.rahul._id) })).status).toBe(403);
  });

  test('not in his active leads; listed under reassigned leads with the message; read-only detail without contact data', async () => {
    const w = await world();
    await makeWarm(w);
    await reassign(w.yashToken, w.lead._id, { executiveId: String(w.aman._id) });

    const active = await request(app).get('/api/sales-executive/leads').set(auth(w.rahulToken));
    expect(JSON.stringify(active.body)).not.toContain(String(w.lead._id));

    const list = await request(app).get('/api/sales-executive/reassigned-leads').set(auth(w.rahulToken));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0]).toMatchObject({
      name: 'ABC Hotel', bucket: 'warm', currentOwner: { name: 'Aman' }, originalOwner: { name: 'Rahul' }, reassignedBy: 'Yash',
      message: 'This lead has been reassigned to Aman and is no longer part of your active leads.',
    });

    const detail = await request(app).get(`/api/sales-executive/reassigned-leads/${w.lead._id}`).set(auth(w.rahulToken));
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({ readOnly: true, currentOwner: { name: 'Aman' }, originalOwner: { name: 'Rahul' } });
    expect(detail.body.calls).toHaveLength(1);
    expect(detail.body.timeline.some((t) => t.type === 'lead_reassigned')).toBe(true);
    expect(detail.body.reassignments).toEqual([expect.objectContaining({ from: 'Rahul', to: 'Aman', by: 'Yash' })]);
    expect(JSON.stringify(detail.body)).not.toContain(w.lead.phone);
    expect(JSON.stringify(detail.body)).not.toContain('abc@example.com');

    // Nobody else gets the read-only view: Aman (current owner) and Priya (never owned) -> 404.
    expect((await request(app).get(`/api/sales-executive/reassigned-leads/${w.lead._id}`).set(auth(w.amanToken))).status).toBe(404);
    expect((await request(app).get(`/api/sales-executive/reassigned-leads/${w.lead._id}`).set(auth(w.priyaToken))).status).toBe(404);
  });
});

describe('invalid reassignment is rejected', () => {
  test('same owner, invalid / ineligible targets', async () => {
    const w = await world();
    const cases = [
      ['same owner', { executiveId: String(w.rahul._id) }, 400, /already owned by Rahul/],
      ['cold caller as target', { executiveId: String(w.ravi._id) }, 400, /not an active Sales Executive/],
      ['admin as target', { executiveId: String(w.admin._id) }, 400, /not an active Sales Executive/],
      ['inactive exec', { executiveId: String(w.inactive._id) }, 400, /not an active Sales Executive/],
      ['other branch exec', { executiveId: String(w.omar._id) }, 400, /not an active Sales Executive/],
      ['unknown id', { executiveId: String(new mongoose.Types.ObjectId()) }, 400, /not an active Sales Executive/],
      ['missing', {}, 400, /Select a Sales Executive/],
      ['injection', { executiveId: { $ne: null } }, 400, /Select a Sales Executive/],
    ];
    for (const [label, body, status, message] of cases) {
      const res = await reassign(w.yashToken, w.lead._id, body);
      expect([label, res.status]).toEqual([label, status]);
      expect(res.body.message).toMatch(message);
    }
    const lead = await Lead.findById(w.lead._id).lean();
    expect(String(lead.assignedTo)).toBe(String(w.rahul._id));
    expect((await ColdCallingAssignment.findOne({ leadId: w.lead._id }).lean()).status).toBe('active');
  });

  test('a Cold Calling user cannot reassign a lead they do not hold; closed leads cannot be reassigned', async () => {
    const w = await world();
    const raviToken = await tokenFor(w.ravi);
    expect((await reassign(raviToken, w.lead._id, { executiveId: String(w.aman._id) })).status).toBe(404);
    expect((await options(raviToken, w.lead._id)).status).toBe(404);
    const unassigned = await Lead.create({ leadId: 'LD-X1', name: 'Other', phone: '9000000001', destination: 'Goa', createdBy: w.admin._id, assignedTo: w.rahul._id, branchId: w.branch._id, status: 'follow_up', statusReason: 'not_interested' });
    expect((await reassign(w.yashToken, unassigned._id, { executiveId: String(w.aman._id) })).status).toBe(404);

    await Lead.updateOne({ _id: w.lead._id }, { $set: { status: 'converted' } });
    const closed = await reassign(w.yashToken, w.lead._id, { executiveId: String(w.aman._id) });
    expect(closed.status).toBe(409);
    expect(String((await Lead.findById(w.lead._id).lean()).assignedTo)).toBe(String(w.rahul._id));
  });
});

describe('concurrency / stale screens', () => {
  test('a stale expected owner is rejected and changes nothing', async () => {
    const w = await world();
    const res = await reassign(w.yashToken, w.lead._id, { executiveId: String(w.aman._id), expectedCurrentOwnerId: String(w.priya._id) });
    expect(res.status).toBe(409);
    expect(String((await Lead.findById(w.lead._id).lean()).assignedTo)).toBe(String(w.rahul._id));
    expect((await ColdCallingAssignment.findOne({ leadId: w.lead._id }).lean()).status).toBe('active');
  });

  test('two simultaneous reassignments: exactly one wins, the other gets 409', async () => {
    const w = await world();
    const results = await Promise.all([
      reassign(w.yashToken, w.lead._id, { executiveId: String(w.aman._id) }),
      reassign(w.yashToken, w.lead._id, { executiveId: String(w.priya._id) }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    const winner = results.find((r) => r.status === 200).body.currentOwner._id;
    expect(String((await Lead.findById(w.lead._id).lean()).assignedTo)).toBe(String(winner));
    expect(await LeadTransferLog.countDocuments({ leadId: w.lead._id })).toBe(1);
  });

  test('an owner change between read and write rolls the claim back (compare-and-set)', async () => {
    const w = await world();
    const service = require('../../src/services/coldCallingReassignService');
    const assignment = await ColdCallingAssignment.findOne({ leadId: w.lead._id }).lean();
    // Simulate an Admin changing the owner AFTER the service read it: right as the assignment is claimed.
    const realClaim = ColdCallingAssignment.findOneAndUpdate.bind(ColdCallingAssignment);
    const spy = jest.spyOn(ColdCallingAssignment, 'findOneAndUpdate').mockImplementationOnce(async (...args) => {
      await Lead.updateOne({ _id: w.lead._id }, { $set: { assignedTo: w.priya._id } });
      return realClaim(...args);
    });
    await expect(
      service.reassignLeadToExecutive({ actor: w.yash, assignment, leadId: w.lead._id, executiveId: String(w.aman._id) })
    ).rejects.toMatchObject({ statusCode: 409 });
    spy.mockRestore();
    expect(String((await Lead.findById(w.lead._id).lean()).assignedTo)).toBe(String(w.priya._id));
    expect((await ColdCallingAssignment.findById(assignment._id).lean()).status).toBe('active');
  });
});

describe('multiple reassignments: Rahul -> Aman -> Priya', () => {
  test('original owner stays Rahul, current is Priya, history keeps both hops', async () => {
    const w = await world();
    expect((await reassign(w.yashToken, w.lead._id, { executiveId: String(w.aman._id) })).status).toBe(200);

    // Aman works it; it is Cold again, so Admin can send it to Cold Calling a second time (from Aman).
    await Lead.updateOne({ _id: w.lead._id }, { $set: { status: 'follow_up', statusReason: 'not_interested' } });
    expect((await w.assignToCold(w.yash, w.aman)).status).toBe(201);
    const second = await reassign(w.yashToken, w.lead._id, { executiveId: String(w.priya._id) });
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ originalOwner: { name: 'Rahul' }, previousOwner: { name: 'Aman' }, currentOwner: { name: 'Priya' } });

    const lead = await Lead.findById(w.lead._id).lean();
    expect(String(lead.originalAssignedTo)).toBe(String(w.rahul._id));
    expect(String(lead.assignedTo)).toBe(String(w.priya._id));
    const hops = await LeadTransferLog.find({ leadId: w.lead._id }).sort({ createdAt: 1 }).populate('fromUserId toUserId', 'name').lean();
    expect(hops.map((h) => `${h.fromUserId.name}->${h.toUserId.name}`)).toEqual(['Rahul->Aman', 'Aman->Priya']);
    expect(await Lead.countDocuments({})).toBe(1);

    // Both previous owners see it as reassigned to the CURRENT owner.
    for (const token of [w.rahulToken, w.amanToken]) {
      const res = await request(app).get(`/api/sales-executive/leads/${w.lead._id}`).set(auth(token));
      expect([res.status, res.body.message]).toEqual([403, 'This lead has been reassigned to Priya and is no longer part of your active leads.']);
    }
    expect((await request(app).get(`/api/sales-executive/leads/${w.lead._id}`).set(auth(w.priyaToken))).status).toBe(200);
  });
});

describe('team leader scope follows the lead', () => {
  test('the lead moves to the new owner’s team', async () => {
    const w = await world();
    const tl = await makeUser('team_leader', { name: 'TL Aman', branchId: w.branch._id });
    const team = await Team.create({ name: 'Aman squad', teamLeader: tl._id, members: [w.aman._id], branchId: w.branch._id });
    await reassign(w.yashToken, w.lead._id, { executiveId: String(w.aman._id) });
    const lead = await Lead.findById(w.lead._id).lean();
    expect(String(lead.teamId)).toBe(String(team._id));
    expect(String(lead.assignedTeamLeader)).toBe(String(tl._id));
  });
});
