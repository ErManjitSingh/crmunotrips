const request = require('supertest');
const mongoose = require('mongoose');
const db = require('../setup/db');

let app;
let User;
let Lead;
let Branch;
let UserSession;
let CallNote;
let LeadActivity;
let LeadStatusMovement;
let ColdCallingAssignment;
let generateToken;
let counter = 0;

const API = '/api/leads/analytics/cold-calling';
const ASSIGN = '/api/leads/analytics/executive-lead-status/cold-calling/assign';

beforeAll(async () => {
  await db.connect();
  app = require('../../src/server');
  User = require('../../src/models/User');
  Lead = require('../../src/models/Lead');
  Branch = require('../../src/models/Branch');
  UserSession = require('../../src/models/UserSession');
  CallNote = require('../../src/models/CallNote');
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
  return User.create({ name: overrides.name || `${role} ${counter}`, email: `an${counter}@example.com`, password: 'password123', role, ...overrides });
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
    leadId: `AN-${counter}`, name: `Lead ${counter}`, phone: `9${String(5000000000 + counter).slice(0, 9)}`, destination: 'Goa',
    createdBy: (await creator)._id, assignedAt: new Date(), status: 'follow_up', statusReason: 'not_interested', source: 'dpw', ...overrides,
  });
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const get = (t, url, q = {}, headers = {}) => request(app).get(url).query(q).set(auth(t)).set(headers);

let clock = Date.parse('2026-09-21T05:00:00.000Z');
const callBody = (outcome, seconds) => {
  clock += 3600 * 1000;
  return { outcome, startedAt: new Date(clock).toISOString(), endedAt: new Date(clock + seconds * 1000).toISOString(), notes: 'n' };
};
const coldCall = (t, leadId, outcome, seconds) =>
  request(app).post(`/api/cold-calling/leads/${leadId}/call-notes`).set(auth(t)).send(callBody(outcome, seconds));

const istDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/**
 * Mumbai: Amit has 5 leads, Ravi 3, plus 2 Cold leads nobody has sent to Cold Calling. Delhi: Zed has 1.
 *   a1 (dpw)      Amit: cnp(0s) -> discussed(120s) -> ready_to_book(60s)  => reached Warm and Hot, then CONVERTED
 *   a2 (dpw)      Amit: not_interested(30s)                               => still Cold
 *   a3 (referral) Amit: no Cold Calling call; Rahul (Sales) calls it       => Warm, but NOT worked by Cold Calling
 *   a4 (referral) Amit: requested_callback(90s) -> discussed(30s)          => Warm
 *   a5 (referral) Amit: never called; later LOST
 *   r1 (referral) Ravi: ready_to_book(200s)                                => Cold -> Hot directly
 *   r2 (referral) Ravi: invalid_number(10s)                                => Cold, "failed" outcome
 *   r3 (referral) Ravi: never called
 */
async function seed() {
  await require('../../src/services/leadStatusConfigService').getConfig({ force: true });
  const mumbai = await Branch.create({ name: 'Mumbai', code: 'MUM' });
  const delhi = await Branch.create({ name: 'Delhi', code: 'DEL' });
  const admin = await makeUser('admin', { name: 'Admin A' });
  const rahul = await makeUser('sales_executive', { name: 'Rahul', branchId: mumbai._id });
  const sippy = await makeUser('sales_executive', { name: 'Sippy', branchId: mumbai._id });
  const vikram = await makeUser('sales_executive', { name: 'Vikram', branchId: delhi._id });
  const amit = await makeUser('cold_calling', { name: 'Amit Sharma', branchId: mumbai._id });
  const ravi = await makeUser('cold_calling', { name: 'Ravi Caller', branchId: mumbai._id });
  const zed = await makeUser('cold_calling', { name: 'Zed Delhi', branchId: delhi._id });
  const adminToken = await tokenFor(admin);
  const [amitToken, raviToken, zedToken, rahulToken] = await Promise.all([tokenFor(amit), tokenFor(ravi), tokenFor(zed), tokenFor(rahul)]);

  const mk = (name, extra = {}) => makeLead({ name, assignedTo: rahul._id, branchId: mumbai._id, ...extra });
  const a1 = await mk('A1', { source: 'dpw' });
  const a2 = await mk('A2', { source: 'dpw' });
  const [a3, a4, a5, r1, r2, r3, u1, u2] = [
    await mk('A3', { source: 'referral' }), await mk('A4', { source: 'referral' }), await mk('A5', { source: 'referral' }),
    await mk('R1', { source: 'referral' }), await mk('R2', { source: 'referral' }), await mk('R3', { source: 'referral' }),
    await mk('U1'), await mk('U2'),
  ];
  const z1 = await makeLead({ name: 'Z1', assignedTo: vikram._id, branchId: delhi._id });

  const assign = (agent, leads, executive, headers = {}) =>
    request(app).post(ASSIGN).set(auth(adminToken)).set(headers)
      .send({ executiveId: String(executive._id), leadIds: leads.map((l) => String(l._id)), coldCallerId: String(agent._id) });
  expect((await assign(amit, [a1, a2, a3, a4, a5], rahul)).status).toBe(201);
  expect((await assign(ravi, [r1, r2, r3], rahul)).status).toBe(201);
  expect((await assign(zed, [z1], vikram, { 'x-branch-id': String(delhi._id) })).status).toBe(201);

  for (const [lead, outcome, seconds] of [[a1, 'cnp_same_day', 0], [a1, 'discussed_package', 120], [a1, 'ready_to_book', 60],
    [a2, 'not_interested', 30], [a4, 'requested_callback', 90], [a4, 'discussed_package', 30]]) {
    expect((await coldCall(amitToken, lead._id, outcome, seconds)).status).toBe(201);
  }
  for (const [lead, outcome, seconds] of [[r1, 'ready_to_book', 200], [r2, 'invalid_number', 10]]) {
    expect((await coldCall(raviToken, lead._id, outcome, seconds)).status).toBe(201);
  }
  expect((await coldCall(zedToken, z1._id, 'discussed_package', 45)).status).toBe(201);
  // A Sales Executive's own call on a3 (must not count as Cold Calling activity, but does move the lead).
  expect((await request(app).post(`/api/leads/${a3._id}/call-notes`).set(auth(rahulToken)).send(callBody('discussed_package', 75))).status).toBe(201);

  await Lead.updateOne({ _id: a1._id }, { $set: { status: 'converted', convertedAt: new Date() } });
  await Lead.updateOne({ _id: a5._id }, { $set: { status: 'lost', statusReason: 'booked_elsewhere' } });

  return { mumbai, delhi, admin, adminToken, rahul, sippy, vikram, amit, ravi, zed, amitToken, raviToken, zedToken, rahulToken, a1, a2, a3, a4, a5, r1, r2, r3, u1, u2, z1 };
}

const byName = (body, name) => body.agents.find((a) => a.name === name);
const mumbaiScope = (w) => ({ 'x-branch-id': String(w.mumbai._id) });

describe('authorization', () => {
  test('Admin only: Cold Calling, Sales Executive, Manager, other roles and anonymous are refused on every endpoint', async () => {
    const w = await seed();
    const urls = [API, `${API}/${w.amit._id}`, `${API}/${w.amit._id}/leads`];
    for (const url of urls) expect([url, (await get(w.adminToken, url, {}, mumbaiScope(w))).status]).toEqual([url, 200]);
    for (const user of [w.amit, w.rahul, await makeUser('sales_manager', { branchId: w.mumbai._id }), await makeUser('team_leader', { branchId: w.mumbai._id }),
      await makeUser('accountant', { branchId: w.mumbai._id }), await makeUser('lead_provider', { branchId: w.mumbai._id })]) {
      const token = await tokenFor(user);
      for (const url of urls) expect([user.role, url, (await get(token, url)).status]).toEqual([user.role, url, 403]);
    }
    for (const url of urls) expect((await request(app).get(url)).status).toBe(401);
  });
});

describe('metrics: every figure is derived from the records', () => {
  test('overview summary', async () => {
    const w = await seed();
    const res = await get(w.adminToken, API, {}, mumbaiScope(w));
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({
      totalColdLeads: 6, // Sales-pool Cold: A2, A5 (lost, but its reason is a Cold one), R2, R3, U1, U2 — same rule as the Sales tab
      assigned: 8,
      worked: 5, // A1, A2, A4, R1, R2 — A3 was only called by Sales
      unworked: 3, // A3, A5, R3
      workRate: 62.5,
      totalCalls: 8, // Amit 6 + Ravi 2 (Rahul's call is not Cold Calling)
      connectedCalls: 6, // A1: discussed+ready, A2, A4 x2, R1 (cnp = no answer, invalid_number = failed)
      avgCallDurationSec: 88, // connected calls with a duration: (120+60+30+90+30+200)/6 = 88.33
      talkTimeSec: 540, // 0+120+60+30+90+30+200+10
      callsPerLead: 1.6, // 8 calls / 5 worked leads
    });
  });

  test('the Cold pool equals the Sales Executive tab’s Cold total for the same filters', async () => {
    const w = await seed();
    const sales = await get(w.adminToken, '/api/leads/analytics/executive-lead-status', {}, mumbaiScope(w));
    const cold = await get(w.adminToken, API, {}, mumbaiScope(w));
    expect(cold.body.summary.totalColdLeads).toBe(sales.body.totals.cold);
    const withSource = await get(w.adminToken, API, { source: 'dpw' }, mumbaiScope(w));
    const salesSource = await get(w.adminToken, '/api/leads/analytics/executive-lead-status', { source: 'dpw' }, mumbaiScope(w));
    expect(withSource.body.summary.totalColdLeads).toBe(salesSource.body.totals.cold);
  });

  test('per-agent rows', async () => {
    const w = await seed();
    const { body } = await get(w.adminToken, API, {}, mumbaiScope(w));
    expect(body.agents.map((a) => a.name)).toEqual(['Amit Sharma', 'Ravi Caller']);
    expect(byName(body, 'Amit Sharma')).toMatchObject({
      assigned: 5, worked: 3, unworked: 2, workRate: 60, calls: 6, connected: 5, avgCallDurationSec: 66, callsPerLead: 2,
      coldToWarm: 3, coldToHot: 1, coldToWarmByAgent: 2, coldToHotByAgent: 1, converted: 1,
      status: { cold: 1, warm: 2, hot: 0, converted: 1, lost: 1, unclassified: 0 },
    });
    expect(byName(body, 'Ravi Caller')).toMatchObject({
      assigned: 3, worked: 2, unworked: 1, workRate: 66.7, calls: 2, connected: 1, avgCallDurationSec: 200,
      coldToWarm: 0, coldToHot: 1, converted: 0, status: { cold: 2, warm: 0, hot: 1, converted: 0, lost: 0, unclassified: 0 },
    });
  });

  test('status distribution, historical movement and still-cold are consistent with the assigned total', async () => {
    const w = await seed();
    const { body } = await get(w.adminToken, API, {}, mumbaiScope(w));
    const dist = Object.fromEntries(body.statusDistribution.map((d) => [d.key, d.count]));
    expect(dist).toEqual({ cold: 3, warm: 2, hot: 1, converted: 1, lost: 1, unclassified: 0 });
    expect(Object.values(dist).reduce((a, b) => a + b, 0)).toBe(body.summary.assigned);
    const moves = Object.fromEntries(body.statusMovements.map((m) => [m.key, m]));
    expect(moves.cold_to_warm).toMatchObject({ leads: 3, byAgent: 2 }); // A1, A4 (by Amit) + A3 (moved by Sales)
    expect(moves.cold_to_hot).toMatchObject({ leads: 2, byAgent: 2 }); // A1 (via Warm) and R1 (directly)
    expect(moves.cold_to_converted).toMatchObject({ leads: 1 });
    expect(moves.still_cold).toMatchObject({ leads: 3 });
  });

  test('history survives: Cold -> Warm -> Hot -> Converted stays visible although the lead is Converted now', async () => {
    const w = await seed();
    expect((await Lead.findById(w.a1._id).lean()).status).toBe('converted');
    const ledger = await LeadStatusMovement.find({ leadId: w.a1._id }).sort({ changedAt: 1 }).lean();
    expect(ledger.map((m) => m.movement)).toEqual(['cold_to_warm', 'warm_to_hot']); // conversion itself is not in the ledger
    const { body } = await get(w.adminToken, `${API}/${w.amit._id}`, {}, mumbaiScope(w));
    const moves = Object.fromEntries(body.statusMovements.map((m) => [m.key, m.leads]));
    expect(moves).toMatchObject({ cold_to_warm: 3, cold_to_hot: 1, cold_to_converted: 1 });
    // A1 counts as Warm AND Hot AND Converted history, yet is only "converted" in the current distribution.
    const rows = await get(w.adminToken, `${API}/${w.amit._id}/leads`, {}, mumbaiScope(w));
    const a1 = rows.body.data.find((r) => r.lead.name === 'A1');
    expect(a1).toMatchObject({ category: 'converted', movedToWarm: true, movedToHot: true });
  });

  test('call outcomes come from the existing CallNote outcomes and bucket rule', async () => {
    const w = await seed();
    const { body } = await get(w.adminToken, API, {}, mumbaiScope(w));
    const outcomes = Object.fromEntries(body.callOutcomes.map((o) => [o.outcome, o]));
    expect(Object.fromEntries(body.callOutcomes.map((o) => [o.outcome, o.calls]))).toEqual({
      discussed_package: 2, ready_to_book: 2, cnp_same_day: 1, not_interested: 1, requested_callback: 1, invalid_number: 1,
    });
    expect(outcomes.cnp_same_day.bucket).toBe('no_answer');
    expect(outcomes.invalid_number.bucket).toBe('failed');
    expect(outcomes.discussed_package.bucket).toBe('connected');
    expect(body.callOutcomes.reduce((s, o) => s + o.calls, 0)).toBe(body.summary.totalCalls);
    expect(body.callOutcomes[0].calls).toBeGreaterThanOrEqual(body.callOutcomes[1].calls); // largest first
  });

  test('empty state: no assignments, calls or movements gives honest zeros and null ratios (no divide by zero)', async () => {
    const mumbai = await Branch.create({ name: 'Mumbai', code: 'MUM' });
    const admin = await makeUser('admin');
    await makeUser('cold_calling', { name: 'Idle Agent', branchId: mumbai._id });
    const { body, status } = await get(await tokenFor(admin), API, {}, { 'x-branch-id': String(mumbai._id) });
    expect(status).toBe(200);
    expect(body.summary).toEqual({
      totalColdLeads: 0, assigned: 0, worked: 0, unworked: 0, workRate: null, totalCalls: 0, connectedCalls: 0, avgCallDurationSec: null, talkTimeSec: 0, callsPerLead: null,
    });
    expect(body.callOutcomes).toEqual([]);
    expect(body.statusMovements.map((m) => m.leads)).toEqual([0, 0, 0, 0]);
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0]).toMatchObject({ name: 'Idle Agent', assigned: 0, worked: 0, unworked: 0, workRate: null, calls: 0, avgCallDurationSec: null });
  });
});

describe('role separation and ownership', () => {
  test('a Sales Executive’s call is not a Cold Calling call; Cold Calling calls keep callerRole = cold_calling', async () => {
    const w = await seed();
    const notes = await CallNote.find({}).lean();
    expect(notes.filter((n) => n.callerRole === 'cold_calling')).toHaveLength(9); // 6 + 2 + Zed's 1
    expect(notes.filter((n) => n.callerRole === 'sales_executive')).toHaveLength(1);
    const { body } = await get(w.adminToken, API, {}, mumbaiScope(w));
    expect(body.summary.totalCalls).toBe(8);
    // ...and Sales performance reporting excludes the Cold Calling calls.
    const { getAnalytics, getExecutiveSummary } = require('../../src/services/callReportService');
    const period = { branchId: w.mumbai._id, dateFrom: '2000-01-01', dateTo: '2100-01-01' };
    expect((await getAnalytics(period)).byExecutive.map((r) => String(r.userId || r._id))).toEqual([String(w.rahul._id)]);
    expect((await getExecutiveSummary({ ...period, userId: w.rahul._id })).totalCalls).toBe(1);
  });

  test('calling never changes Lead.assignedTo; owner changes are shown, not credited: original Rahul, current Sippy, agent Amit', async () => {
    const w = await seed();
    for (const lead of [w.a1, w.a2, w.a3, w.a4, w.a5]) expect(String((await Lead.findById(lead._id).lean()).assignedTo)).toBe(String(w.rahul._id));
    await Lead.updateOne({ _id: w.a2._id }, { $set: { assignedTo: w.sippy._id, assignedAt: new Date() } });

    const before = await get(w.adminToken, API, {}, mumbaiScope(w));
    const rows = await get(w.adminToken, `${API}/${w.amit._id}/leads`, {}, mumbaiScope(w));
    const a2 = rows.body.data.find((r) => r.lead.name === 'A2');
    expect(a2.originalSalesOwner.name).toBe('Rahul');
    expect(a2.currentSalesOwner.name).toBe('Sippy');
    expect(a2.calls.count).toBe(1);
    // The agent's numbers do not follow the owner: Amit still has A2's call, Sippy has no Cold Calling activity.
    expect(byName(before.body, 'Amit Sharma').calls).toBe(6);
    expect(before.body.agents.map((a) => a.name)).not.toContain('Sippy');
  });

  test('assignment history is reporting data: a closed assignment is still counted, a deleted lead is not', async () => {
    const w = await seed();
    await ColdCallingAssignment.updateOne({ leadId: w.a4._id }, { $set: { status: 'closed' } });
    await Lead.updateOne({ _id: w.r3._id }, { $set: { isDeleted: true } });
    const { body } = await get(w.adminToken, API, {}, mumbaiScope(w));
    expect(body.summary.assigned).toBe(7); // R3 deleted; A4 (closed) still reported
    expect(byName(body, 'Amit Sharma')).toMatchObject({ assigned: 5, calls: 6 });
    expect(await ColdCallingAssignment.countDocuments()).toBe(9);
  });
});

describe('branch isolation', () => {
  test('a branch-scoped Admin sees only that branch; an Admin scoped to Delhi cannot read a Mumbai agent', async () => {
    const w = await seed();
    const mumbai = (await get(w.adminToken, API, {}, mumbaiScope(w))).body;
    expect(mumbai.agents.map((a) => a.name).sort()).toEqual(['Amit Sharma', 'Ravi Caller']);
    expect(mumbai.summary.assigned).toBe(8);

    const delhi = (await get(w.adminToken, API, {}, { 'x-branch-id': String(w.delhi._id) })).body;
    expect(delhi.agents.map((a) => a.name)).toEqual(['Zed Delhi']);
    expect(delhi.summary).toMatchObject({ assigned: 1, worked: 1, totalCalls: 1 });
    expect(delhi.filters.branchId).toBe(String(w.delhi._id));

    const cross = await get(w.adminToken, `${API}/${w.amit._id}`, {}, { 'x-branch-id': String(w.delhi._id) });
    expect(cross.status).toBe(404);
    expect((await get(w.adminToken, `${API}/${w.amit._id}/leads`, {}, { 'x-branch-id': String(w.delhi._id) })).status).toBe(404);
    const all = (await get(w.adminToken, API)).body; // org-wide Admin without a branch scope sees both
    expect(all.summary.assigned).toBe(9);
  });
});

describe('filters', () => {
  test('period is the Cold Calling assignment date (IST calendar days)', async () => {
    const w = await seed();
    await ColdCallingAssignment.updateMany({ coldCallerId: w.ravi._id }, { $set: { assignedAt: new Date(Date.now() - 10 * 86400000) } });
    const today = await get(w.adminToken, API, { dateFrom: istDay(), dateTo: istDay() }, mumbaiScope(w));
    expect(today.body.agents.map((a) => [a.name, a.assigned])).toEqual([['Amit Sharma', 5], ['Ravi Caller', 0]]);
    expect(today.body.period).toMatchObject({ dateFrom: istDay(), dateTo: istDay(), timezone: 'Asia/Kolkata' });
    const past = await get(w.adminToken, API, { dateFrom: istDay(-11), dateTo: istDay(-9) }, mumbaiScope(w));
    expect(past.body.summary.assigned).toBe(3);
    const future = await get(w.adminToken, API, { dateFrom: istDay(1), dateTo: istDay(2) }, mumbaiScope(w));
    expect(future.body.summary).toMatchObject({ assigned: 0, worked: 0, totalCalls: 0, workRate: null });
  });

  test('agent, source and combinations filter every section consistently', async () => {
    const w = await seed();
    const agent = (await get(w.adminToken, API, { agentId: String(w.ravi._id) }, mumbaiScope(w))).body;
    expect(agent.agents.map((a) => a.name)).toEqual(['Ravi Caller']);
    expect(agent.summary).toMatchObject({ assigned: 3, worked: 2, totalCalls: 2 });
    expect(agent.callOutcomes.reduce((s, o) => s + o.calls, 0)).toBe(2);
    expect(agent.statusMovements.find((m) => m.key === 'cold_to_hot').leads).toBe(1);

    const dpw = (await get(w.adminToken, API, { source: 'dpw' }, mumbaiScope(w))).body;
    expect(dpw.summary).toMatchObject({ assigned: 2, worked: 2, totalCalls: 4, connectedCalls: 3 }); // A1 (3 calls) + A2 (1)
    expect(byName(dpw, 'Ravi Caller')).toMatchObject({ assigned: 0, calls: 0 });
    const both = (await get(w.adminToken, API, { source: 'referral', agentId: String(w.amit._id) }, mumbaiScope(w))).body;
    expect(both.summary).toMatchObject({ assigned: 3, worked: 1, totalCalls: 2 }); // A3, A4, A5
    expect(both.filters).toMatchObject({ source: 'referral', agentId: String(w.amit._id) });
  });

  test.each([
    ['bad date', { dateFrom: 'yesterday' }],
    ['impossible date', { dateFrom: '2026-02-31' }],
    ['from after to', { dateFrom: '2026-09-22', dateTo: '2026-09-21' }],
    ['bad agent id', { agentId: 'nope' }],
    ['operator injection in agent', { 'agentId[$ne]': '1' }],
    ['unknown source', { source: 'made-up' }],
  ])('rejects %s with 400', async (_label, query) => {
    const w = await seed();
    expect((await get(w.adminToken, API, query, mumbaiScope(w))).status).toBe(400);
  });
});

describe('agent detail', () => {
  test('overview, distribution, movements, outcomes and recent calls for one agent', async () => {
    const w = await seed();
    const { status, body } = await get(w.adminToken, `${API}/${w.amit._id}`, {}, mumbaiScope(w));
    expect(status).toBe(200);
    expect(body.agent).toMatchObject({ name: 'Amit Sharma', active: true });
    expect(body.summary).toMatchObject({ assigned: 5, worked: 3, unworked: 2, workRate: 60, totalCalls: 6, connectedCalls: 5, avgCallDurationSec: 66, callsPerLead: 2 });
    expect(body.summary).not.toHaveProperty('totalColdLeads');
    expect(body.callOutcomes.reduce((s, o) => s + o.calls, 0)).toBe(6);
    expect(body.recentCalls).toHaveLength(6);
    expect(body.recentCalls[0].startedAt >= body.recentCalls[5].startedAt).toBe(true); // newest first
    expect(JSON.stringify(body.recentCalls)).not.toMatch(/Rahul|Ravi/);
  });

  test('recent calls are capped at 10', async () => {
    const w = await seed();
    for (let i = 0; i < 8; i += 1) await coldCall(w.amitToken, w.a2._id, 'not_interested', 20);
    const { body } = await get(w.adminToken, `${API}/${w.amit._id}`, {}, mumbaiScope(w));
    expect(body.recentCalls).toHaveLength(10);
    expect(body.summary.totalCalls).toBe(14);
  });

  test('an id that is not a Cold Calling agent is a 404 (Sales Executive, Admin, unknown)', async () => {
    const w = await seed();
    for (const id of [w.rahul._id, w.admin._id, new mongoose.Types.ObjectId()]) {
      expect((await get(w.adminToken, `${API}/${id}`, {}, mumbaiScope(w))).status).toBe(404);
    }
    expect((await get(w.adminToken, `${API}/not-an-id`, {}, mumbaiScope(w))).status).toBe(400);
  });
});

describe('lead-level drill-down', () => {
  test('rows carry lead, both owners, calls, last call, current status and reason — and never a phone number', async () => {
    const w = await seed();
    const { body } = await get(w.adminToken, `${API}/${w.amit._id}/leads`, {}, mumbaiScope(w));
    expect(body.pagination).toMatchObject({ total: 5, page: 1 });
    const a4 = body.data.find((r) => r.lead.name === 'A4');
    expect(a4).toMatchObject({
      category: 'warm', statusReason: 'discussed_package', assignmentStatus: 'active',
      originalSalesOwner: { name: 'Rahul' }, currentSalesOwner: { name: 'Rahul' },
      calls: { count: 2, connected: 2, lastOutcome: 'discussed_package' }, movedToWarm: true, movedToHot: false,
    });
    expect(a4.calls.lastCallAt).toBeTruthy();
    expect(a4.assignedAt).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/phone|whatsapp|"9\d{9}"/i);
    const untouched = body.data.find((r) => r.lead.name === 'A5');
    expect(untouched).toMatchObject({ category: 'lost', calls: { count: 0, lastCallAt: null, lastOutcome: '' } });
  });

  test('paginates deterministically without repeats or gaps', async () => {
    const w = await seed();
    const pages = [];
    for (const page of [1, 2, 3, 4]) pages.push(await get(w.adminToken, `${API}/${w.amit._id}/leads`, { page, limit: 2 }, mumbaiScope(w)));
    expect(pages.map((p) => p.body.data.length)).toEqual([2, 2, 1, 0]);
    expect(pages[0].body.pagination).toMatchObject({ total: 5, totalPages: 3, limit: 2 });
    const ids = pages.flatMap((p) => p.body.data.map((r) => r.lead._id));
    expect(new Set(ids).size).toBe(5);
    const single = (await get(w.adminToken, `${API}/${w.amit._id}/leads`, { limit: 100 }, mumbaiScope(w))).body.data.map((r) => r.lead._id);
    expect(ids).toEqual(single);
    expect((await get(w.adminToken, `${API}/${w.amit._id}/leads`, { limit: 100000 }, mumbaiScope(w))).body.pagination.limit).toBe(100);
  });

  test('status and Worked/Unworked filters, with matching totals', async () => {
    const w = await seed();
    const q = (extra) => get(w.adminToken, `${API}/${w.amit._id}/leads`, extra, mumbaiScope(w));
    expect((await q({ category: 'warm' })).body.data.map((r) => r.lead.name).sort()).toEqual(['A3', 'A4']);
    expect((await q({ category: 'converted' })).body.pagination.total).toBe(1);
    expect((await q({ activity: 'worked' })).body.data.map((r) => r.lead.name).sort()).toEqual(['A1', 'A2', 'A4']);
    const unworked = await q({ activity: 'unworked', limit: 1 });
    expect(unworked.body.pagination.total).toBe(2); // A3 (Sales-only call) and A5
    expect(unworked.body.data).toHaveLength(1);
    expect((await q({ activity: 'worked', category: 'warm' })).body.data.map((r) => r.lead.name)).toEqual(['A4']);
    expect((await q({ category: 'bogus' })).status).toBe(400);
    expect((await q({ activity: 'bogus' })).status).toBe(400);
  });
});

describe('call history stays complete', () => {
  test('every call is its own record and Admin can read them all with caller, date, duration and outcome', async () => {
    const w = await seed();
    const res = await get(w.adminToken, `/api/leads/${w.a1._id}/call-notes`, {}, mumbaiScope(w));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data.map((c) => [c.userId.name, c.duration, c.outcome]).sort())
      .toEqual([['Amit Sharma', 0, 'cnp_same_day'], ['Amit Sharma', 120, 'discussed_package'], ['Amit Sharma', 60, 'ready_to_book']]);
    expect(res.body.data.every((c) => c.startedAt && c.userId.role === 'cold_calling')).toBe(true);
    // A3: the Sales call sits beside Cold Calling's absence — different caller, different role.
    const a3 = await get(w.adminToken, `/api/leads/${w.a3._id}/call-notes`, {}, mumbaiScope(w));
    expect(a3.body.data.map((c) => c.userId.role)).toEqual(['sales_executive']);
  });
});

describe('calling eligibility ends with the lead, history does not', () => {
  const access = (t, id) => request(app).post(`/api/cold-calling/leads/${id}/call-access`).set(auth(t));

  test('converted and lost leads can no longer be called, but stay listed, counted and readable', async () => {
    const w = await seed();
    for (const lead of [w.a1, w.a5]) { // converted, lost
      expect([lead.name, (await access(w.amitToken, lead._id)).status]).toEqual([lead.name, 409]);
      expect((await coldCall(w.amitToken, lead._id, 'discussed_package', 30)).status).toBe(409);
    }
    const history = await request(app).get(`/api/cold-calling/leads/${w.a1._id}/call-history`).set(auth(w.amitToken));
    expect(history.status).toBe(200);
    expect(history.body.pagination.total).toBe(3);
    const mine = (await request(app).get('/api/cold-calling/my-leads').set(auth(w.amitToken))).body.data;
    expect(mine.find((r) => r.lead.name === 'A1')).toMatchObject({ canCall: false, calls: { count: 3 } });
    expect(mine.find((r) => r.lead.name === 'A4').canCall).toBe(true);
    expect(await CallNote.countDocuments({ leadId: w.a1._id })).toBe(3);
    // A live lead is unaffected, and a lead that comes back to life can be called again.
    expect((await access(w.amitToken, w.a4._id)).status).toBe(200);
    await Lead.updateOne({ _id: w.a5._id }, { $set: { status: 'follow_up' } });
    expect((await access(w.amitToken, w.a5._id)).status).toBe(200);
  });
});

describe('Executive Activity analytics keeps Cold Calling out of Sales activity', () => {
  test('Cold Calling timeline activity carries the actor role and is excluded from team-wide activity, not from the agent’s own view', async () => {
    const w = await seed();
    const cold = await LeadActivity.find({ type: 'call_note_added', actorId: w.amit._id }).lean();
    expect(cold.length).toBe(6);
    expect(cold.every((a) => a.actorRole === 'cold_calling')).toBe(true);
    const sales = await LeadActivity.findOne({ type: 'call_note_added', actorId: w.rahul._id }).lean();
    expect(sales.actorRole).toBe('sales_executive');

    const { getActivityAnalytics } = require('../../src/services/executiveActivityService');
    const period = { branchId: w.mumbai._id, dateFrom: '2000-01-01', dateTo: '2100-01-01' };
    const team = await getActivityAnalytics(period);
    const teamActors = JSON.stringify(team);
    expect(teamActors).toContain(String(w.rahul._id));
    expect(teamActors).not.toContain(String(w.amit._id));
    expect(teamActors).not.toContain(String(w.ravi._id));
    const amitOnly = await getActivityAnalytics({ ...period, userId: w.amit._id });
    expect(JSON.stringify(amitOnly)).toContain(String(w.amit._id));
  });
});

describe('first contact semantics are unchanged', () => {
  test('firstContactAt stays "first contact by anyone": set once by the first call, never overwritten by a later one', async () => {
    const w = await seed();
    const fresh = await makeLead({ name: 'Fresh', assignedTo: w.rahul._id, branchId: w.mumbai._id });
    expect((await Lead.findById(fresh._id).lean()).firstContactAt || null).toBeNull();
    await request(app).post(ASSIGN).set(auth(w.adminToken)).send({ executiveId: String(w.rahul._id), leadIds: [String(fresh._id)], coldCallerId: String(w.amit._id) });
    expect((await coldCall(w.amitToken, fresh._id, 'not_interested', 20)).status).toBe(201);
    const first = (await Lead.findById(fresh._id).lean()).firstContactAt;
    expect(first).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 15));
    await coldCall(w.amitToken, fresh._id, 'not_interested', 20);
    expect((await Lead.findById(fresh._id).lean()).firstContactAt.getTime()).toBe(first.getTime());
  });
});

describe('existing Executive Lead Status is untouched', () => {
  test('the Sales overview and drill-down still return their original shape and totals', async () => {
    const w = await seed();
    const overview = await get(w.adminToken, '/api/leads/analytics/executive-lead-status', {}, mumbaiScope(w));
    expect(overview.status).toBe(200);
    expect(Object.keys(overview.body).sort()).toEqual(['executives', 'filters', 'otherOwnersAssigned', 'period', 'totals']);
    const rahul = overview.body.executives.find((e) => e.name === 'Rahul');
    expect(rahul.assigned).toBe(rahul.cold + rahul.warm + rahul.hot + rahul.unclassified);
    const drill = await get(w.adminToken, `/api/leads/analytics/executive-lead-status/${w.rahul._id}/leads`, {}, mumbaiScope(w));
    expect(drill.status).toBe(200);
    expect(drill.body.data.find((l) => l.name === 'A2').coldCalling).toMatchObject({ coldCallerName: 'Amit Sharma' });
  });
});

describe('query shape (no N+1)', () => {
  const measure = async (fn) => {
    const ops = [];
    mongoose.set('debug', (collection, method) => ops.push(`${collection}.${method}`));
    try {
      await fn();
    } finally {
      mongoose.set('debug', false);
    }
    return ops;
  };

  test('overview: one cohort aggregation, one pool count and at most two user reads — whatever the number of agents and leads', async () => {
    const w = await seed();
    for (let i = 0; i < 5; i += 1) await makeUser('cold_calling', { name: `Extra ${i}`, branchId: w.mumbai._id });
    const ops = await measure(async () => expect((await get(w.adminToken, API, {}, mumbaiScope(w))).status).toBe(200));
    expect(ops.filter((o) => o === 'coldcallingassignments.aggregate')).toHaveLength(1);
    expect(ops.filter((o) => o === 'leads.aggregate')).toHaveLength(1);
    expect(ops.filter((o) => o.startsWith('users.'))).toHaveLength(1);
    expect(ops.filter((o) => /^(callnotes|leadstatusmovements|leads)\.(find|findone|count|distinct)/i.test(o))).toEqual([]);
  });

  test('agent detail and lead pages are a fixed handful of operations', async () => {
    const w = await seed();
    const detail = await measure(async () => get(w.adminToken, `${API}/${w.amit._id}`, {}, mumbaiScope(w)));
    expect(detail.filter((o) => o === 'coldcallingassignments.aggregate')).toHaveLength(1);
    expect(detail.filter((o) => o === 'callnotes.find')).toHaveLength(1); // recent calls
    expect(detail.length).toBeLessThanOrEqual(6);
    const leads = await measure(async () => get(w.adminToken, `${API}/${w.amit._id}/leads`, { limit: 25 }, mumbaiScope(w)));
    expect(leads.filter((o) => o === 'coldcallingassignments.aggregate')).toHaveLength(1);
    expect(leads.filter((o) => o.startsWith('callnotes.') || o.startsWith('leadstatusmovements.'))).toEqual([]);
  });
});

describe('history is not lost when an agent is removed', () => {
  test('a deleted agent keeps a row named from the assignment snapshot, with their numbers intact', async () => {
    const w = await seed();
    await User.deleteOne({ _id: w.ravi._id });
    const { body } = await get(w.adminToken, API, {}, mumbaiScope(w));
    const ravi = body.agents.find((a) => a.name === 'Ravi Caller');
    expect(ravi).toMatchObject({ assigned: 3, worked: 2, calls: 2 });
    expect(body.summary.assigned).toBe(8);
  });
});
