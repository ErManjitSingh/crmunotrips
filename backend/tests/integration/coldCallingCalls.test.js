const request = require('supertest');
const mongoose = require('mongoose');
const db = require('../setup/db');

let app;
let User;
let Lead;
let Branch;
let UserSession;
let CallNote;
let FollowUp;
let LeadActivity;
let LeadStatusMovement;
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
  UserSession = require('../../src/models/UserSession');
  CallNote = require('../../src/models/CallNote');
  FollowUp = require('../../src/models/FollowUp');
  LeadActivity = require('../../src/models/LeadActivity');
  LeadStatusMovement = require('../../src/models/LeadStatusMovement');
  ColdCallingAssignment = require('../../src/models/ColdCallingAssignment');
  ({ generateToken } = require('../../src/middleware/auth'));
  await ColdCallingAssignment.init();
  await CallNote.init();
});

afterEach(async () => {
  await db.clearCollections();
  require('../../src/services/leadStatusConfigService').invalidateCache();
});

afterAll(async () => {
  await db.disconnect();
});

async function makeUser(role, overrides = {}) {
  counter += 1;
  return User.create({ name: overrides.name || `${role} ${counter}`, email: `call${counter}@example.com`, password: 'password123', role, ...overrides });
}
async function tokenFor(user) {
  const session = await UserSession.create({
    userId: user._id, sessionId: new mongoose.Types.ObjectId().toString(), role: user.role, status: 'active', loginAt: new Date(), lastActivityAt: new Date(),
  });
  return generateToken(user._id, user.role, session.sessionId);
}
let creator;
async function makeLead(overrides = {}) {
  counter += 1;
  if (!creator) creator = makeUser('admin', { name: 'Creator' });
  return Lead.create({
    leadId: `CL-${counter}`, name: `Lead ${counter}`, phone: `9${String(4000000000 + counter).slice(0, 9)}`, destination: 'Goa',
    createdBy: (await creator)._id, assignedAt: new Date(), status: 'follow_up', statusReason: 'not_interested', ...overrides,
  });
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });

/** Rahul owns two Cold leads; Amit (Cold Calling) is assigned the first. A second agent, Ravi, exists. */
async function world() {
  await require('../../src/services/leadStatusConfigService').getConfig({ force: true });
  const branch = await Branch.create({ name: `Mumbai ${counter + 1}`, code: `CC${counter + 1}` });
  const admin = await makeUser('admin', { name: 'Admin A' });
  const rahul = await makeUser('sales_executive', { name: 'Rahul', branchId: branch._id });
  const amit = await makeUser('cold_calling', { name: 'Amit Sharma', branchId: branch._id });
  const ravi = await makeUser('cold_calling', { name: 'Ravi Caller', branchId: branch._id });
  const abc = await makeLead({ name: 'ABC Travels', assignedTo: rahul._id, branchId: branch._id });
  const other = await makeLead({ name: 'Unassigned Co', assignedTo: rahul._id, branchId: branch._id });
  const adminToken = await tokenFor(admin);
  const assign = (agent, leads) =>
    request(app).post(ASSIGN).set(auth(adminToken)).send({ executiveId: String(rahul._id), leadIds: leads.map((l) => String(l._id)), coldCallerId: String(agent._id) });
  expect((await assign(amit, [abc])).status).toBe(201);
  return { branch, admin, adminToken, rahul, amit, ravi, abc, other, amitToken: await tokenFor(amit), assign };
}

const access = (t, id) => request(app).post(`/api/cold-calling/leads/${id}/call-access`).set(auth(t));
const endCall = (t, id, body) => request(app).post(`/api/cold-calling/leads/${id}/call-notes`).set(auth(t)).send(body);
const history = (t, id, q = {}) => request(app).get(`/api/cold-calling/leads/${id}/call-history`).query(q).set(auth(t));
const mine = (t, q = {}) => request(app).get('/api/cold-calling/my-leads').query(q).set(auth(t));

let clock = Date.parse('2026-09-21T11:32:00.000Z');
/** A finished call: dial at T, hang up `seconds` later. Each call gets a distinct start. */
const call = (outcome, seconds = 261, extra = {}) => {
  clock += 3600 * 1000;
  return { outcome, startedAt: new Date(clock).toISOString(), endedAt: new Date(clock + seconds * 1000).toISOString(), notes: 'spoke briefly', ...extra };
};

describe('assignment gate: an agent can call ONLY leads assigned to them', () => {
  test('the assigned agent gets the number; everything else is a uniform 404', async () => {
    const w = await world();
    const ok = await access(w.amitToken, w.abc._id);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ opened: true, phone: w.abc.phone });

    const ravi = await tokenFor(w.ravi);
    const cases = [
      ['unassigned lead', access(w.amitToken, w.other._id)],
      ['another agent’s lead', access(ravi, w.abc._id)],
      ['arbitrary id', access(w.amitToken, new mongoose.Types.ObjectId())],
      ['malformed id', access(w.amitToken, 'not-an-id')],
      ['operator injection', request(app).post('/api/cold-calling/leads/%7B%22$ne%22:null%7D/call-access').set(auth(w.amitToken))],
    ];
    for (const [label, pending] of cases) {
      const res = await pending;
      expect([label, res.status, res.body.phone]).toEqual([label, 404, undefined]);
    }
    for (const t of [endCall(w.amitToken, w.other._id, call('discussed_package')), endCall(ravi, w.abc._id, call('discussed_package')), history(ravi, w.abc._id)]) {
      expect((await t).status).toBe(404);
    }
    expect(await CallNote.countDocuments()).toBe(0);
  });

  test('a deleted lead, a lead moved to another branch, and a closed assignment cannot be called', async () => {
    const w = await world();
    const other = await Branch.create({ name: 'Delhi', code: 'DLH' });

    await Lead.updateOne({ _id: w.abc._id }, { $set: { branchId: other._id } });
    expect((await access(w.amitToken, w.abc._id)).status).toBe(404); // branch isolation
    expect((await endCall(w.amitToken, w.abc._id, call('discussed_package'))).status).toBe(404);
    await Lead.updateOne({ _id: w.abc._id }, { $set: { branchId: w.branch._id, isDeleted: true } });
    expect((await access(w.amitToken, w.abc._id)).status).toBe(404); // deleted
    await Lead.updateOne({ _id: w.abc._id }, { $set: { isDeleted: false } });
    expect((await access(w.amitToken, w.abc._id)).status).toBe(200);
    await ColdCallingAssignment.updateOne({ leadId: w.abc._id }, { $set: { status: 'closed' } });
    expect((await access(w.amitToken, w.abc._id)).status).toBe(404); // no longer a valid assignment
    expect(await CallNote.countDocuments()).toBe(0);
  });

  test('every other role is forbidden on the Cold Calling routes; the shared calling routes stay closed to the agent', async () => {
    const w = await world();
    const manager = await makeUser('sales_manager', { branchId: w.branch._id });
    for (const user of [w.admin, w.rahul, manager]) {
      const token = await tokenFor(user);
      expect([user.role, (await access(token, w.abc._id)).status]).toEqual([user.role, 403]);
      expect([user.role, (await endCall(token, w.abc._id, call('discussed_package'))).status]).toEqual([user.role, 403]);
    }
    expect((await request(app).post(`/api/cold-calling/leads/${w.abc._id}/call-access`)).status).toBe(401);

    // The agent cannot reach the shared endpoints (which have no assignment check) or Admin/Sales ones.
    const shared = [
      ['post', `/api/leads/${w.abc._id}/call-notes`],
      ['get', `/api/leads/${w.abc._id}/call-notes`],
      ['post', `/api/sales-executive/leads/${w.abc._id}/call-access`],
      ['post', ASSIGN],
      ['get', '/api/users'],
    ];
    for (const [method, url] of shared) {
      expect([method, url, (await request(app)[method](url).set(auth(w.amitToken)).send(call('discussed_package'))).status]).toEqual([method, url, 403]);
    }
    expect(await CallNote.countDocuments()).toBe(0);
  });
});

describe('a Cold Caller call is a normal CRM CallNote — attributed to the caller, not the Sales owner', () => {
  test('call end records caller, lead, branch, times, duration, outcome and notes', async () => {
    const w = await world();
    const body = call('discussed_package', 262);
    const res = await endCall(w.amitToken, w.abc._id, body);
    expect(res.status).toBe(201);

    const notes = await CallNote.find({}).lean();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ outcome: 'discussed_package', duration: 262, callerRole: 'cold_calling', notes: 'spoke briefly' });
    expect(String(notes[0].userId)).toBe(String(w.amit._id)); // Amit — not Rahul
    expect(String(notes[0].leadId)).toBe(String(w.abc._id));
    expect(String(notes[0].branchId)).toBe(String(w.branch._id));
    expect(notes[0].startedAt.toISOString()).toBe(body.startedAt);
    expect(notes[0].endedAt.toISOString()).toBe(body.endedAt);
    expect(res.body.userId).toMatchObject({ name: 'Amit Sharma' });
  });

  test('the caller identity cannot be spoofed and duration cannot be typed in', async () => {
    const w = await world();
    const spoof = { userId: String(w.rahul._id), callerId: String(w.rahul._id), executiveId: String(w.rahul._id), callerRole: 'sales_executive', coldCallerId: String(w.ravi._id) };
    // Timestamps say 30s; the client claims 99999s: the timestamps win.
    expect((await endCall(w.amitToken, w.abc._id, call('discussed_package', 30, { ...spoof, durationSeconds: 99999, duration: 99999 }))).status).toBe(201);
    // No timestamps at all: a Cold Caller cannot make up a duration (same rule as Sales Executives).
    expect((await endCall(w.amitToken, w.abc._id, { outcome: 'requested_callback', durationSeconds: 5000, ...spoof })).status).toBe(201);

    const notes = await CallNote.find({}).sort({ createdAt: 1 }).lean();
    expect(notes.map((n) => n.duration)).toEqual([30, 0]);
    for (const n of notes) {
      expect(String(n.userId)).toBe(String(w.amit._id));
      expect(n.callerRole).toBe('cold_calling');
    }
  });

  test('calling never changes Sales ownership, and does not schedule a Sales follow-up', async () => {
    const w = await world();
    const before = await Lead.findById(w.abc._id).lean();
    expect((await endCall(w.amitToken, w.abc._id, call('discussed_package'))).status).toBe(201);
    const after = await Lead.findById(w.abc._id).lean();
    expect(String(after.assignedTo)).toBe(String(w.rahul._id));
    expect(after.assignedAt.getTime()).toBe(before.assignedAt.getTime());
    expect(String(after.lastContactedBy)).toBe(String(w.amit._id)); // the call is Amit's
    expect(after.callStats.count).toBe(1);
    expect(await FollowUp.countDocuments()).toBe(0);
    expect(await ColdCallingAssignment.countDocuments({ status: 'active' })).toBe(1);
  });

  test('the same outcome-category integrity checks apply (reused, not re-implemented)', async () => {
    const w = await world();
    expect((await endCall(w.amitToken, w.abc._id, { outcome: 'made_up_outcome' })).status).toBe(400);
    expect((await endCall(w.amitToken, w.abc._id, { ...call('ready_to_book'), category: 'cold' })).status).toBe(400);
    expect((await endCall(w.amitToken, w.abc._id, {})).status).toBe(400);
    expect(await CallNote.countDocuments()).toBe(0);
  });
});

describe('call history', () => {
  test('every call is its own record; history lists the agent’s calls newest first and survives paging', async () => {
    const w = await world();
    for (const [outcome, seconds] of [['cnp_same_day', 40], ['discussed_package', 403], ['requested_callback', 492]]) {
      expect((await endCall(w.amitToken, w.abc._id, call(outcome, seconds))).status).toBe(201);
    }
    expect(await CallNote.countDocuments({ leadId: w.abc._id })).toBe(3);

    const all = await history(w.amitToken, w.abc._id);
    expect(all.body.pagination.total).toBe(3);
    expect(all.body.data.map((c) => c.outcome)).toEqual(['requested_callback', 'discussed_package', 'cnp_same_day']);
    expect(all.body.data.map((c) => c.duration)).toEqual([492, 403, 40]);
    expect(all.body.data.every((c) => c.caller.name === 'Amit Sharma')).toBe(true);

    const p1 = await history(w.amitToken, w.abc._id, { page: 1, limit: 2 });
    const p2 = await history(w.amitToken, w.abc._id, { page: 2, limit: 2 });
    expect([...p1.body.data, ...p2.body.data].map((c) => c._id)).toEqual(all.body.data.map((c) => c._id));
  });

  test('history shows only the agent’s own calls — the Sales owner’s private calls and notes are not exposed', async () => {
    const w = await world();
    await CallNote.create({ leadId: w.abc._id, branchId: w.branch._id, userId: w.rahul._id, callerRole: 'sales_executive', outcome: 'price_negotiation', notes: 'RAHUL PRIVATE NOTE', duration: 77, startedAt: new Date('2026-09-01T10:00:00Z') });
    expect((await endCall(w.amitToken, w.abc._id, call('discussed_package'))).status).toBe(201);
    const res = await history(w.amitToken, w.abc._id);
    expect(res.body.data).toHaveLength(1);
    expect(JSON.stringify(res.body)).not.toMatch(/RAHUL PRIVATE NOTE|Rahul/);
    expect(JSON.stringify(res.body)).not.toMatch(/phone/i);
  });

  test('history survives an ownership change: Rahul -> Sippy leaves every call attributed to Amit', async () => {
    const w = await world();
    const sippy = await makeUser('sales_executive', { name: 'Sippy', branchId: w.branch._id });
    for (let i = 0; i < 3; i += 1) await endCall(w.amitToken, w.abc._id, call(i === 0 ? 'cnp_same_day' : 'discussed_package'));
    const assignmentBefore = await ColdCallingAssignment.findOne({ leadId: w.abc._id }).lean();

    await Lead.updateOne({ _id: w.abc._id }, { $set: { assignedTo: sippy._id, assignedAt: new Date() } });

    const notes = await CallNote.find({ leadId: w.abc._id }).lean();
    expect(notes).toHaveLength(3);
    for (const n of notes) expect(String(n.userId)).toBe(String(w.amit._id)); // NOT Sippy
    const assignmentAfter = await ColdCallingAssignment.findOne({ leadId: w.abc._id }).lean();
    expect(assignmentAfter).toEqual(assignmentBefore);
    expect(String(assignmentAfter.originalSalesOwnerId)).toBe(String(w.rahul._id));
    expect(String((await Lead.findById(w.abc._id).lean()).assignedTo)).toBe(String(sippy._id));
    // ...and Amit still sees all three, and can keep calling under the same assignment.
    expect((await history(w.amitToken, w.abc._id)).body.pagination.total).toBe(3);
    expect((await endCall(w.amitToken, w.abc._id, call('discussed_package'))).status).toBe(201);
    expect(await CallNote.countDocuments({ leadId: w.abc._id, userId: w.amit._id })).toBe(4);
  });
});

describe('status changes reuse the existing mechanism; the assignment is never deleted', () => {
  const bucketOf = async (w, leadId) => {
    const res = await request(app).get(`/api/leads/analytics/executive-lead-status/${w.rahul._id}/leads`).set(auth(w.adminToken));
    return res.body.data.find((l) => l._id === String(leadId)).bucket;
  };

  test('Cold -> Warm -> Hot through calls: bucket follows, movements are recorded with Amit, assignment and CallNotes remain', async () => {
    const w = await world();
    expect(await bucketOf(w, w.abc._id)).toBe('cold');

    await endCall(w.amitToken, w.abc._id, call('discussed_package'));
    expect(await bucketOf(w, w.abc._id)).toBe('warm');
    await endCall(w.amitToken, w.abc._id, call('ready_to_book'));
    expect(await bucketOf(w, w.abc._id)).toBe('hot');

    const movements = await LeadStatusMovement.find({ leadId: w.abc._id }).sort({ changedAt: 1 }).lean();
    expect(movements.map((m) => m.movement)).toEqual(['cold_to_warm', 'warm_to_hot']);
    for (const m of movements) {
      expect(String(m.changedBy)).toBe(String(w.amit._id));
      expect(m.source).toBe('call_note');
    }
    // The timeline records the call with real timestamps; no causal claim is made between call and status.
    const activities = await LeadActivity.find({ leadId: w.abc._id, type: 'call_note_added' }).lean();
    expect(activities).toHaveLength(2);
    expect(activities.every((a) => a.actorName === 'Amit Sharma')).toBe(true);

    expect(await ColdCallingAssignment.countDocuments({ leadId: w.abc._id, status: 'active' })).toBe(1);
    expect(await CallNote.countDocuments({ leadId: w.abc._id, userId: w.amit._id })).toBe(2);
    expect(String((await Lead.findById(w.abc._id).lean()).assignedTo)).toBe(String(w.rahul._id));

    const row = (await mine(w.amitToken)).body.data[0];
    expect(row).toMatchObject({ bucket: 'hot', initial: { bucket: 'cold' }, originalSalesOwner: { name: 'Rahul' }, currentSalesOwner: { name: 'Rahul' } });
    expect(row.calls).toMatchObject({ count: 2, lastOutcome: 'ready_to_book' });
  });

  test('the agent can keep calling after the lead leaves Cold (the assignment is what authorizes it)', async () => {
    const w = await world();
    await endCall(w.amitToken, w.abc._id, call('discussed_package'));
    expect((await access(w.amitToken, w.abc._id)).status).toBe(200);
    expect((await endCall(w.amitToken, w.abc._id, call('requested_callback'))).status).toBe(201);
  });
});

describe('duplicate call protection (double click, retry, two tabs)', () => {
  test('the same call submitted twice returns the existing CallNote', async () => {
    const w = await world();
    const body = call('discussed_package');
    const first = await endCall(w.amitToken, w.abc._id, body);
    const second = await endCall(w.amitToken, w.abc._id, body);
    expect([first.status, second.status]).toEqual([201, 200]);
    expect(second.body.duplicate).toBe(true);
    expect(String(second.body._id)).toBe(String(first.body._id));
    expect(await CallNote.countDocuments()).toBe(1);
    expect((await Lead.findById(w.abc._id).lean()).callStats.count).toBe(1); // stats not double-counted
  });

  test('concurrent identical submissions create exactly one CallNote', async () => {
    const w = await world();
    const body = call('discussed_package');
    const responses = await Promise.all(Array.from({ length: 6 }, () => endCall(w.amitToken, w.abc._id, body)));
    expect(responses.map((r) => r.status).filter((s) => s !== 201 && s !== 200)).toEqual([]);
    expect(await CallNote.countDocuments()).toBe(1);
    expect(new Set(responses.map((r) => String(r.body._id))).size).toBe(1);
  });

  test('different calls (different start times) are different records', async () => {
    const w = await world();
    await endCall(w.amitToken, w.abc._id, call('cnp_same_day'));
    await endCall(w.amitToken, w.abc._id, call('cnp_same_day'));
    expect(await CallNote.countDocuments()).toBe(2);
  });

  test('the database enforces it for Cold Calling calls only (Sales calls are outside the index)', async () => {
    const w = await world();
    const startedAt = new Date('2026-09-21T09:00:00Z');
    const base = { leadId: w.abc._id, branchId: w.branch._id, userId: w.amit._id, outcome: 'discussed_package', startedAt };
    await CallNote.create({ ...base, callerRole: 'cold_calling' });
    await expect(CallNote.create({ ...base, callerRole: 'cold_calling' })).rejects.toThrow(/E11000|duplicate/i);
    await CallNote.create({ ...base, userId: w.rahul._id, callerRole: 'sales_executive' });
    await CallNote.create({ ...base, userId: w.rahul._id, callerRole: 'sales_executive' });
    await CallNote.create({ ...base, userId: w.rahul._id }); // legacy shape: no callerRole
  });
});

describe('Admin can inspect the calls under the existing rules', () => {
  test('Admin and the Sales owner see Amit’s calls on the lead, attributed to Amit; the lead timeline records them', async () => {
    const w = await world();
    await endCall(w.amitToken, w.abc._id, call('discussed_package', 200));
    const rahulToken = await tokenFor(w.rahul);
    for (const token of [w.adminToken, rahulToken]) {
      const res = await request(app).get(`/api/leads/${w.abc._id}/call-notes`).set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].userId).toMatchObject({ name: 'Amit Sharma', role: 'cold_calling' });
      expect(res.body.data[0].duration).toBe(200);
    }
    const timeline = await request(app).get(`/api/leads/${w.abc._id}/timeline`).set(auth(w.adminToken));
    expect(timeline.body.data.some((e) => e.type === 'call_note_added' && e.user === 'Amit Sharma')).toBe(true);
  });
});

describe('phone protection', () => {
  test('the number reaches the browser only through call-access; My Leads, history and status APIs never carry it', async () => {
    const w = await world();
    await endCall(w.amitToken, w.abc._id, call('discussed_package'));
    for (const body of [(await mine(w.amitToken)).body, (await history(w.amitToken, w.abc._id)).body]) {
      expect(JSON.stringify(body)).not.toContain(w.abc.phone);
      expect(JSON.stringify(body)).not.toMatch(/phone|whatsapp|email/i);
    }
    // Context the agent needs before calling (destination / travel date) is deliberate; call history has none of it.
    expect(JSON.stringify((await history(w.amitToken, w.abc._id)).body)).not.toMatch(/destination/i);
    expect((await access(w.amitToken, w.abc._id)).body.phone).toBe(w.abc.phone);
  });

  test('an Cold Calling call does NOT unlock the number for the Sales owner (gate is per assigned executive)', async () => {
    const w = await world();
    const { applyPhoneVisibilityGate } = require('../../src/utils/leadPhoneVisibility');
    await endCall(w.amitToken, w.abc._id, call('discussed_package'));
    const gated = await applyPhoneVisibilityGate({ ...(await Lead.findById(w.abc._id).lean()) });
    expect(gated.phone).toBe('XXXX');
    expect(gated.phoneVisible).toBe(false);
  });
});

describe('call reports do not mix ownership', () => {
  test('team-wide Call Report totals exclude Cold Calling calls; a per-user view includes them; owner is not credited', async () => {
    const w = await world();
    const { getAnalytics, getExecutiveSummary } = require('../../src/services/callReportService');
    await endCall(w.amitToken, w.abc._id, call('discussed_package', 120));
    // A Sales call by Rahul on his own lead (existing behaviour).
    const rahulToken = await tokenFor(w.rahul);
    expect((await request(app).post(`/api/leads/${w.other._id}/call-notes`).set(auth(rahulToken)).send(call('requested_callback', 60))).status).toBe(201);

    const period = { branchId: w.branch._id, dateFrom: '2000-01-01', dateTo: '2100-01-01' };
    const team = await getAnalytics(period);
    expect(team.byExecutive.map((row) => String(row.userId || row._id))).toEqual([String(w.rahul._id)]);
    const amitOnly = await getExecutiveSummary({ ...period, userId: w.amit._id });
    expect(amitOnly.totalCalls).toBe(1);
    const rahulOnly = await getExecutiveSummary({ ...period, userId: w.rahul._id });
    expect(rahulOnly.totalCalls).toBe(1); // Amit's call is not Rahul's
  });

  test('the data needed for later analytics is queryable: lead, caller, branch, start/end, duration, outcome', async () => {
    const w = await world();
    await endCall(w.amitToken, w.abc._id, call('discussed_package', 90));
    const [row] = await CallNote.aggregate([
      { $match: { userId: w.amit._id, branchId: w.branch._id, callerRole: 'cold_calling' } },
      { $project: { leadId: 1, userId: 1, branchId: 1, startedAt: 1, endedAt: 1, duration: 1, outcome: 1 } },
    ]);
    expect(row).toMatchObject({ duration: 90, outcome: 'discussed_package' });
    expect(row.startedAt).toBeInstanceOf(Date);
    expect(row.endedAt).toBeInstanceOf(Date);
  });
});

describe('Sales Executive and Admin calling are unchanged (regression)', () => {
  test('Sales Executive: call-access returns the number for their own lead only; the call is theirs, duration only from timestamps, follow-up still scheduled', async () => {
    const w = await world();
    const rahulToken = await tokenFor(w.rahul);
    const ok = await request(app).post(`/api/sales-executive/leads/${w.other._id}/call-access`).set(auth(rahulToken));
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ opened: true, phone: w.other.phone });
    const sippy = await makeUser('sales_executive', { branchId: w.branch._id });
    const notHis = await makeLead({ assignedTo: sippy._id, branchId: w.branch._id });
    expect((await request(app).post(`/api/sales-executive/leads/${notHis._id}/call-access`).set(auth(rahulToken))).status).toBe(404);

    const res = await request(app).post(`/api/leads/${w.other._id}/call-notes`).set(auth(rahulToken)).send({ ...call('discussed_package', 75), durationSeconds: 9999 });
    expect(res.status).toBe(201);
    const note = await CallNote.findOne({ leadId: w.other._id }).lean();
    expect(String(note.userId)).toBe(String(w.rahul._id));
    expect(note.callerRole).toBe('sales_executive');
    expect(note.duration).toBe(75);
    expect(await FollowUp.countDocuments({ lead: w.other._id })).toBe(1); // auto "+2h" reminder still created for Sales
    expect((await Lead.findById(w.other._id).lean()).callStats.count).toBe(1);
    // The same call twice is NOT de-duplicated for Sales (unchanged behaviour: the new rule is Cold-Calling-only).
    await request(app).post(`/api/leads/${w.other._id}/call-notes`).set(auth(rahulToken)).send({ ...call('discussed_package', 75) });
    expect(await CallNote.countDocuments({ leadId: w.other._id })).toBe(2);
  });

  test('Admin: still records a call with a typed-in duration (existing rule for non-executive roles)', async () => {
    const w = await world();
    const res = await request(app).post(`/api/leads/${w.other._id}/call-notes`).set(auth(w.adminToken)).send({ outcome: 'discussed_package', durationSeconds: 300 });
    expect(res.status).toBe(201);
    const note = await CallNote.findOne({ leadId: w.other._id }).lean();
    expect(note).toMatchObject({ duration: 300, callerRole: 'admin' });
    expect(String(note.userId)).toBe(String(w.admin._id));
  });
});

describe('query shape (no N+1)', () => {
  test('My Leads with 25 called leads costs one call-summary aggregation, not one per lead', async () => {
    const w = await world();
    const leads = [];
    for (let i = 0; i < 24; i += 1) leads.push(await makeLead({ assignedTo: w.rahul._id, branchId: w.branch._id }));
    expect((await w.assign(w.amit, leads)).status).toBe(201);
    for (const lead of leads.slice(0, 10)) await endCall(w.amitToken, lead._id, call('discussed_package'));

    const ops = [];
    mongoose.set('debug', (collection, method) => ops.push(`${collection}.${method}`));
    let res;
    try {
      res = await mine(w.amitToken, { limit: 25 });
    } finally {
      mongoose.set('debug', false);
    }
    expect(res.body.data).toHaveLength(25);
    expect(res.body.data.filter((r) => r.calls.count === 1)).toHaveLength(10);
    expect(ops.filter((o) => o.startsWith('callnotes.'))).toEqual(['callnotes.aggregate']);
    expect(ops.filter((o) => o.startsWith('leads.'))).toEqual([]); // the lead lookup happens inside the one assignments aggregation
  });
});

describe('My Leads context: destination, travel date and lifecycle', () => {
  const rowFor = async (w, lead) => (await mine(w.amitToken, { limit: 50 })).body.data.find((r) => String(r.lead._id) === String(lead._id));

  test('an active Cold lead returns its own destination and travel date, no lifecycle, and canCall', async () => {
    const w = await world();
    const travelDate = new Date('2026-10-14T00:00:00.000Z');
    await Lead.collection.updateOne({ _id: w.abc._id }, { $set: { destination: 'Manali', travelDate } });
    const row = await rowFor(w, w.abc);
    expect(row).toMatchObject({ bucket: 'cold', status: 'follow_up', statusReason: 'not_interested', lifecycle: null, canCall: true });
    expect(row.lead).toMatchObject({ name: 'ABC Travels', destination: 'Manali' });
    expect(new Date(row.lead.travelDate).toISOString()).toBe(travelDate.toISOString());
  });

  test('a Lost lead is still bucketed Cold by its reason, but reports lifecycle "lost" and cannot be called', async () => {
    const w = await world();
    for (const status of ['lost', 'booked_from_another_company']) {
      await Lead.updateOne({ _id: w.abc._id }, { $set: { status, statusReason: 'not_interested' } });
      const row = await rowFor(w, w.abc);
      expect([status, row.bucket, row.lifecycle, row.canCall, row.statusReason]).toEqual([status, 'cold', 'lost', false, 'not_interested']);
      expect(row.lead.destination).toBe('Goa'); // context stays visible on a closed lead
      expect((await access(w.amitToken, w.abc._id)).status).toBe(409); // the protection itself is unchanged
    }
  });

  test('a Converted lead reports lifecycle "converted" and cannot be called', async () => {
    const w = await world();
    await Lead.updateOne({ _id: w.abc._id }, { $set: { status: 'converted' } });
    const row = await rowFor(w, w.abc);
    expect(row).toMatchObject({ lifecycle: 'converted', canCall: false, bucket: 'unclassified' });
    expect((await endCall(w.amitToken, w.abc._id, call('discussed_package', 30))).status).toBe(409);
  });

  test('missing destination / travel date come back as null — nothing is invented', async () => {
    const w = await world();
    await Lead.collection.updateOne({ _id: w.abc._id }, { $set: { destination: '' }, $unset: { travelDate: '' } });
    const row = await rowFor(w, w.abc);
    expect(row.lead.destination).toBeNull();
    expect(row.lead.travelDate).toBeNull();
  });

  test('the extra fields cost nothing extra: still one assignments aggregation and one call summary for a page', async () => {
    const w = await world();
    const ops = [];
    mongoose.set('debug', (collection, method) => ops.push(`${collection}.${method}`));
    try {
      expect((await mine(w.amitToken)).status).toBe(200);
    } finally {
      mongoose.set('debug', false);
    }
    expect(ops.filter((o) => o === 'coldcallingassignments.aggregate')).toHaveLength(1);
    expect(ops.filter((o) => o === 'callnotes.aggregate')).toHaveLength(1);
    expect(ops.filter((o) => o.startsWith('leads.'))).toEqual([]);
  });
});
