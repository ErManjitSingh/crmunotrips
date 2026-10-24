const request = require('supertest');
const mongoose = require('mongoose');
const db = require('../setup/db');

let app;
let User;
let Lead;
let CallNote;
let FollowUp;
let LeadActivity;
let AuditLog;
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
  UserSession = require('../../src/models/UserSession');
  leadStatusConfigService = require('../../src/services/leadStatusConfigService');
  ({ generateToken } = require('../../src/middleware/auth'));
});

afterEach(async () => {
  await db.clearCollections();
  // The config service caches the Lead Status config in-process (30s TTL) — clear it so each
  // test reads a fresh copy after clearCollections() wipes the underlying document.
  leadStatusConfigService.invalidateCache();
});

afterAll(async () => {
  await db.disconnect();
});

let counter = 0;

/** Auth via a directly-minted session/token — avoids depending on the unrelated
 * login-window/EOD feature's time-of-day gating for a test about category/outcome validation. */
async function makeAuthedUser(role = 'sales_executive') {
  counter += 1;
  const user = await User.create({
    name: `Exec ${counter}`,
    email: `catvalidation${counter}@example.com`,
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
  const token = generateToken(user._id, role, session.sessionId);
  return { user, token };
}

/** Pass `assignedTo` — a Sales Executive may only log calls on their own leads. */
async function makeLead(overrides = {}) {
  counter += 1;
  const creator = await User.create({
    name: `Creator ${counter}`,
    email: `creator${counter}@example.com`,
    password: 'password123',
    role: 'admin',
  });
  return Lead.create({
    name: `Lead ${counter}`,
    phone: `9${String(1000000000 + counter).slice(0, 9)}`,
    destination: 'Goa',
    createdBy: creator._id,
    ...overrides,
  });
}

async function countRelatedDocs(leadId) {
  const [callNotes, followUps, leadActivities, auditLogs] = await Promise.all([
    CallNote.countDocuments({ leadId }),
    FollowUp.countDocuments({ lead: leadId }),
    LeadActivity.countDocuments({ leadId }),
    AuditLog.countDocuments({ entityType: 'lead', entityId: leadId }),
  ]);
  return { callNotes, followUps, leadActivities, auditLogs };
}

async function postCallNote(token, leadId, body) {
  return request(app)
    .post(`/api/leads/${leadId}/call-notes`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

describe('Call Note category <-> outcome backend validation', () => {
  describe('VALID combinations — accepted', () => {
    test('1. category=hot, outcome=ready_to_book -> ACCEPT', async () => {
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { category: 'hot', outcome: 'ready_to_book' });
      expect(res.status).toBe(201);
      expect(res.body.outcome).toBe('ready_to_book');
      expect(res.body.status).toBe('negotiation');

      const updated = await Lead.findById(lead._id).lean();
      expect(updated.temperature).toBe('hot');
      expect(updated.isHot).toBe(true);
      const counts = await countRelatedDocs(lead._id);
      expect(counts.callNotes).toBe(1);
    });

    // NOTE: the task's own example used "package_discussed" — the actual configured key
    // (Lead Status config default, backend/src/services/leadStatusConfigService.js) is
    // "discussed_package" (label "Package discussed"). Using the real key here.
    test('2. category=warm, outcome=discussed_package -> ACCEPT', async () => {
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { category: 'warm', outcome: 'discussed_package' });
      expect(res.status).toBe(201);

      const updated = await Lead.findById(lead._id).lean();
      expect(updated.temperature).toBe('warm');
    });

    test('3. category=cold, outcome=budget_issues -> ACCEPT', async () => {
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { category: 'cold', outcome: 'budget_issues' });
      expect(res.status).toBe(201);

      const updated = await Lead.findById(lead._id).lean();
      expect(updated.temperature).toBe('cold');
      expect(updated.isHot).toBe(false);
    });

    test('8. category omitted, outcome=ready_to_book -> category derived as hot, ACCEPT (preserves existing derive-from-outcome behavior)', async () => {
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { outcome: 'ready_to_book' });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('negotiation');

      const updated = await Lead.findById(lead._id).lean();
      expect(updated.temperature).toBe('hot');
    });
  });

  describe('INVALID combinations — rejected with zero database side effects', () => {
    test('4. category=cold, outcome=ready_to_book -> REJECT, no mutation of any kind', async () => {
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const before = await Lead.findById(lead._id).lean();
      const beforeCounts = await countRelatedDocs(lead._id);

      const res = await postCallNote(token, lead._id, { category: 'cold', outcome: 'ready_to_book' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not belong to/i);

      const after = await Lead.findById(lead._id).lean();
      expect(after.temperature).toBe(before.temperature);
      expect(after.status).toBe(before.status);
      expect(after.isHot).toBe(before.isHot);
      expect(after.callStats).toEqual(before.callStats);
      const afterCounts = await countRelatedDocs(lead._id);
      expect(afterCounts).toEqual(beforeCounts);
      expect(afterCounts.callNotes).toBe(0);
      expect(afterCounts.followUps).toBe(0);
      expect(afterCounts.leadActivities).toBe(0);
      expect(afterCounts.auditLogs).toBe(0);
    });

    test('5. category=hot, outcome=budget_issues -> REJECT', async () => {
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { category: 'hot', outcome: 'budget_issues' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/does not belong to/i);
      const counts = await countRelatedDocs(lead._id);
      expect(counts.callNotes).toBe(0);
    });

    test('6. category=warm, outcome=invalid_outcome_xyz -> REJECT (unknown outcome, never guessed as warm)', async () => {
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { category: 'warm', outcome: 'invalid_outcome_xyz' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/unknown call outcome/i);
      const counts = await countRelatedDocs(lead._id);
      expect(counts.callNotes).toBe(0);
      const after = await Lead.findById(lead._id).lean();
      expect(after.temperature).toBe('cold'); // untouched schema default — never mutated
    });

    test('7. category=invalid_category, outcome=ready_to_book -> REJECT', async () => {
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { category: 'invalid_category', outcome: 'ready_to_book' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid status category/i);
      const counts = await countRelatedDocs(lead._id);
      expect(counts.callNotes).toBe(0);
    });
  });

  describe('Admin configuration changes are picked up automatically, without code changes', () => {
    test('a newly-added Hot outcome is immediately accepted under Hot and rejected under any other category', async () => {
      // Simulate an admin adding "Documents Required" under Hot via the existing config service —
      // the exact same write path the Lead Status settings page uses.
      const current = await leadStatusConfigService.getConfig({ includeDisabled: true });
      await leadStatusConfigService.saveConfig(
        {
          warm: current.warm,
          hot: [...current.hot, { key: 'documents_required', label: 'Documents Required' }],
          cold: current.cold,
        },
        null
      );

      const { token, user } = await makeAuthedUser();

      const leadOk = await makeLead({ assignedTo: user._id });
      const okRes = await postCallNote(token, leadOk._id, { category: 'hot', outcome: 'documents_required' });
      expect(okRes.status).toBe(201);

      const leadBad = await makeLead({ assignedTo: user._id });
      const badRes = await postCallNote(token, leadBad._id, { category: 'cold', outcome: 'documents_required' });
      expect(badRes.status).toBe(400);
      expect(badRes.body.message).toMatch(/does not belong to/i);
    });

    test('removing an outcome from the config makes it an unknown outcome again', async () => {
      const current = await leadStatusConfigService.getConfig({ includeDisabled: true });
      await leadStatusConfigService.saveConfig(
        {
          warm: current.warm,
          hot: [], // "Ready to Book" removed entirely
          cold: current.cold,
        },
        null
      );

      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { category: 'hot', outcome: 'ready_to_book' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/unknown call outcome/i);
    });
  });

  describe('Real-world bug report: admin-added outcomes (package_shared / plan_cancel / no_plan) that the old static CallNote enum used to reject', () => {
    async function seedReportedLiveConfig() {
      const current = await leadStatusConfigService.getConfig({ includeDisabled: true });
      await leadStatusConfigService.saveConfig(
        {
          warm: [...current.warm, { key: 'package_shared', label: 'Package shared' }],
          hot: current.hot,
          cold: [
            ...current.cold,
            { key: 'plan_cancel', label: 'Plan cancelled' },
            { key: 'no_plan', label: 'No plan' },
          ],
        },
        null
      );
    }

    test('A. category=warm, outcome=package_shared -> SUCCESS (configured Warm outcome)', async () => {
      await seedReportedLiveConfig();
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { category: 'warm', outcome: 'package_shared' });
      expect(res.status).toBe(201);
      const updated = await Lead.findById(lead._id).lean();
      expect(updated.temperature).toBe('warm');

      const note = await CallNote.findById(res.body._id).lean();
      const { bucketOutcome } = require('../../src/models/CallNote');
      expect(bucketOutcome(note.outcome)).toBe('connected'); // Call Report classification, not 'failed'
    });

    test('B. category=cold, outcome=plan_cancel -> SUCCESS (configured Cold outcome)', async () => {
      await seedReportedLiveConfig();
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { category: 'cold', outcome: 'plan_cancel' });
      expect(res.status).toBe(201);
      const updated = await Lead.findById(lead._id).lean();
      expect(updated.temperature).toBe('cold');
    });

    test('C. category=cold, outcome=no_plan -> SUCCESS (configured Cold outcome)', async () => {
      await seedReportedLiveConfig();
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { category: 'cold', outcome: 'no_plan' });
      expect(res.status).toBe(201);
      const updated = await Lead.findById(lead._id).lean();
      expect(updated.temperature).toBe('cold');
    });

    test('D. category=hot, outcome=ready_to_book -> SUCCESS', async () => {
      await seedReportedLiveConfig();
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { category: 'hot', outcome: 'ready_to_book' });
      expect(res.status).toBe(201);
    });

    test('E. category=cold, outcome=ready_to_book -> REJECT (cross-category, even with the new outcomes present)', async () => {
      await seedReportedLiveConfig();
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const before = await Lead.findById(lead._id).lean();
      const beforeCounts = await countRelatedDocs(lead._id);

      const res = await postCallNote(token, lead._id, { category: 'cold', outcome: 'ready_to_book' });
      expect(res.status).toBe(400);

      const after = await Lead.findById(lead._id).lean();
      expect(after.temperature).toBe(before.temperature);
      expect(await countRelatedDocs(lead._id)).toEqual(beforeCounts);
    });

    test('F. category=hot, outcome=budget_issues -> REJECT', async () => {
      await seedReportedLiveConfig();
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const res = await postCallNote(token, lead._id, { category: 'hot', outcome: 'budget_issues' });
      expect(res.status).toBe(400);
    });

    test('G. category=cold, outcome=totally_unknown_outcome -> REJECT, zero mutation', async () => {
      await seedReportedLiveConfig();
      const { token, user } = await makeAuthedUser();
      const lead = await makeLead({ assignedTo: user._id });
      const beforeCounts = await countRelatedDocs(lead._id);

      const res = await postCallNote(token, lead._id, { category: 'cold', outcome: 'totally_unknown_outcome' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/unknown call outcome/i);
      expect(await countRelatedDocs(lead._id)).toEqual(beforeCounts);
    });

    test('EXHAUSTIVE: every currently-configured Hot/Warm/Cold option in the Call Follow-up popup saves without error under its own category', async () => {
      await seedReportedLiveConfig();
      const { token, user } = await makeAuthedUser();
      const cfg = await leadStatusConfigService.getConfig({ includeDisabled: false });

      const cases = [
        ...cfg.hot.map((o) => ({ category: 'hot', outcome: o.key, label: o.label })),
        ...cfg.warm.map((o) => ({ category: 'warm', outcome: o.key, label: o.label })),
        ...cfg.cold.map((o) => ({ category: 'cold', outcome: o.key, label: o.label })),
      ];
      expect(cases.length).toBeGreaterThan(0);

      const failures = [];
      for (const { category, outcome, label } of cases) {
        // eslint-disable-next-line no-await-in-loop
        const lead = await makeLead({ assignedTo: user._id });
        // eslint-disable-next-line no-await-in-loop
        const res = await postCallNote(token, lead._id, { category, outcome });
        if (res.status !== 201) {
          failures.push({ category, outcome, label, status: res.status, message: res.body?.message });
        }
      }

      expect(failures).toEqual([]);
    });

    test('package_shared / plan_cancel / no_plan are all classified as "connected" in Call Report bucketing, not "failed"', async () => {
      const { bucketOutcome } = require('../../src/models/CallNote');
      expect(bucketOutcome('package_shared')).toBe('connected');
      expect(bucketOutcome('plan_cancel')).toBe('connected');
      expect(bucketOutcome('no_plan')).toBe('connected');
    });
  });
});
