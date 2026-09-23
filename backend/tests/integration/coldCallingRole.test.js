const request = require('supertest');
const mongoose = require('mongoose');
const db = require('../setup/db');

let app;
let User;
let Role;
let UserSession;
let generateToken;
let ensureSystemRoles;
let ROLES;
let ROLE_LABELS;
let ROLE_DASHBOARD_PATHS;
let ROLE_PERMISSIONS;
let counter = 0;

const EXISTING_ROLES = [
  'admin', 'sales_manager', 'team_leader', 'sales_executive', 'accountant', 'operations_manager', 'hr_admin', 'lead_provider',
];

beforeAll(async () => {
  await db.connect();
  app = require('../../src/server');
  User = require('../../src/models/User');
  Role = require('../../src/models/Role');
  UserSession = require('../../src/models/UserSession');
  ({ generateToken } = require('../../src/middleware/auth'));
  ({ ensureSystemRoles } = require('../../src/config/ensureSystemRoles'));
  ({ ROLES, ROLE_LABELS, ROLE_DASHBOARD_PATHS } = require('../../src/config/roles'));
  ({ ROLE_PERMISSIONS } = require('../../src/config/permissions'));
});

/** An existing database: the original roles already have their Role documents, Cold Calling does not. */
async function seedExistingRoles() {
  await Role.insertMany(
    EXISTING_ROLES.map((slug) => ({
      name: ROLE_LABELS[slug],
      slug,
      description: `${ROLE_LABELS[slug]} system role`,
      isSystem: true,
      permissions: ROLE_PERMISSIONS[slug],
    }))
  );
}

beforeEach(async () => {
  await seedExistingRoles();
});

afterEach(async () => {
  await db.clearCollections();
});

afterAll(async () => {
  await db.disconnect();
});

async function makeUser(role, overrides = {}) {
  counter += 1;
  return User.create({
    name: `${role} ${counter}`,
    email: `role${counter}@example.com`,
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

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const roleDoc = (slug) => Role.findOne({ slug });

async function createViaApi(token, role, extra = {}) {
  counter += 1;
  return request(app)
    .post('/api/users')
    .set(auth(token))
    .send({
      name: `Created ${counter}`,
      email: `created${counter}@example.com`,
      password: 'password123',
      roleId: String(role._id),
      department: 'Sales',
      status: 'active',
      ...extra,
    });
}

const allFalse = (perms) =>
  Object.values(perms).every((block) => Object.values(block).every((value) => value === false));

describe('role configuration', () => {
  test('cold_calling is a recognised role with the label "Cold Calling"', () => {
    expect(ROLES).toContain('cold_calling');
    expect(ROLE_LABELS.cold_calling).toBe('Cold Calling');
  });

  test('existing roles, labels and dashboards are unchanged', () => {
    expect(ROLES.filter((r) => r !== 'cold_calling')).toEqual(EXISTING_ROLES);
    expect(ROLE_LABELS).toMatchObject({
      admin: 'Admin', sales_manager: 'Sales Manager', team_leader: 'Team Leader', sales_executive: 'Sales Executive',
      accountant: 'Accountant', operations_manager: 'Operations Manager', hr_admin: 'HR Admin', lead_provider: 'Lead Provider',
    });
    expect(ROLE_DASHBOARD_PATHS.admin).toBe('/admin/dashboard');
    expect(ROLE_DASHBOARD_PATHS.sales_executive).toBe('/sales-executive/dashboard');
  });

  test('Cold Calling has an explicit permission set with every permission false', () => {
    expect(ROLE_PERMISSIONS.cold_calling).toBeDefined();
    expect(allFalse(ROLE_PERMISSIONS.cold_calling)).toBe(true);
  });

  test('User model accepts cold_calling and still rejects an unknown role', async () => {
    const ok = await makeUser('cold_calling');
    expect(ok.role).toBe('cold_calling');
    await expect(makeUser('not_a_role')).rejects.toThrow(/not_a_role|enum/i);
  });
});

describe('ensureSystemRoles (Role document for an existing database)', () => {
  test('inserts the missing Cold Calling role — and only that role', async () => {
    const before = await Role.countDocuments();
    expect(await roleDoc('cold_calling')).toBeNull();

    expect(await ensureSystemRoles()).toEqual(['cold_calling']);

    const doc = await roleDoc('cold_calling');
    expect(doc).toMatchObject({ name: 'Cold Calling', slug: 'cold_calling', isSystem: true });
    expect(allFalse(doc.permissions.toObject())).toBe(true);
    expect(await Role.countDocuments()).toBe(before + 1);
  });

  test('is idempotent and never overwrites an existing document (including admin-edited permissions)', async () => {
    await ensureSystemRoles();
    await Role.updateOne(
      { slug: 'cold_calling' },
      { $set: { description: 'edited by admin', 'permissions.leads.view': true } }
    );
    const others = await Role.find({ slug: { $ne: 'cold_calling' } }).lean();

    expect(await ensureSystemRoles()).toEqual([]);

    const doc = await roleDoc('cold_calling');
    expect(doc.description).toBe('edited by admin');
    expect(doc.permissions.leads.view).toBe(true);
    expect(await Role.countDocuments({ slug: 'cold_calling' })).toBe(1);
    expect(await Role.find({ slug: { $ne: 'cold_calling' } }).lean()).toEqual(others);
  });

  test('concurrent boots create exactly one document', async () => {
    await Promise.all([ensureSystemRoles(), ensureSystemRoles(), ensureSystemRoles()]).catch(() => {});
    expect(await Role.countDocuments({ slug: 'cold_calling' })).toBe(1);
  });

  test('refuses a slug that is not a configured role', async () => {
    await expect(ensureSystemRoles(['made_up'])).rejects.toThrow(/not a configured role/);
    expect(await Role.countDocuments({ slug: 'made_up' })).toBe(0);
  });
});

describe('Admin creates a Cold Calling user; authentication and /me', () => {
  test('Cold Calling appears in the roles list that feeds the Add/Edit User dropdowns', async () => {
    await ensureSystemRoles();
    const admin = await makeUser('admin');
    const res = await request(app).get('/api/roles').set(auth(await tokenFor(admin)));
    expect(res.status).toBe(200);
    const names = res.body.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['Cold Calling', 'Accountant', 'Admin', 'HR Admin', 'Lead Provider', 'Operations Manager', 'Sales Executive', 'Sales Manager', 'Team Leader']));
    expect(res.body.find((r) => r.slug === 'cold_calling')).toMatchObject({ isSystem: true });
  });

  test('create -> database -> login -> /me returns the Cold Calling role, with no permissions', async () => {
    await ensureSystemRoles();
    const admin = await makeUser('admin');
    const adminToken = await tokenFor(admin);
    const role = await roleDoc('cold_calling');

    const created = await createViaApi(adminToken, role, { email: 'caller@example.com', name: 'Test Caller' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ role: 'cold_calling', roleName: 'Cold Calling', email: 'caller@example.com' });
    expect(created.body).not.toHaveProperty('password');

    const stored = await User.findOne({ email: 'caller@example.com' }).select('+password');
    expect(stored.role).toBe('cold_calling');
    expect(String(stored.roleId)).toBe(String(role._id));
    expect(stored.password).not.toBe('password123');

    const login = await request(app).post('/api/auth/login').send({ email: 'caller@example.com', password: 'password123' });
    expect(login.status).toBe(200);
    expect(login.body).toMatchObject({ role: 'cold_calling', roleName: 'Cold Calling', dashboardPath: '/cold-calling' });
    expect(login.body.token).toBeTruthy();
    expect(allFalse(login.body.permissions)).toBe(true);
    expect(await UserSession.countDocuments({ userId: stored._id, status: 'active' })).toBe(1);

    const me = await request(app).get('/api/auth/me').set(auth(login.body.token));
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ role: 'cold_calling', roleName: 'Cold Calling', status: 'active' });
    expect(allFalse(me.body.permissions)).toBe(true);

    const logout = await request(app).post('/api/auth/logout').set(auth(login.body.token));
    expect(logout.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(auth(login.body.token))).status).toBe(401);
  });

  test('the user list shows the role as "Cold Calling"', async () => {
    await ensureSystemRoles();
    const admin = await makeUser('admin');
    const token = await tokenFor(admin);
    await createViaApi(token, await roleDoc('cold_calling'), { name: 'Listed Caller' });
    const res = await request(app).get('/api/users').set(auth(token));
    expect(res.status).toBe(200);
    const rows = res.body.data || res.body;
    expect(rows.find((u) => u.name === 'Listed Caller')).toMatchObject({ role: 'cold_calling', roleName: 'Cold Calling' });
  });

  test('Edit User: admin can move a user to Cold Calling and back; nothing else changes', async () => {
    await ensureSystemRoles();
    const admin = await makeUser('admin');
    const token = await tokenFor(admin);
    const exec = await makeUser('sales_executive', { roleId: (await roleDoc('sales_executive'))._id, department: 'Sales' });

    const toCold = await request(app).put(`/api/users/${exec._id}`).set(auth(token)).send({ roleId: String((await roleDoc('cold_calling'))._id) });
    expect(toCold.status).toBe(200);
    expect(toCold.body).toMatchObject({ role: 'cold_calling', roleName: 'Cold Calling', department: 'Sales', email: exec.email });

    const back = await request(app).put(`/api/users/${exec._id}`).set(auth(token)).send({ roleId: String((await roleDoc('sales_executive'))._id) });
    expect(back.body).toMatchObject({ role: 'sales_executive', roleName: 'Sales Executive' });
  });
});

describe('existing roles and validation are unaffected', () => {
  test.each(['sales_executive', 'sales_manager', 'accountant', 'team_leader', 'operations_manager'])(
    'admin can still create a %s user',
    async (slug) => {
      const admin = await makeUser('admin');
      const res = await createViaApi(await tokenFor(admin), await roleDoc(slug));
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ role: slug, roleName: ROLE_LABELS[slug] });
    }
  );

  test('an unknown roleId is rejected', async () => {
    const admin = await makeUser('admin');
    const res = await request(app).post('/api/users').set(auth(await tokenFor(admin))).send({
      name: 'X', email: 'x@example.com', password: 'password123', roleId: String(new mongoose.Types.ObjectId()),
    });
    expect(res.status).toBe(400);
  });

  test('a Role document whose slug is not a system role is still rejected', async () => {
    const admin = await makeUser('admin');
    const fake = await Role.create({ name: 'Fake', slug: 'fake_role', isSystem: false });
    const res = await createViaApi(await tokenFor(admin), fake);
    expect(res.status).toBe(400);
    expect(await User.countDocuments({ role: 'fake_role' })).toBe(0);
  });

  test('Lead Provider still creates ordinary users but cannot create Cold Calling (or other privileged) users', async () => {
    await ensureSystemRoles();
    const provider = await makeUser('lead_provider');
    const token = await tokenFor(provider);
    expect((await createViaApi(token, await roleDoc('sales_executive'))).status).toBe(201);
    for (const slug of ['cold_calling', 'admin', 'hr_admin', 'lead_provider']) {
      expect((await createViaApi(token, await roleDoc(slug))).status).toBe(403);
    }
  });
});

describe('RBAC: Cold Calling is fenced to an explicit allow-list (no extra access)', () => {
  const { isApiPathAllowedForRole } = require('../../src/middleware/restrictedRoleAccess');

  async function coldCallerToken() {
    await ensureSystemRoles();
    const caller = await makeUser('cold_calling', { roleId: (await roleDoc('cold_calling'))._id });
    return { caller, token: await tokenFor(caller) };
  }

  test('the endpoints needed just to be signed in still work', async () => {
    const { token } = await coldCallerToken();
    for (const url of ['/api/auth/me', '/api/notifications/unread-count', '/api/lead-status-config']) {
      const res = await request(app).get(url).set(auth(token));
      expect([url, res.status]).toEqual([url, 200]);
    }
    expect((await request(app).patch('/api/auth/session/heartbeat').set(auth(token))).status).toBeLessThan(400);
  });

  test('admin / manager / assignment / lead / user-management endpoints are forbidden', async () => {
    const { token } = await coldCallerToken();
    const someId = String(new mongoose.Types.ObjectId());
    const calls = [
      ['get', '/api/leads/analytics/executive-lead-status'],
      ['get', `/api/leads/analytics/executive-lead-status/${someId}/leads`],
      ['get', '/api/leads/analytics/executives'],
      ['post', '/api/leads/assign', { leadIds: [someId], assigneeRole: 'sales_executive', assigneeId: someId }],
      ['post', '/api/leads', { name: 'x', phone: '9000000000' }],
      ['post', '/api/leads/bulk-status', { leadIds: [someId], status: 'lost' }],
      ['post', '/api/users', {}],
      ['put', `/api/users/${someId}`, {}],
      ['delete', `/api/users/${someId}`],
      ['get', '/api/sales-manager/leads'],
      ['get', '/api/sales-manager/call-report/team-overview'],
      ['get', '/api/reports/analytics'],
    ];
    for (const [method, url, body] of calls) {
      const res = await request(app)[method](url).set(auth(token)).send(body);
      expect([method, url, res.status]).toEqual([method, url, 403]);
    }
  });

  test('read endpoints that are open to every other authenticated role are closed to Cold Calling', async () => {
    const { token } = await coldCallerToken();
    for (const url of [
      '/api/leads', '/api/leads/list-kpis', '/api/leads/assignees', '/api/users', '/api/roles', '/api/branches',
      '/api/followups', '/api/quotations', '/api/dashboard/stats', '/api/nav-counts', '/api/team/performance',
    ]) {
      const res = await request(app).get(url).set(auth(token));
      expect([url, res.status]).toEqual([url, 403]);
    }
  });

  test('POST /auth/register (creates a user with any role) is not reachable, and creates nothing', async () => {
    const { token } = await coldCallerToken();
    const before = await User.countDocuments();
    const res = await request(app)
      .post('/api/auth/register')
      .set(auth(token))
      .send({ name: 'Escalated', email: 'escalated@example.com', password: 'password123', role: 'admin' });
    expect(res.status).toBe(403);
    expect(await User.countDocuments()).toBe(before);
  });

  test('the fence cannot be dodged with case, slashes or look-alike prefixes', async () => {
    const { token } = await coldCallerToken();
    for (const url of ['/api/LEADS', '/api/Users', '//api/leads', '/api//leads', '/api/authx/me', '/api/auth/register/', '/api/notificationsx']) {
      const res = await request(app).get(url).set(auth(token));
      expect([url, [401, 403, 404].includes(res.status) && res.status !== 200]).toEqual([url, true]);
    }
    expect((await request(app).get('/api/LEADS').set(auth(token))).status).toBe(403);
    expect((await request(app).get('/api/AUTH/ME').set(auth(token))).status).toBe(200);
  });

  test('roles that are not fenced behave exactly as before', async () => {
    const exec = await makeUser('sales_executive', { roleId: (await roleDoc('sales_executive'))._id });
    const execToken = await tokenFor(exec);
    expect((await request(app).get('/api/leads').set(auth(execToken))).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set(auth(execToken))).status).toBe(200);
    const accountant = await makeUser('accountant', { roleId: (await roleDoc('accountant'))._id });
    expect((await request(app).get('/api/quotations').set(auth(await tokenFor(accountant)))).status).not.toBe(403);
    const admin = await makeUser('admin');
    expect((await request(app).get('/api/users').set(auth(await tokenFor(admin)))).status).toBe(200);
  });

  test('allow-list matcher: only listed roles are restricted; exact /auth paths only', () => {
    expect(isApiPathAllowedForRole('sales_executive', '/api/leads')).toBe(true);
    expect(isApiPathAllowedForRole('admin', '/api/users?x=1')).toBe(true);
    expect(isApiPathAllowedForRole('cold_calling', '/api/auth/me?x=1')).toBe(true);
    expect(isApiPathAllowedForRole('cold_calling', '/api/notifications')).toBe(true);
    expect(isApiPathAllowedForRole('cold_calling', '/api/notifications/abc/read')).toBe(true);
    expect(isApiPathAllowedForRole('cold_calling', '/api/auth/register')).toBe(false);
    expect(isApiPathAllowedForRole('cold_calling', '/api/auth')).toBe(false);
    expect(isApiPathAllowedForRole('cold_calling', '/api/notificationsx')).toBe(false);
    expect(isApiPathAllowedForRole('cold_calling', '/api/leads')).toBe(false);
  });

  test('the allow-list is exactly the sign-in endpoints plus the own read-only My Leads list', () => {
    const { RESTRICTED_ROLE_ALLOWED_PATHS } = require('../../src/middleware/restrictedRoleAccess');
    expect(RESTRICTED_ROLE_ALLOWED_PATHS.cold_calling).toEqual([
      '/auth/me',
      '/auth/logout',
      '/auth/session/heartbeat',
      '/auth/session/beacon',
      '/notifications/*',
      '/lead-status-config',
      '/cold-calling/my-leads', // Phase 3: own assignments only, scoped server-side by the session
      '/cold-calling/leads/*', // Phase 4: per-lead calling, gated by an active assignment in the router
    ]);
    expect(Object.keys(RESTRICTED_ROLE_ALLOWED_PATHS)).toEqual(['cold_calling']);
  });

  test('landing on the workspace needs no lead data: every call the workspace shell makes is allowed', async () => {
    const { token } = await coldCallerToken();
    // The shell polls unread notifications and the option labels, and keeps the session alive.
    for (const url of ['/api/notifications/unread-count', '/api/lead-status-config', '/api/auth/me']) {
      expect((await request(app).get(url).set(auth(token))).status).toBe(200);
    }
    // ...and nothing that carries lead, user or business data.
    for (const url of ['/api/nav-counts', '/api/leads', '/api/users', '/api/dashboard/stats']) {
      expect((await request(app).get(url).set(auth(token))).status).toBe(403);
    }
  });

  test('resolved permissions equal "none" even after the role document is read', async () => {
    const { resolveUserPermissions } = require('../../src/services/permissionsService');
    const { caller } = await coldCallerToken();
    expect(allFalse(await resolveUserPermissions(caller))).toBe(true);
  });
});
