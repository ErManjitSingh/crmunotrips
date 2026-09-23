const request = require('supertest');
const mongoose = require('mongoose');
const db = require('../setup/db');
const { waitFor } = require('../setup/waitFor');

let app;
let User;
let Lead;
let Branch;
let UserSession;
let LeadActivity;
let ColdCallingAssignment;
let generateToken;
let counter = 0;

const BASE = '/api/leads/analytics/executive-lead-status/cold-calling';
const ASSIGN = `${BASE}/assign`;
const AGENTS = `${BASE}/agents`;

beforeAll(async () => {
  await db.connect();
  app = require('../../src/server');
  User = require('../../src/models/User');
  Lead = require('../../src/models/Lead');
  Branch = require('../../src/models/Branch');
  UserSession = require('../../src/models/UserSession');
  LeadActivity = require('../../src/models/LeadActivity');
  ColdCallingAssignment = require('../../src/models/ColdCallingAssignment');
  ({ generateToken } = require('../../src/middleware/auth'));
  await ColdCallingAssignment.init(); // build the unique partial index the concurrency guarantees rely on
});

afterEach(async () => {
  await db.clearCollections();
  require('../../src/services/leadStatusConfigService').invalidateCache();
});

afterAll(async () => {
  await db.disconnect();
});

const COLD = 'not_interested';
const COLD_REASONS = ['cnp_placeholder', 'not_interested', 'booked_elsewhere', 'budget_issues'];
void COLD_REASONS;

async function makeUser(role, overrides = {}) {
  counter += 1;
  return User.create({ name: overrides.name || `${role} ${counter}`, email: `cc${counter}@example.com`, password: 'password123', role, ...overrides });
}
async function tokenFor(user) {
  const session = await UserSession.create({
    userId: user._id, sessionId: new mongoose.Types.ObjectId().toString(), role: user.role, status: 'active', loginAt: new Date(), lastActivityAt: new Date(),
  });
  return generateToken(user._id, user.role, session.sessionId);
}
async function makeBranch(name) {
  counter += 1;
  return Branch.create({ name, code: `CB${counter}` });
}
let creator;
async function makeLead(overrides = {}) {
  counter += 1;
  const n = counter;
  if (!creator) creator = makeUser('admin', { name: 'Creator' });
  return Lead.create({
    leadId: `CC-${n}`, name: `Lead ${n}`, phone: `9${String(3000000000 + n).slice(0, 9)}`, destination: 'Goa',
    createdBy: (await creator)._id, assignedAt: new Date(), status: 'follow_up', statusReason: COLD, ...overrides,
  });
}
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const post = (t, body, headers = {}) => request(app).post(ASSIGN).set(auth(t)).set(headers).send(body);
const ids = (leads) => leads.map((l) => String(l._id));

/** A Mumbai world: admin, executive Rahul, cold caller Amit, and a few Cold leads owned by Rahul. */
async function world({ leadCount = 3 } = {}) {
  // Seed the default status config once, up front: its lazy first-read seeding is not concurrency-safe on an empty DB.
  await require('../../src/services/leadStatusConfigService').getConfig({ force: true });
  const branch = await makeBranch(`Mumbai ${counter + 1}`);
  const admin = await makeUser('admin', { name: 'Admin A' });
  const rahul = await makeUser('sales_executive', { name: 'Rahul', branchId: branch._id });
  const amit = await makeUser('cold_calling', { name: 'Amit Sharma', branchId: branch._id });
  const leads = [];
  for (let i = 0; i < leadCount; i += 1) leads.push(await makeLead({ assignedTo: rahul._id, branchId: branch._id }));
  return { branch, admin, adminToken: await tokenFor(admin), rahul, amit, leads };
}

describe('authorization', () => {
  test('Admin can assign and list agents; every other role (incl. Cold Calling) is forbidden; anonymous is 401', async () => {
    const w = await world();
    expect((await request(app).get(AGENTS).set(auth(w.adminToken))).status).toBe(200);
    expect((await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(w.amit._id) })).status).toBe(201);

    for (const role of ['sales_manager', 'team_leader', 'sales_executive', 'cold_calling', 'lead_provider', 'accountant']) {
      const user = await makeUser(role, { branchId: w.branch._id });
      const token = await tokenFor(user);
      const res = await post(token, { executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(w.amit._id) });
      expect([role, res.status]).toEqual([role, 403]);
      expect([role, (await request(app).get(AGENTS).set(auth(token))).status]).toEqual([role, 403]);
    }
    expect((await request(app).post(ASSIGN).send({})).status).toBe(401);
  });
});

describe('a Cold Calling assignment is NOT a Sales ownership transfer', () => {
  test('creates one assignment per lead with the full snapshot, and never writes to the Lead', async () => {
    const w = await world({ leadCount: 3 });
    const before = await Lead.find({ _id: { $in: w.leads.map((l) => l._id) } }).lean();

    const res = await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(w.amit._id) });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ assignedCount: 3, alreadyAssignedCount: 0, coldCaller: { name: 'Amit Sharma' } });

    const docs = await ColdCallingAssignment.find({}).lean();
    expect(docs).toHaveLength(3);
    for (const doc of docs) {
      expect(doc).toMatchObject({
        originalSalesOwnerName: 'Rahul', coldCallerName: 'Amit Sharma', initialBucket: 'cold', initialStatusReason: COLD,
        status: 'active', assignedByName: 'Admin A',
      });
      expect(String(doc.originalSalesOwnerId)).toBe(String(w.rahul._id));
      expect(String(doc.coldCallerId)).toBe(String(w.amit._id));
      expect(String(doc.assignedBy)).toBe(String(w.admin._id));
      expect(String(doc.branchId)).toBe(String(w.branch._id));
      expect(doc.assignedAt).toBeInstanceOf(Date);
    }

    const after = await Lead.find({ _id: { $in: w.leads.map((l) => l._id) } }).lean();
    expect(after).toEqual(before); // byte-for-byte: assignedTo, assignedAt, updatedAt, everything
    after.forEach((lead) => expect(String(lead.assignedTo)).toBe(String(w.rahul._id)));
  });

  test('is audited on each lead\'s timeline (who, which agent, which owner)', async () => {
    const w = await world({ leadCount: 2 });
    await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(w.amit._id) });
    await waitFor(async () => (await LeadActivity.countDocuments({ type: 'cold_calling_assigned' })) === 2);
    const activity = await LeadActivity.findOne({ type: 'cold_calling_assigned' }).lean();
    expect(activity).toMatchObject({ actorName: 'Admin A', title: 'Assigned to Cold Calling' });
    expect(activity.description).toMatch(/Amit Sharma/);
    expect(activity.description).toMatch(/Rahul/);
  });

  test('history survives: Sales owner Rahul -> Sippy, then Cold -> Warm -> Unclassified -> converted -> deleted', async () => {
    const w = await world({ leadCount: 1 });
    const sippy = await makeUser('sales_executive', { name: 'Sippy', branchId: w.branch._id });
    const [lead] = w.leads;
    await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(w.amit._id) });
    const original = await ColdCallingAssignment.findOne({ leadId: lead._id }).lean();

    const steps = [
      { assignedTo: sippy._id, assignedAt: new Date() }, // Day 10: Rahul -> Sippy
      { statusReason: 'requested_callback' }, // Cold -> Warm
      { statusReason: 'ready_to_book' }, // -> Hot
      { statusReason: '' }, // -> Unclassified
      { status: 'converted' },
      { isDeleted: true },
    ];
    for (const patch of steps) {
      await Lead.updateOne({ _id: lead._id }, { $set: patch });
      const doc = await ColdCallingAssignment.find({ leadId: lead._id }).lean();
      expect(doc).toHaveLength(1);
      expect(doc[0]).toEqual(original); // untouched, field for field
    }
    const fresh = await Lead.findById(lead._id).lean();
    expect(String(fresh.assignedTo)).toBe(String(sippy._id)); // current owner changed...
    expect(String(original.originalSalesOwnerId)).toBe(String(w.rahul._id)); // ...history did not
    expect(original).toMatchObject({ originalSalesOwnerName: 'Rahul', initialBucket: 'cold', initialStatusReason: COLD });
  });

  test('the initial reason is the raw key at assignment time, not re-derived from later config', async () => {
    const svc = require('../../src/services/leadStatusConfigService');
    const w = await world({ leadCount: 1 });
    await Lead.updateOne({ _id: w.leads[0]._id }, { $set: { statusReason: 'booked_elsewhere: sold to a rival' } });
    await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(w.amit._id) });
    const cfg = await svc.getConfig({ includeDisabled: true, force: true });
    await svc.saveConfig({ ...cfg, cold: cfg.cold.filter((o) => o.key !== 'booked_elsewhere') }, w.admin._id);
    const doc = await ColdCallingAssignment.findOne({}).lean();
    expect(doc.initialStatusReason).toBe('booked_elsewhere: sold to a rival');
    expect(doc.initialBucket).toBe('cold');
  });
});

describe('server-side validation (nothing is trusted from the client)', () => {
  const body = (w, extra = {}) => ({ executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(w.amit._id), ...extra });
  const noDocs = async () => expect(await ColdCallingAssignment.countDocuments()).toBe(0);

  test.each([
    ['missing lead ids', { leadIds: undefined }],
    ['empty lead ids', { leadIds: [] }],
    ['lead ids not an array', { leadIds: 'abc' }],
    ['malformed lead id', { leadIds: ['nope'] }],
    ['operator injection in lead id', { leadIds: [{ $ne: null }] }],
    ['malformed executive', { executiveId: 'x' }],
    ['operator injection in executive', { executiveId: { $ne: null } }],
    ['malformed cold caller', { coldCallerId: 'x' }],
    ['missing cold caller', { coldCallerId: undefined }],
  ])('rejects %s with 400 and creates nothing', async (_label, override) => {
    const w = await world({ leadCount: 1 });
    const res = await post(w.adminToken, body(w, override));
    expect(res.status).toBe(400);
    await noDocs();
  });

  test('rejects more than 200 leads', async () => {
    const w = await world({ leadCount: 1 });
    const many = Array.from({ length: 201 }, () => String(new mongoose.Types.ObjectId()));
    expect((await post(w.adminToken, body(w, { leadIds: many }))).status).toBe(400);
  });

  test('unknown executive id is 404', async () => {
    const w = await world({ leadCount: 1 });
    expect((await post(w.adminToken, body(w, { executiveId: String(new mongoose.Types.ObjectId()) }))).status).toBe(404);
    expect((await post(w.adminToken, body(w, { executiveId: String(w.amit._id) }))).status).toBe(404); // not a sales executive
  });

  test('the target must be an ACTIVE user whose role is cold_calling', async () => {
    const w = await world({ leadCount: 1 });
    const inactive = await makeUser('cold_calling', { branchId: w.branch._id, status: 'disabled' });
    const other = await makeUser('sales_executive', { branchId: w.branch._id });
    for (const target of [inactive, other, w.admin, w.rahul, { _id: new mongoose.Types.ObjectId() }]) {
      const res = await post(w.adminToken, body(w, { coldCallerId: String(target._id) }));
      expect([String(target._id), res.status]).toEqual([String(target._id), 400]);
    }
    await noDocs();
  });

  test('only currently-Cold leads qualify: Warm / Hot / Unclassified / converted / stale reasons are rejected, all-or-nothing', async () => {
    const w = await world({ leadCount: 1 });
    const mk = (over) => makeLead({ assignedTo: w.rahul._id, branchId: w.branch._id, ...over });
    const warm = await mk({ statusReason: 'requested_callback' });
    const hot = await mk({ statusReason: 'ready_to_book' });
    const none = await mk({ statusReason: '' });
    const converted = await mk({ status: 'converted', statusReason: COLD });
    const isHotFlag = await mk({ statusReason: '', isHot: true, temperature: 'cold' }); // temperature/isHot must not matter
    const res = await post(w.adminToken, body(w, { leadIds: ids([...w.leads, warm, hot, none, converted, isHotFlag]) }));
    expect(res.status).toBe(409);
    const byLead = Object.fromEntries(res.body.failures.map((f) => [f.leadId, f]));
    expect(Object.keys(byLead)).toHaveLength(5);
    expect(byLead[String(warm._id)]).toMatchObject({ code: 'not_cold', currentBucket: 'warm' });
    expect(byLead[String(hot._id)]).toMatchObject({ code: 'not_cold', currentBucket: 'hot' });
    expect(byLead[String(none._id)]).toMatchObject({ code: 'not_cold', currentBucket: 'unclassified' });
    expect(byLead[String(converted._id)].code).toBe('not_cold');
    expect(byLead[String(isHotFlag._id)].code).toBe('not_cold');
    await noDocs(); // the valid Cold lead in the same request was NOT assigned
  });

  test('a lead that is not owned by the stated executive, deleted, or missing is rejected', async () => {
    const w = await world({ leadCount: 1 });
    const sippy = await makeUser('sales_executive', { branchId: w.branch._id });
    const owned = await makeLead({ assignedTo: sippy._id, branchId: w.branch._id });
    const gone = await makeLead({ assignedTo: w.rahul._id, branchId: w.branch._id, isDeleted: true });
    const unassigned = await makeLead({ assignedTo: null, branchId: w.branch._id });
    const ghost = String(new mongoose.Types.ObjectId());
    const res = await post(w.adminToken, body(w, { leadIds: [...ids(w.leads), String(owned._id), String(gone._id), String(unassigned._id), ghost] }));
    expect(res.status).toBe(409);
    const codes = Object.fromEntries(res.body.failures.map((f) => [f.leadId, f.code]));
    expect(codes).toEqual({ [String(owned._id)]: 'owner_changed', [String(gone._id)]: 'deleted', [String(unassigned._id)]: 'owner_changed', [ghost]: 'not_found' });
    await noDocs();
  });

  test('branch isolation: cross-branch lead and cross-branch agent both fail', async () => {
    const w = await world({ leadCount: 1 });
    const other = await makeBranch('Delhi');
    const delhiExec = await makeUser('sales_executive', { name: 'Delhi Exec', branchId: other._id });
    const delhiLead = await makeLead({ assignedTo: delhiExec._id, branchId: other._id });
    const delhiAgent = await makeUser('cold_calling', { name: 'Delhi Agent', branchId: other._id });

    // Admin scoped to Mumbai (server-resolved from the header) tries a Delhi lead
    const crossLead = await post(w.adminToken, { executiveId: String(delhiExec._id), leadIds: [String(delhiLead._id)], coldCallerId: String(w.amit._id) }, { 'x-branch-id': String(w.branch._id) });
    expect(crossLead.status).toBe(409);
    expect(crossLead.body.failures[0].code).toBe('wrong_branch');

    // Mumbai lead + Delhi agent (no branch header: the agent's branch must still match the lead's)
    const crossAgent = await post(w.adminToken, body(w, { coldCallerId: String(delhiAgent._id) }));
    expect(crossAgent.status).toBe(409);
    expect(crossAgent.body.failures[0].code).toBe('agent_branch_mismatch');

    // An agent with no branch cannot be used either
    const nobranch = await makeUser('cold_calling', { name: 'Floating' });
    expect((await post(w.adminToken, body(w, { coldCallerId: String(nobranch._id) }))).status).toBe(409);

    // Same-branch works in each branch
    expect((await post(w.adminToken, body(w), { 'x-branch-id': String(w.branch._id) })).status).toBe(201);
    expect((await post(w.adminToken, { executiveId: String(delhiExec._id), leadIds: [String(delhiLead._id)], coldCallerId: String(delhiAgent._id) }, { 'x-branch-id': String(other._id) })).status).toBe(201);
    expect(await ColdCallingAssignment.countDocuments()).toBe(2);
  });
});

describe('duplicate assignment protection', () => {
  test('the database has a partial UNIQUE index on active assignments per lead', async () => {
    const indexes = await ColdCallingAssignment.collection.indexes();
    const unique = indexes.find((i) => i.unique && i.key.leadId === 1);
    expect(unique.partialFilterExpression).toEqual({ status: 'active' });

    const w = await world({ leadCount: 1 });
    const base = { leadId: w.leads[0]._id, coldCallerId: w.amit._id, originalSalesOwnerId: w.rahul._id, assignedBy: w.admin._id };
    await ColdCallingAssignment.create({ ...base });
    await expect(ColdCallingAssignment.create({ ...base })).rejects.toThrow(/E11000|duplicate/i);
    await ColdCallingAssignment.create({ ...base, status: 'closed' }); // history rows don't collide
    await ColdCallingAssignment.create({ ...base, status: 'closed' });
  });

  test('repeating the same request (double click / retry) is a safe no-op', async () => {
    const w = await world({ leadCount: 3 });
    const payload = { executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(w.amit._id) };
    const first = await post(w.adminToken, payload);
    const second = await post(w.adminToken, payload);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body).toMatchObject({ assignedCount: 0, alreadyAssignedCount: 3 });
    expect(second.body.assignments.every((a) => a.alreadyAssigned)).toBe(true);
    expect(await ColdCallingAssignment.countDocuments()).toBe(3);
  });

  test('a lead already with agent A cannot be given to agent B; the assignment is left unchanged', async () => {
    const w = await world({ leadCount: 2 });
    const ravi = await makeUser('cold_calling', { name: 'Ravi', branchId: w.branch._id });
    await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: [String(w.leads[0]._id)], coldCallerId: String(w.amit._id) });
    const before = await ColdCallingAssignment.find({}).lean();

    const res = await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(ravi._id) });
    expect(res.status).toBe(409);
    expect(res.body.failures).toEqual([expect.objectContaining({ leadId: String(w.leads[0]._id), code: 'already_assigned', message: 'Already assigned to Amit Sharma' })]);
    expect(await ColdCallingAssignment.find({}).lean()).toEqual(before); // lead 2 was NOT assigned to Ravi either
  });

  test('a stale screen: Admin B assigned first, Admin A submits later with a different agent -> 409, nothing duplicated', async () => {
    const w = await world({ leadCount: 2 });
    const ravi = await makeUser('cold_calling', { name: 'Ravi', branchId: w.branch._id });
    const adminB = await makeUser('admin');
    const payload = (agent) => ({ executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(agent._id) });
    expect((await post(await tokenFor(adminB), payload(w.amit))).status).toBe(201);
    const late = await post(w.adminToken, payload(ravi));
    expect(late.status).toBe(409);
    expect(await ColdCallingAssignment.countDocuments()).toBe(2);
  });

  test('concurrent identical requests create exactly one assignment per lead and all succeed', async () => {
    const w = await world({ leadCount: 6 });
    const payload = { executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(w.amit._id) };
    const responses = await Promise.all(Array.from({ length: 6 }, () => post(w.adminToken, payload)));
    expect(responses.map((r) => r.status).every((s) => s === 200 || s === 201)).toBe(true);
    expect(await ColdCallingAssignment.countDocuments()).toBe(6);
    for (const r of responses) expect(r.body.assignedCount + r.body.alreadyAssignedCount).toBe(6);
    expect(responses.reduce((sum, r) => sum + r.body.assignedCount, 0)).toBe(6); // each lead was created by exactly one request
  });

  test('concurrent requests for overlapping leads and different agents never double-assign or half-apply', async () => {
    const w = await world({ leadCount: 4 });
    const ravi = await makeUser('cold_calling', { name: 'Ravi', branchId: w.branch._id });
    const [l1, l2, l3, l4] = w.leads;
    const a = post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids([l1, l2, l3]), coldCallerId: String(w.amit._id) });
    const b = post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids([l3, l4]), coldCallerId: String(ravi._id) });
    const [ra, rb] = await Promise.all([a, b]);

    const docs = await ColdCallingAssignment.find({ status: 'active' }).lean();
    const perLead = docs.reduce((acc, d) => ({ ...acc, [String(d.leadId)]: (acc[String(d.leadId)] || 0) + 1 }), {});
    expect(Object.values(perLead).every((n) => n === 1)).toBe(true); // never two active assignments
    const owner = (lead) => docs.find((d) => String(d.leadId) === String(lead._id))?.coldCallerName;
    // exactly one of the two requests won lead 3; the loser applied NOTHING
    if (ra.status < 300 && rb.status === 409) {
      expect([owner(l1), owner(l2), owner(l3), owner(l4)]).toEqual(['Amit Sharma', 'Amit Sharma', 'Amit Sharma', undefined]);
    } else if (rb.status < 300 && ra.status === 409) {
      expect([owner(l1), owner(l2), owner(l3), owner(l4)]).toEqual([undefined, undefined, 'Ravi', 'Ravi']);
    } else {
      throw new Error(`unexpected outcome ${ra.status}/${rb.status}`);
    }
  });
});

describe('executive drill-down shows the assignment state', () => {
  const detail = (t, exec, q = {}) => request(app).get(`/api/leads/analytics/executive-lead-status/${exec._id}/leads`).query(q).set(auth(t));

  test('each lead reports its Cold Calling agent (or null), even after it stops being Cold', async () => {
    const w = await world({ leadCount: 3 });
    await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: [String(w.leads[0]._id)], coldCallerId: String(w.amit._id) });
    await Lead.updateOne({ _id: w.leads[0]._id }, { $set: { statusReason: 'requested_callback' } }); // now Warm

    const all = await detail(w.adminToken, w.rahul);
    const byId = Object.fromEntries(all.body.data.map((l) => [l._id, l]));
    expect(byId[String(w.leads[0]._id)]).toMatchObject({ bucket: 'warm', coldCalling: { coldCallerName: 'Amit Sharma' } });
    expect(byId[String(w.leads[1]._id)].coldCalling).toBeNull();
    expect(all.body.summary).toEqual({ assigned: 3, cold: 2, warm: 1, hot: 0, unclassified: 0 });
    expect(all.body.executive.branchId).toBe(String(w.branch._id));
  });

  test('costs one batched query for the page, not one per lead', async () => {
    const w = await world({ leadCount: 25 });
    const ops = [];
    mongoose.set('debug', (collection, method) => ops.push(`${collection}.${method}`));
    try {
      expect((await detail(w.adminToken, w.rahul, { limit: 25 })).status).toBe(200);
    } finally {
      mongoose.set('debug', false);
    }
    expect(ops.filter((o) => o.startsWith('coldcallingassignments.'))).toEqual(['coldcallingassignments.find']);
  });
});

describe('Cold Caller "My Leads" (read-only, own assignments only)', () => {
  const mine = (t, q = {}) => request(app).get('/api/cold-calling/my-leads').query(q).set(auth(t));

  test('an agent sees only their own assignments; a coldCallerId parameter cannot widen it', async () => {
    const w = await world({ leadCount: 4 });
    const ravi = await makeUser('cold_calling', { name: 'Ravi', branchId: w.branch._id });
    await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids(w.leads.slice(0, 3)), coldCallerId: String(w.amit._id) });
    await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids(w.leads.slice(3)), coldCallerId: String(ravi._id) });

    const amitRes = await mine(await tokenFor(w.amit), { coldCallerId: String(ravi._id) });
    expect(amitRes.status).toBe(200);
    expect(amitRes.body.pagination.total).toBe(3);
    expect(amitRes.body.data.map((r) => r.lead._id).sort()).toEqual(ids(w.leads.slice(0, 3)).sort());

    const raviRes = await mine(await tokenFor(ravi), { coldCallerId: String(w.amit._id), userId: String(w.amit._id) });
    expect(raviRes.body.data.map((r) => r.lead._id)).toEqual(ids(w.leads.slice(3)));
  });

  test('shows original owner, CURRENT owner, current status + the snapshot; no phone or other lead data', async () => {
    const w = await world({ leadCount: 1 });
    const sippy = await makeUser('sales_executive', { name: 'Sippy', branchId: w.branch._id });
    await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(w.amit._id) });
    await Lead.updateOne({ _id: w.leads[0]._id }, { $set: { assignedTo: sippy._id, statusReason: 'requested_callback' } });

    const res = await mine(await tokenFor(w.amit));
    const [row] = res.body.data;
    expect(row).toMatchObject({
      lead: { _id: String(w.leads[0]._id) },
      bucket: 'warm',
      statusReason: 'requested_callback',
      initial: { bucket: 'cold', statusReason: COLD },
      originalSalesOwner: { name: 'Rahul' },
      currentSalesOwner: { name: 'Sippy' },
    });
    expect(row.assignedAt).toBeTruthy();
    expect(JSON.stringify(row)).not.toMatch(/phone|whatsapp|email|budget/i); // destination + travelDate are deliberate context; contact details and budget are not
  });

  test('deleted leads are hidden; pagination is deterministic and capped', async () => {
    const w = await world({ leadCount: 5 });
    await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(w.amit._id) });
    await Lead.updateOne({ _id: w.leads[0]._id }, { $set: { isDeleted: true } });
    const token = await tokenFor(w.amit);
    const p1 = await mine(token, { page: 1, limit: 2 });
    const p2 = await mine(token, { page: 2, limit: 2 });
    const p3 = await mine(token, { page: 3, limit: 2 });
    expect(p1.body.pagination).toMatchObject({ total: 4, totalPages: 2, limit: 2 });
    expect([...p1.body.data, ...p2.body.data].map((r) => r.lead._id).sort()).toEqual(ids(w.leads.slice(1)).sort());
    expect(p3.body.data).toEqual([]);
    expect((await mine(token, { limit: 100000 })).body.pagination.limit).toBe(100);
  });

  test('other roles cannot use it; an agent with nothing assigned gets an empty list', async () => {
    const w = await world({ leadCount: 1 });
    for (const user of [w.admin, w.rahul, await makeUser('sales_manager', { branchId: w.branch._id })]) {
      expect((await mine(await tokenFor(user))).status).toBe(403);
    }
    expect((await request(app).get('/api/cold-calling/my-leads')).status).toBe(401);
    const empty = await mine(await tokenFor(w.amit));
    expect(empty.body).toMatchObject({ data: [], pagination: { total: 0 } });
  });

  test('the agent can call ONLY my-leads: lead, admin and assignment endpoints stay forbidden', async () => {
    const w = await world({ leadCount: 1 });
    const token = await tokenFor(w.amit);
    for (const [method, url] of [
      ['get', '/api/leads'], ['get', '/api/leads/analytics/executive-lead-status'], ['get', AGENTS], ['post', ASSIGN], ['get', '/api/users'],
    ]) {
      expect([method, url, (await request(app)[method](url).set(auth(token)).send({})).status]).toEqual([method, url, 403]);
    }
  });
});

describe('agents list (Admin picker)', () => {
  test('lists only ACTIVE cold_calling users, scoped to the Admin\'s branch', async () => {
    const w = await world({ leadCount: 1 });
    const other = await makeBranch('Delhi');
    await makeUser('cold_calling', { name: 'Disabled Dan', branchId: w.branch._id, status: 'disabled' });
    await makeUser('cold_calling', { name: 'Delhi Dee', branchId: other._id });
    await makeUser('sales_executive', { name: 'Not An Agent', branchId: w.branch._id });
    await makeUser('team_leader', { name: 'Neither', branchId: w.branch._id });

    const scoped = await request(app).get(AGENTS).set(auth(w.adminToken)).set('x-branch-id', String(w.branch._id));
    expect(scoped.body.data.map((u) => u.name)).toEqual(['Amit Sharma']);
    const everywhere = await request(app).get(AGENTS).set(auth(w.adminToken));
    expect(everywhere.body.data.map((u) => u.name)).toEqual(['Amit Sharma', 'Delhi Dee']);
    expect(JSON.stringify(everywhere.body)).not.toMatch(/password/);
  });
});

describe('query shape (no N+1)', () => {
  test('assigning 40 leads costs a fixed handful of operations and writes nothing to the leads collection', async () => {
    const w = await world({ leadCount: 40 });
    await require('../../src/services/leadStatusConfigService').getConfig({ force: true });
    const ops = [];
    mongoose.set('debug', (collection, method) => ops.push(`${collection}.${method}`));
    try {
      const res = await post(w.adminToken, { executiveId: String(w.rahul._id), leadIds: ids(w.leads), coldCallerId: String(w.amit._id) });
      expect(res.body.assignedCount).toBe(40);
      await waitFor(async () => (await LeadActivity.countDocuments({ type: 'cold_calling_assigned' })) === 40);
    } finally {
      mongoose.set('debug', false);
    }
    expect(ops.filter((o) => o.startsWith('leads.'))).toEqual(['leads.aggregate']);
    expect(ops.filter((o) => o === 'coldcallingassignments.find')).toHaveLength(1);
    expect(ops.filter((o) => o === 'coldcallingassignments.insertMany')).toHaveLength(1);
    expect(ops.filter((o) => o === 'leadactivities.insertMany')).toHaveLength(1);
    expect(ops.filter((o) => o.startsWith('leads.') && /update|save|insert|delete|replace/i.test(o))).toEqual([]);
  });
});
