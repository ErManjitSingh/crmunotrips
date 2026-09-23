const request = require('supertest');
const mongoose = require('mongoose');
const db = require('../setup/db');

let app;
let User;
let Lead;
let Branch;
let UserSession;
let leadStatusConfigService;
let generateToken;
let counter = 0;

const URL = '/api/leads/analytics/executive-lead-status';

// IST calendar-day boundaries used by the date tests: 2026-03-10 00:00 IST == 2026-03-09T18:30:00Z
const IST_MAR10_START = '2026-03-09T18:30:00.000Z';
const IST_MAR10_LAST_MS = '2026-03-10T18:29:59.999Z';
const IST_MAR11_START = '2026-03-10T18:30:00.000Z';

beforeAll(async () => {
  await db.connect();
  app = require('../../src/server');
  User = require('../../src/models/User');
  Lead = require('../../src/models/Lead');
  Branch = require('../../src/models/Branch');
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

async function makeUser(role, overrides = {}) {
  counter += 1;
  return User.create({
    name: overrides.name || `${role} ${counter}`,
    email: `els${counter}@example.com`,
    password: 'password123',
    role,
    ...overrides,
  });
}

async function tokenFor(user) {
  const session = await UserSession.create({
    userId: user._id,
    sessionId: new mongoose.Types.ObjectId().toString(),
    role: user.role,
    status: 'active',
    loginAt: new Date(),
    lastActivityAt: new Date(),
  });
  return generateToken(user._id, user.role, session.sessionId);
}

async function makeBranch(name) {
  counter += 1;
  return Branch.create({ name, code: `B${counter}` });
}

let creatorPromise;
async function makeLead(overrides = {}) {
  counter += 1;
  const n = counter;
  if (!creatorPromise) creatorPromise = makeUser('admin', { name: 'Lead Creator' });
  const creatorId = (await creatorPromise)._id;
  return Lead.create({
    // Explicit id: the model's max+1 leadId generator is not safe under the parallel creates below.
    leadId: `T-${n}`,
    name: `Lead ${n}`,
    phone: `9${String(1000000000 + n).slice(0, 9)}`,
    destination: 'Goa',
    createdBy: creatorId,
    assignedAt: new Date(),
    ...overrides,
  });
}

function get(token, query = {}, headers = {}) {
  return request(app)
    .get(URL)
    .query(query)
    .set('Authorization', `Bearer ${token}`)
    .set(headers);
}

const rowFor = (body, user) => body.executives.find((r) => String(r._id) === String(user._id));

describe('GET /api/leads/analytics/executive-lead-status', () => {
  describe('authorization', () => {
    test('admin can access', async () => {
      const admin = await makeUser('admin');
      const res = await get(await tokenFor(admin));
      expect(res.status).toBe(200);
    });

    test.each(['sales_manager', 'team_leader', 'sales_executive', 'lead_provider', 'accountant', 'operations_manager'])(
      '%s is forbidden',
      async (role) => {
        const user = await makeUser(role);
        const res = await get(await tokenFor(user));
        expect(res.status).toBe(403);
      }
    );

    test('unauthenticated is rejected', async () => {
      const res = await request(app).get(URL);
      expect(res.status).toBe(401);
    });
  });

  describe('classification (statusReason, never temperature / isHot)', () => {
    test('one executive: 20 leads = 5 cold, 8 warm, 4 hot, 3 unclassified', async () => {
      const admin = await makeUser('admin');
      const rahul = await makeUser('sales_executive', { name: 'Rahul' });

      const make = (statusReason, extra = {}) =>
        makeLead({ assignedTo: rahul._id, statusReason, ...extra });

      const cold = ['booked_elsewhere', 'language_barrier', 'not_interested', 'invalid_number', 'budget_issues'];
      const warm = [
        'discussed_package', 'requested_callback', 'cnp_same_day', 'price_negotiation',
        'discussed_package', 'requested_callback', 'cnp_same_day', 'price_negotiation',
      ];
      // Every lead defaults to temperature 'cold' — the decoys below prove it is ignored.
      await Promise.all([
        ...cold.map((r) => make(r, { temperature: 'hot', isHot: true })),
        ...warm.map((r) => make(r, { temperature: 'cold' })),
        ...[1, 2, 3, 4].map(() => make('ready_to_book', { temperature: 'cold', isHot: false })),
        make('', { temperature: 'hot', isHot: true }),
        make('working_progress', { temperature: 'hot', isHot: true }),
        make(undefined, { temperature: 'vip' }),
      ]);

      const res = await get(await tokenFor(admin));
      expect(res.status).toBe(200);
      const row = rowFor(res.body, rahul);
      expect(row).toMatchObject({ name: 'Rahul', assigned: 20, cold: 5, warm: 8, hot: 4, unclassified: 3 });
      expect(row.assigned).toBe(row.cold + row.warm + row.hot + row.unclassified);
      expect(res.body.totals).toEqual({ assigned: 20, cold: 5, warm: 8, hot: 4, unclassified: 3 });
    });

    test('matches the reason forms the Lead Status filter matches (comment suffix, not_connected: prefix, case, legacy alias)', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      await Promise.all([
        makeLead({ assignedTo: exec._id, statusReason: 'Discussed_Package: sent brochure' }),
        makeLead({ assignedTo: exec._id, statusReason: 'not_connected:requested_callback' }),
        makeLead({ assignedTo: exec._id, statusReason: 'budget_issue' }),
        makeLead({ assignedTo: exec._id, statusReason: 'budget_issues_extra' }),
        makeLead({ assignedTo: exec._id, statusReason: 'ready_to_booking' }),
      ]);
      const row = rowFor((await get(await tokenFor(admin))).body, exec);
      expect(row).toMatchObject({ assigned: 5, warm: 2, cold: 1, hot: 0, unclassified: 2 });
    });

    test('converted leads never appear in a bucket (counted as unclassified)', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      await Promise.all([
        makeLead({ assignedTo: exec._id, status: 'converted', statusReason: 'ready_to_book' }),
        makeLead({ assignedTo: exec._id, status: 'converted', statusReason: 'not_interested' }),
        makeLead({ assignedTo: exec._id, status: 'negotiation', statusReason: 'ready_to_book' }),
      ]);
      const row = rowFor((await get(await tokenFor(admin))).body, exec);
      expect(row).toMatchObject({ assigned: 3, hot: 1, cold: 0, warm: 0, unclassified: 2 });
    });

    test('a malformed (non-string) statusReason is Unclassified and never fails the whole report', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      await Lead.collection.insertOne({
        leadId: 'T-raw-1', name: 'Raw', phone: '9000000001', destination: 'Goa', createdBy: admin._id,
        assignedTo: exec._id, assignedAt: new Date(), statusReason: 12345,
      });
      await Lead.collection.insertOne({
        leadId: 'T-raw-2', name: 'Raw2', phone: '9000000002', destination: 'Goa', createdBy: admin._id,
        assignedTo: exec._id, assignedAt: new Date(), statusReason: { $weird: 'object' },
      });
      await makeLead({ assignedTo: exec._id, statusReason: 'ready_to_book' });

      const res = await get(await tokenFor(admin));
      expect(res.status).toBe(200);
      expect(rowFor(res.body, exec)).toMatchObject({ assigned: 3, hot: 1, unclassified: 2 });
    });

    test('agrees with the existing Lead Status filter for every bucket', async () => {
      const { applyListStatusBucket, bucketForLead } = require('../../src/utils/listStatusBucketFilter');
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      const reasons = [
        'booked_elsewhere', 'not_interested', 'discussed_package', 'price_negotiation:x',
        'ready_to_book', 'ready_to_book', 'auto_connected_24h', '', 'something_else',
        'not_connected:language_barrier', 'BUDGET_ISSUES',
      ];
      await Promise.all(reasons.map((r) => makeLead({ assignedTo: exec._id, statusReason: r })));
      await makeLead({ assignedTo: exec._id, status: 'converted', statusReason: 'ready_to_book' });

      const row = rowFor((await get(await tokenFor(admin))).body, exec);
      for (const bucket of ['cold', 'warm', 'hot']) {
        const viaFilter = await Lead.countDocuments(
          applyListStatusBucket({ assignedTo: exec._id, isDeleted: { $ne: true } }, bucket)
        );
        expect(row[bucket]).toBe(viaFilter);
      }

      // ...and with the in-process form of the same rule (used by the status-movement tracker).
      const viaJs = { cold: 0, warm: 0, hot: 0, unclassified: 0 };
      (await Lead.find({ assignedTo: exec._id }).select('status statusReason').lean()).forEach((l) => {
        viaJs[bucketForLead(l.status, l.statusReason) || 'unclassified'] += 1;
      });
      expect({ cold: row.cold, warm: row.warm, hot: row.hot, unclassified: row.unclassified }).toEqual(viaJs);
    });

    test('follows the live Lead Status config (no hardcoded key lists)', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      await makeLead({ assignedTo: exec._id, statusReason: 'site_visit_booked' });

      let row = rowFor((await get(await tokenFor(admin))).body, exec);
      expect(row).toMatchObject({ assigned: 1, hot: 0, unclassified: 1 });

      const cfg = await leadStatusConfigService.getConfig({ includeDisabled: true, force: true });
      await leadStatusConfigService.saveConfig(
        { ...cfg, hot: [...cfg.hot, { key: 'site_visit_booked', label: 'Site visit booked' }] },
        admin._id
      );

      row = rowFor((await get(await tokenFor(admin))).body, exec);
      expect(row).toMatchObject({ assigned: 1, hot: 1, unclassified: 0 });
    });

    test('a lead classified through the real Call Note flow is reported under its bucket', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      const lead = await makeLead({ assignedTo: exec._id });
      const callRes = await request(app)
        .post(`/api/leads/${lead._id}/call-notes`)
        .set('Authorization', `Bearer ${await tokenFor(exec)}`)
        .send({ category: 'hot', outcome: 'ready_to_book' });
      expect(callRes.status).toBe(201);

      const row = rowFor((await get(await tokenFor(admin))).body, exec);
      expect(row).toMatchObject({ assigned: 1, hot: 1 });
    });
  });

  describe('assigned population', () => {
    test('current owner is respected: a reassigned lead counts only for the new owner', async () => {
      const admin = await makeUser('admin');
      const rahul = await makeUser('sales_executive', { name: 'Rahul' });
      const amit = await makeUser('sales_executive', { name: 'Amit' });
      const lead = await makeLead({ assignedTo: rahul._id, statusReason: 'not_interested' });
      await Lead.updateOne({ _id: lead._id }, { $set: { assignedTo: amit._id, assignedAt: new Date() } });

      const body = (await get(await tokenFor(admin))).body;
      expect(rowFor(body, rahul).assigned).toBe(0);
      expect(rowFor(body, amit)).toMatchObject({ assigned: 1, cold: 1 });
    });

    test('soft-deleted leads are excluded', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      await Promise.all([
        makeLead({ assignedTo: exec._id, statusReason: 'ready_to_book' }),
        makeLead({ assignedTo: exec._id, statusReason: 'ready_to_book', isDeleted: true, deletedAt: new Date() }),
      ]);
      const row = rowFor((await get(await tokenFor(admin))).body, exec);
      expect(row).toMatchObject({ assigned: 1, hot: 1 });
    });

    test('unassigned leads are never counted', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      await makeLead({ assignedTo: null, statusReason: 'ready_to_book' });
      const body = (await get(await tokenFor(admin))).body;
      expect(rowFor(body, exec).assigned).toBe(0);
      expect(body.totals.assigned).toBe(0);
    });

    test('executives with no leads are listed with zeros; inactive executives only appear when they own leads', async () => {
      const admin = await makeUser('admin');
      const active = await makeUser('sales_executive', { name: 'Active Zero' });
      const inactiveEmpty = await makeUser('sales_executive', { name: 'Gone Empty', status: 'disabled' });
      const inactiveOwner = await makeUser('sales_executive', { name: 'Gone Owner', status: 'disabled' });
      await makeLead({ assignedTo: inactiveOwner._id, statusReason: 'not_interested' });

      const body = (await get(await tokenFor(admin))).body;
      expect(rowFor(body, active)).toMatchObject({ assigned: 0, cold: 0, warm: 0, hot: 0, unclassified: 0 });
      expect(rowFor(body, inactiveEmpty)).toBeUndefined();
      expect(rowFor(body, inactiveOwner)).toMatchObject({ assigned: 1, cold: 1 });
    });

    test('leads owned by non-executives are not rows, but are reported in otherOwnersAssigned', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      const leader = await makeUser('team_leader');
      await makeLead({ assignedTo: exec._id });
      await Promise.all([makeLead({ assignedTo: leader._id }), makeLead({ assignedTo: leader._id })]);

      const body = (await get(await tokenFor(admin))).body;
      expect(body.executives.map((r) => String(r._id))).toEqual([String(exec._id)]);
      expect(body.totals.assigned).toBe(1);
      expect(body.otherOwnersAssigned).toBe(2);
    });

    test('multiple executives are ranked by assigned, then name', async () => {
      const admin = await makeUser('admin');
      const a = await makeUser('sales_executive', { name: 'Asha' });
      const b = await makeUser('sales_executive', { name: 'Bala' });
      const c = await makeUser('sales_executive', { name: 'Chitra' });
      await Promise.all([
        makeLead({ assignedTo: b._id, statusReason: 'ready_to_book' }),
        makeLead({ assignedTo: b._id, statusReason: 'not_interested' }),
        makeLead({ assignedTo: a._id, statusReason: 'discussed_package' }),
        makeLead({ assignedTo: c._id, statusReason: 'discussed_package' }),
      ]);
      const body = (await get(await tokenFor(admin))).body;
      expect(body.executives.map((r) => r.name)).toEqual(['Bala', 'Asha', 'Chitra']);
      expect(rowFor(body, b)).toMatchObject({ assigned: 2, hot: 1, cold: 1 });
      expect(body.totals).toEqual({ assigned: 4, cold: 1, warm: 2, hot: 1, unclassified: 0 });
    });

    test('empty database returns an empty, well-formed report', async () => {
      const admin = await makeUser('admin');
      const res = await get(await tokenFor(admin));
      expect(res.status).toBe(200);
      expect(res.body.executives).toEqual([]);
      expect(res.body.totals).toEqual({ assigned: 0, cold: 0, warm: 0, hot: 0, unclassified: 0 });
      expect(res.body.otherOwnersAssigned).toBe(0);
      expect(res.body.period).toMatchObject({ field: 'assignedAt', dateFrom: null, dateTo: null });
    });
  });

  describe('filters', () => {
    test('assignedAt drives the period, on IST calendar-day boundaries (createdAt is ignored)', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      const token = await tokenFor(admin);
      const old = new Date('2026-01-01T00:00:00Z');
      await Promise.all([
        makeLead({ assignedTo: exec._id, assignedAt: new Date(IST_MAR10_START), createdAt: old }),
        makeLead({ assignedTo: exec._id, assignedAt: new Date(IST_MAR10_LAST_MS), createdAt: old }),
        makeLead({ assignedTo: exec._id, assignedAt: new Date(IST_MAR11_START), createdAt: old }),
        makeLead({ assignedTo: exec._id, assignedAt: new Date('2026-03-08T18:29:59.999Z'), createdAt: new Date('2026-03-10T05:00:00Z') }),
        makeLead({ assignedTo: exec._id, assignedAt: null }),
      ]);

      const mar10 = await get(token, { dateFrom: '2026-03-10', dateTo: '2026-03-10' });
      expect(rowFor(mar10.body, exec).assigned).toBe(2);
      expect(mar10.body.period).toMatchObject({ dateFrom: '2026-03-10', dateTo: '2026-03-10' });

      const mar11 = await get(token, { dateFrom: '2026-03-11', dateTo: '2026-03-11' });
      expect(rowFor(mar11.body, exec).assigned).toBe(1);

      const range = await get(token, { dateFrom: '2026-03-10', dateTo: '2026-03-11' });
      expect(rowFor(range.body, exec).assigned).toBe(3);

      const fromOnly = await get(token, { dateFrom: '2026-03-11' });
      expect(rowFor(fromOnly.body, exec).assigned).toBe(1);

      const toOnly = await get(token, { dateTo: '2026-03-09' });
      expect(rowFor(toOnly.body, exec).assigned).toBe(1);

      // No period: every currently-assigned lead, including one with no assignedAt.
      const all = await get(token);
      expect(rowFor(all.body, exec).assigned).toBe(5);
    });

    test('executiveId narrows to one executive', async () => {
      const admin = await makeUser('admin');
      const a = await makeUser('sales_executive', { name: 'A' });
      const b = await makeUser('sales_executive', { name: 'B' });
      await Promise.all([makeLead({ assignedTo: a._id }), makeLead({ assignedTo: b._id })]);
      const res = await get(await tokenFor(admin), { executiveId: String(a._id) });
      expect(res.body.executives.map((r) => String(r._id))).toEqual([String(a._id)]);
      expect(res.body.totals.assigned).toBe(1);
      expect(res.body.filters.executiveId).toBe(String(a._id));
    });

    test('source narrows the population', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      await Promise.all([
        makeLead({ assignedTo: exec._id, source: 'dpw' }),
        makeLead({ assignedTo: exec._id, source: 'dpw' }),
        makeLead({ assignedTo: exec._id, source: 'referral' }),
      ]);
      const res = await get(await tokenFor(admin), { source: 'dpw' });
      expect(rowFor(res.body, exec).assigned).toBe(2);
    });

    test('branch scope is applied server-side (header and query) and rows are branch-separated', async () => {
      const admin = await makeUser('admin');
      const branchA = await makeBranch('Branch A');
      const branchB = await makeBranch('Branch B');
      const execA = await makeUser('sales_executive', { name: 'Exec A', branchId: branchA._id });
      const execB = await makeUser('sales_executive', { name: 'Exec B', branchId: branchB._id });
      await Promise.all([
        makeLead({ assignedTo: execA._id, branchId: branchA._id, statusReason: 'ready_to_book' }),
        makeLead({ assignedTo: execA._id, branchId: branchA._id }),
        makeLead({ assignedTo: execB._id, branchId: branchB._id, statusReason: 'not_interested' }),
      ]);
      const token = await tokenFor(admin);

      const viaHeader = await get(token, {}, { 'x-branch-id': String(branchA._id) });
      expect(viaHeader.body.executives.map((r) => r.name)).toEqual(['Exec A']);
      expect(viaHeader.body.totals).toEqual({ assigned: 2, cold: 0, warm: 0, hot: 1, unclassified: 1 });
      expect(viaHeader.body.filters.branchId).toBe(String(branchA._id));

      const viaQuery = await get(token, { branchId: String(branchB._id) });
      expect(viaQuery.body.executives.map((r) => r.name)).toEqual(['Exec B']);
      expect(viaQuery.body.totals.cold).toBe(1);

      const everything = await get(token);
      expect(everything.body.executives).toHaveLength(2);
      expect(everything.body.totals.assigned).toBe(3);
    });

    test('a branch-pinned non-admin cannot use the endpoint at all', async () => {
      const branch = await makeBranch('Pinned');
      const manager = await makeUser('sales_manager', { branchId: branch._id });
      const res = await get(await tokenFor(manager), {}, { 'x-branch-id': String(branch._id) });
      expect(res.status).toBe(403);
    });
  });

  describe('validation', () => {
    test.each([
      [{ dateFrom: '10-03-2026' }],
      [{ dateFrom: '2026-02-31' }],
      [{ dateTo: 'garbage' }],
      [{ dateFrom: '2026-03-11', dateTo: '2026-03-10' }],
      [{ executiveId: 'not-an-id' }],
      [{ source: 'not_a_source' }],
      [{ 'source[$ne]': 'dpw' }],
      [{ 'executiveId[$ne]': '000000000000000000000000' }],
      [{ 'dateFrom[$gt]': '2026-01-01' }],
    ])('rejects %j with 400', async (query) => {
      const admin = await makeUser('admin');
      const res = await get(await tokenFor(admin), query);
      expect(res.status).toBe(400);
    });

    test('rejects a malformed branch scope with 400', async () => {
      const admin = await makeUser('admin');
      const res = await get(await tokenFor(admin), {}, { 'x-branch-id': 'not-a-branch' });
      expect(res.status).toBe(400);
    });
  });

  describe('query shape', () => {
    test('issues a fixed number of DB operations regardless of executives/leads (no N+1)', async () => {
      const admin = await makeUser('admin');
      const token = await tokenFor(admin);
      const execs = [];
      for (let i = 0; i < 25; i += 1) execs.push(await makeUser('sales_executive', { name: `Exec ${i}` }));
      const reasons = ['ready_to_book', 'not_interested', 'discussed_package', ''];
      await Lead.insertMany(
        Array.from({ length: 300 }, (_, i) => ({
          name: `Bulk ${i}`,
          phone: `8${String(100000000 + i)}`,
          leadId: `L-9${String(i).padStart(4, '0')}`,
          destination: 'Goa',
          createdBy: admin._id,
          assignedTo: execs[i % execs.length]._id,
          assignedAt: new Date(),
          statusReason: reasons[i % reasons.length],
        }))
      );
      // Warm the config cache so only the report's own operations are measured.
      await leadStatusConfigService.getConfig({ force: true });

      const ops = [];
      mongoose.set('debug', (collection, method) => ops.push(`${collection}.${method}`));
      try {
        const res = await get(token);
        expect(res.status).toBe(200);
        expect(res.body.totals.assigned).toBe(300);
        expect(res.body.executives).toHaveLength(25);
      } finally {
        mongoose.set('debug', false);
      }
      const reportOps = ops.filter((op) => !/^(usersessions|users)\.(findOneAndUpdate|findOne)$/.test(op));
      expect(reportOps.filter((op) => op.startsWith('leads.'))).toEqual(['leads.aggregate']);
      expect(reportOps.filter((op) => op.startsWith('users.'))).toEqual(['users.find']);
      expect(reportOps.length).toBeLessThanOrEqual(3);
    });
  });
});

describe('GET /api/leads/analytics/executive-lead-status/:executiveId/leads (drill-down)', () => {
  const detailUrl = (id) => `/api/leads/analytics/executive-lead-status/${id}/leads`;
  const getDetail = (token, executiveId, query = {}, headers = {}) =>
    request(app).get(detailUrl(executiveId)).query(query).set('Authorization', `Bearer ${token}`).set(headers);
  const ZERO = { assigned: 0, cold: 0, warm: 0, hot: 0, unclassified: 0 };

  describe('authorization', () => {
    test('admin can open an executive; every other role is forbidden; unauthenticated is rejected', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      expect((await getDetail(await tokenFor(admin), exec._id)).status).toBe(200);
      for (const role of ['sales_manager', 'team_leader', 'sales_executive', 'lead_provider', 'accountant', 'operations_manager']) {
        const user = await makeUser(role);
        expect((await getDetail(await tokenFor(user), exec._id)).status).toBe(403);
      }
      expect((await request(app).get(detailUrl(exec._id))).status).toBe(401);
    });
  });

  describe('overview / detail parity', () => {
    test('7 assigned = 4 cold + 3 unclassified: detail returns exactly those 7 leads with the right bucket each', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive', { name: 'Ankush' });
      const cold = ['booked_elsewhere', 'language_barrier', 'not_interested', 'invalid_number'];
      const created = await Promise.all([
        ...cold.map((r) => makeLead({ assignedTo: exec._id, statusReason: r })),
        makeLead({ assignedTo: exec._id, statusReason: '' }),
        makeLead({ assignedTo: exec._id, statusReason: 'working_progress' }),
        makeLead({ assignedTo: exec._id, status: 'converted', statusReason: 'ready_to_book' }),
      ]);
      const token = await tokenFor(admin);

      const overview = rowFor((await get(token)).body, exec);
      const res = await getDetail(token, exec._id);
      expect(res.status).toBe(200);
      expect(res.body.executive).toMatchObject({ name: 'Ankush' });
      expect(res.body.summary).toEqual({ assigned: 7, cold: 4, warm: 0, hot: 0, unclassified: 3 });
      expect(res.body.summary).toEqual({
        assigned: overview.assigned, cold: overview.cold, warm: overview.warm, hot: overview.hot, unclassified: overview.unclassified,
      });
      expect(res.body.pagination.total).toBe(7);
      expect(res.body.data).toHaveLength(7);
      expect(res.body.data.map((l) => String(l._id)).sort()).toEqual(created.map((l) => String(l._id)).sort());

      const byBucket = res.body.data.reduce((acc, l) => ({ ...acc, [l.bucket]: (acc[l.bucket] || 0) + 1 }), {});
      expect(byBucket).toEqual({ cold: 4, unclassified: 3 });
      expect(res.body.data.find((l) => l.status === 'converted').bucket).toBe('unclassified');
    });

    test('for every executive: summary equals the overview row and paging returns exactly `assigned` distinct leads', async () => {
      const admin = await makeUser('admin');
      const execs = [];
      for (const n of ['A', 'B', 'C']) execs.push(await makeUser('sales_executive', { name: `Exec ${n}` }));
      const reasons = ['ready_to_book', 'not_interested', 'discussed_package', '', 'auto_connected_24h'];
      let i = 0;
      for (const [index, exec] of execs.entries()) {
        for (let k = 0; k < 4 + index * 3; k += 1) {
          i += 1;
          await makeLead({ assignedTo: exec._id, statusReason: reasons[i % reasons.length], assignedAt: new Date(Date.now() - i * 60000) });
        }
      }
      const token = await tokenFor(admin);
      const overview = (await get(token)).body;
      for (const exec of execs) {
        const row = rowFor(overview, exec);
        const seen = [];
        let summary;
        for (let page = 1; page <= 10; page += 1) {
          const res = await getDetail(token, exec._id, { page, limit: 3 });
          summary = res.body.summary;
          seen.push(...res.body.data.map((l) => String(l._id)));
          if (page >= res.body.pagination.totalPages) break;
        }
        expect(summary).toEqual({ assigned: row.assigned, cold: row.cold, warm: row.warm, hot: row.hot, unclassified: row.unclassified });
        expect(summary.assigned).toBe(summary.cold + summary.warm + summary.hot + summary.unclassified);
        expect(seen).toHaveLength(row.assigned);
        expect(new Set(seen).size).toBe(row.assigned);
      }
    });

    test('each lead bucket agrees with the existing Lead Status filter', async () => {
      const { applyListStatusBucket } = require('../../src/utils/listStatusBucketFilter');
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      for (const r of ['not_interested', 'price_negotiation', 'ready_to_book', 'nonsense', '']) {
        await makeLead({ assignedTo: exec._id, statusReason: r });
      }
      const res = await getDetail(await tokenFor(admin), exec._id);
      for (const bucket of ['cold', 'warm', 'hot']) {
        const viaFilter = (await Lead.find(applyListStatusBucket({ assignedTo: exec._id }, bucket)).select('_id').lean())
          .map((l) => String(l._id)).sort();
        const viaDetail = res.body.data.filter((l) => l.bucket === bucket).map((l) => String(l._id)).sort();
        expect(viaDetail).toEqual(viaFilter);
      }
    });
  });

  describe('filters, isolation and semantics', () => {
    test('period is assignedAt on IST calendar days (createdAt ignored); only the current owner sees a reassigned lead', async () => {
      const admin = await makeUser('admin');
      const rahul = await makeUser('sales_executive', { name: 'Rahul' });
      const amit = await makeUser('sales_executive', { name: 'Amit' });
      const token = await tokenFor(admin);
      const old = new Date('2026-01-01T00:00:00Z');
      await makeLead({ assignedTo: rahul._id, assignedAt: new Date(IST_MAR10_START), createdAt: old });
      await makeLead({ assignedTo: rahul._id, assignedAt: new Date(IST_MAR10_LAST_MS), createdAt: old });
      await makeLead({ assignedTo: rahul._id, assignedAt: new Date(IST_MAR11_START), createdAt: old });
      const moved = await makeLead({ assignedTo: rahul._id, assignedAt: new Date(IST_MAR10_START) });
      await Lead.updateOne({ _id: moved._id }, { $set: { assignedTo: amit._id } });

      const day = await getDetail(token, rahul._id, { dateFrom: '2026-03-10', dateTo: '2026-03-10' });
      expect(day.body.data).toHaveLength(2);
      expect(day.body.summary.assigned).toBe(2);
      expect(day.body.period).toMatchObject({ dateFrom: '2026-03-10', dateTo: '2026-03-10', field: 'assignedAt' });
      expect((await getDetail(token, amit._id, { dateFrom: '2026-03-10', dateTo: '2026-03-10' })).body.data).toHaveLength(1);
      expect((await getDetail(token, rahul._id)).body.data).toHaveLength(3);
    });

    test('source narrows detail and summary together; deleted leads are excluded', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      await makeLead({ assignedTo: exec._id, source: 'dpw', statusReason: 'ready_to_book' });
      await makeLead({ assignedTo: exec._id, source: 'referral', statusReason: 'not_interested' });
      await makeLead({ assignedTo: exec._id, source: 'dpw', isDeleted: true, deletedAt: new Date() });
      const res = await getDetail(await tokenFor(admin), exec._id, { source: 'dpw' });
      expect(res.body.data).toHaveLength(1);
      expect(res.body.summary).toEqual({ assigned: 1, cold: 0, warm: 0, hot: 1, unclassified: 0 });
    });

    test('branch isolation: an executive id cannot be used to read another branch, header or query', async () => {
      const admin = await makeUser('admin');
      const branchA = await makeBranch('Branch A');
      const branchB = await makeBranch('Branch B');
      const exec = await makeUser('sales_executive', { branchId: branchA._id });
      await makeLead({ assignedTo: exec._id, branchId: branchA._id, name: 'In A' });
      await makeLead({ assignedTo: exec._id, branchId: branchB._id, name: 'In B' });
      const token = await tokenFor(admin);

      const inA = await getDetail(token, exec._id, {}, { 'x-branch-id': String(branchA._id) });
      expect(inA.body.data.map((l) => l.name)).toEqual(['In A']);
      const inB = await getDetail(token, exec._id, { branchId: String(branchB._id) });
      expect(inB.body.data.map((l) => l.name)).toEqual(['In B']);

      const other = await makeBranch('Branch C');
      const empty = await getDetail(token, exec._id, { branchId: String(other._id) });
      expect(empty.status).toBe(200);
      expect(empty.body.data).toEqual([]);
      expect(empty.body.summary).toEqual(ZERO);
    });

    test('bucket filter narrows the rows and total but never the summary', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      await Promise.all([
        makeLead({ assignedTo: exec._id, statusReason: 'not_interested' }),
        makeLead({ assignedTo: exec._id, statusReason: 'booked_elsewhere' }),
        makeLead({ assignedTo: exec._id, statusReason: 'discussed_package' }),
        makeLead({ assignedTo: exec._id, statusReason: '' }),
      ]);
      const token = await tokenFor(admin);
      const cold = await getDetail(token, exec._id, { bucket: 'cold' });
      expect(cold.body.data.map((l) => l.bucket)).toEqual(['cold', 'cold']);
      expect(cold.body.pagination.total).toBe(2);
      expect(cold.body.summary).toEqual({ assigned: 4, cold: 2, warm: 1, hot: 0, unclassified: 1 });
      expect((await getDetail(token, exec._id, { bucket: 'unclassified' })).body.pagination.total).toBe(1);
      expect((await getDetail(token, exec._id, { bucket: 'hot' })).body.data).toEqual([]);
    });

    test('pagination is deterministic (assignedAt desc, then _id) with no overlap; out-of-range page is empty', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      const same = new Date();
      for (let i = 0; i < 5; i += 1) await makeLead({ assignedTo: exec._id, assignedAt: same });
      await makeLead({ assignedTo: exec._id, assignedAt: new Date(same.getTime() + 1000), name: 'Newest' });
      const token = await tokenFor(admin);
      const p1 = await getDetail(token, exec._id, { page: 1, limit: 4 });
      const p2 = await getDetail(token, exec._id, { page: 2, limit: 4 });
      const again = await getDetail(token, exec._id, { page: 1, limit: 4 });
      expect(p1.body.data[0].name).toBe('Newest');
      expect(p1.body.pagination).toMatchObject({ page: 1, limit: 4, total: 6, totalPages: 2 });
      expect(p1.body.data.map((l) => l._id)).toEqual(again.body.data.map((l) => l._id));
      expect(p2.body.data).toHaveLength(2);
      expect(new Set([...p1.body.data, ...p2.body.data].map((l) => l._id)).size).toBe(6);
      expect((await getDetail(token, exec._id, { page: 9, limit: 4 })).body.data).toEqual([]);
      expect((await getDetail(token, exec._id, { limit: 100000 })).body.pagination.limit).toBe(100);
    });

    test('an executive with no leads returns an empty, well-formed result; unknown or non-executive ids are 404', async () => {
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive', { name: 'Kiran' });
      const leader = await makeUser('team_leader');
      const token = await tokenFor(admin);
      const res = await getDetail(token, exec._id);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ data: [], summary: ZERO });
      expect(res.body.executive.name).toBe('Kiran');
      expect((await getDetail(token, new mongoose.Types.ObjectId())).status).toBe(404);
      expect((await getDetail(token, leader._id)).status).toBe(404);
    });

    test('phone is masked (XXXX) until the assigned executive has logged a call; no internal fields leak', async () => {
      const CallNote = require('../../src/models/CallNote');
      const admin = await makeUser('admin');
      const exec = await makeUser('sales_executive');
      await makeLead({ assignedTo: exec._id, name: 'Untouched' });
      const called = await makeLead({ assignedTo: exec._id, name: 'Called', phone: '9876543210' });
      await CallNote.create({ leadId: called._id, userId: exec._id, outcome: 'discussed_package' });
      const res = await getDetail(await tokenFor(admin), exec._id);
      const byName = Object.fromEntries(res.body.data.map((l) => [l.name, l]));
      expect(byName.Untouched.phone).toBe('XXXX');
      expect(byName.Called.phone).toBe('9876543210');
      expect(byName.Called).not.toHaveProperty('assignedTo');
      expect(byName.Called).not.toHaveProperty('phoneVisible');
    });
  });

  describe('validation', () => {
    const ID = '000000000000000000000000';
    test.each([
      ['not-an-id', {}],
      [ID, { dateFrom: 'garbage' }],
      [ID, { dateFrom: '2026-03-11', dateTo: '2026-03-10' }],
      [ID, { bucket: 'lukewarm' }],
      [ID, { 'bucket[$ne]': 'cold' }],
      [ID, { source: 'nope' }],
      [ID, { 'source[$ne]': 'dpw' }],
    ])('rejects executive=%s query=%j with 400', async (id, query) => {
      const admin = await makeUser('admin');
      expect((await getDetail(await tokenFor(admin), id, query)).status).toBe(400);
    });
  });

  describe('query shape', () => {
    test('one leads aggregation and one call-gate aggregation per page — no per-lead queries', async () => {
      const admin = await makeUser('admin');
      const token = await tokenFor(admin);
      const exec = await makeUser('sales_executive');
      await Lead.insertMany(
        Array.from({ length: 80 }, (_, i) => ({
          name: `Bulk ${i}`, phone: `8${String(200000000 + i)}`, leadId: `L-8${String(i).padStart(4, '0')}`,
          destination: 'Goa', createdBy: admin._id, assignedTo: exec._id, assignedAt: new Date(),
          statusReason: i % 2 ? 'ready_to_book' : '',
        }))
      );
      await leadStatusConfigService.getConfig({ force: true });
      const ops = [];
      mongoose.set('debug', (collection, method) => ops.push(`${collection}.${method}`));
      try {
        const res = await getDetail(token, exec._id, { limit: 50 });
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(50);
        expect(res.body.pagination.total).toBe(80);
      } finally {
        mongoose.set('debug', false);
      }
      expect(ops.filter((op) => op.startsWith('leads.'))).toEqual(['leads.aggregate']);
      expect(ops.filter((op) => op.startsWith('callnotes.'))).toEqual(['callnotes.aggregate']);
      expect(ops.length).toBeLessThanOrEqual(6);
    });
  });
});
