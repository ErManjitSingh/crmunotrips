/**
 * Cold Calling workspace shell (Phase 2): routing target, navigation, identity, honest empty states.
 * Run with: node --test src/lib/__tests__/coldCallingWorkspace.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_DASHBOARD_PATHS } from '../../auth/constants.js';
import {
  COLD_CALLING_HOME_PATH,
  EMPTY_CALLING_SUMMARY,
  getDayPartGreeting,
  getWorkspaceIdentity,
  getInitials,
} from '../coldCallingWorkspace.js';
import { coldCallingNavItems } from '../../components/cold-calling/sidebar-config.js';
import { renderToHtml } from './renderJsx.mjs';

const amit = { name: 'Amit Sharma', email: 'amit@example.com', role: 'cold_calling', roleName: 'Cold Calling' };

const dashboardHtml = (user, now = "new Date(2026, 8, 21, 9, 0)") =>
  renderToHtml(`
    import { renderToStaticMarkup } from 'react-dom/server';
    import { ColdCallingDashboardView } from './components/cold-calling/ColdCallingViews';
    export default () => renderToStaticMarkup(<ColdCallingDashboardView user={${JSON.stringify(user)}} now={${now}} />);
  `);

test('Cold Calling users land on /cold-calling (not /unauthorized); every other role is unchanged', () => {
  assert.equal(ROLE_DASHBOARD_PATHS.cold_calling, '/cold-calling');
  assert.equal(COLD_CALLING_HOME_PATH, '/cold-calling');
  assert.notEqual(ROLE_DASHBOARD_PATHS.cold_calling, '/unauthorized');
  assert.deepEqual(
    { ...ROLE_DASHBOARD_PATHS, cold_calling: undefined },
    {
      admin: '/admin/dashboard',
      sales_manager: '/sales-manager/dashboard',
      sales_executive: '/sales-executive/dashboard',
      team_leader: '/team-leader/dashboard',
      accountant: '/accountant/dashboard',
      operations_manager: '/operations-manager/dashboard',
      hr_admin: '/hr/dashboard',
      lead_provider: '/lead-provider/dashboard',
      cold_calling: undefined,
    }
  );
});

test('the sidebar has only Dashboard and My Leads, both inside the workspace', () => {
  assert.deepEqual(coldCallingNavItems.map((i) => [i.label, i.path]), [
    ['Dashboard', '/cold-calling'],
    ['My Leads', '/cold-calling/leads'],
  ]);
  assert.ok(coldCallingNavItems.every((i) => i.section === 'COLD CALLING'));
  for (const item of coldCallingNavItems) assert.ok(item.path.startsWith('/cold-calling'), item.path);
});

test('greeting follows the time of day', () => {
  assert.equal(getDayPartGreeting(new Date(2026, 0, 1, 6)), 'Good morning');
  assert.equal(getDayPartGreeting(new Date(2026, 0, 1, 11, 59)), 'Good morning');
  assert.equal(getDayPartGreeting(new Date(2026, 0, 1, 12)), 'Good afternoon');
  assert.equal(getDayPartGreeting(new Date(2026, 0, 1, 16, 59)), 'Good afternoon');
  assert.equal(getDayPartGreeting(new Date(2026, 0, 1, 17)), 'Good evening');
  assert.equal(getDayPartGreeting(new Date(2026, 0, 1, 23)), 'Good evening');
});

test('identity comes from the authenticated user, with the Cold Calling role label', () => {
  assert.deepEqual(getWorkspaceIdentity(amit), { fullName: 'Amit Sharma', firstName: 'Amit', roleLabel: 'Cold Calling' });
  assert.equal(getWorkspaceIdentity({ name: 'Priya Nair', role: 'cold_calling' }).roleLabel, 'Cold Calling');
  assert.equal(getWorkspaceIdentity({ name: '  Ravi  ', role: 'cold_calling' }).firstName, 'Ravi');
  assert.equal(getInitials('Amit Sharma'), 'AS');
  assert.equal(getInitials(''), 'U');
});

test('missing user data never crashes', () => {
  for (const user of [undefined, null, {}, { name: '' }]) {
    const identity = getWorkspaceIdentity(user);
    assert.equal(identity.firstName, '');
    assert.equal(identity.roleLabel, 'Cold Calling');
  }
});

test('the empty summary is real zeros for exactly the five cards (no placeholder numbers)', () => {
  assert.deepEqual({ ...EMPTY_CALLING_SUMMARY }, { assigned: 0, calledToday: 0, stillCold: 0, movedToWarm: 0, movedToHot: 0 });
  assert.ok(Object.isFrozen(EMPTY_CALLING_SUMMARY));
});

test('the dashboard renders: greeting with the user\'s first name, full name and role label', async () => {
  const html = await dashboardHtml(amit);
  assert.match(html, /Good morning, Amit/);
  assert.match(html, /Amit Sharma/);
  assert.match(html, /Cold Calling Workspace/);
  assert.match(html, />Cold Calling</);
  assert.match(html, /Your Cold Calling activity will appear here once leads are assigned to you/);
});

test('the name is taken from the authenticated user, not hardcoded', async () => {
  const html = await dashboardHtml({ name: 'Priya Nair', role: 'cold_calling' }, 'new Date(2026, 8, 21, 20, 0)');
  assert.match(html, /Good evening, Priya/);
  assert.match(html, /Priya Nair/);
  assert.doesNotMatch(html, /Amit/);
});

test('the five summary cards show honest zeros', async () => {
  const html = await dashboardHtml(amit);
  for (const label of ['Assigned Leads', 'Called Today', 'Still Cold', 'Moved to Warm', 'Moved to Hot']) {
    assert.match(html, new RegExp(label));
  }
  const values = [...html.matchAll(/metric-tabular[^"]*text-2xl[^"]*">([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(values, ['0', '0', '0', '0', '0']);
});

test('the calling queue shows its empty state and no lead rows or fake data', async () => {
  const html = await dashboardHtml(amit);
  assert.match(html, /Your Calling Queue/);
  assert.match(html, /No leads assigned yet/);
  assert.match(html, /Leads assigned to you for Cold Calling will appear here/);
  assert.doesNotMatch(html, /<table|<tr|<li|LD-\d|E2E|XXXX/);
  assert.doesNotMatch(html, />[1-9]\d*</); // no non-zero number is rendered anywhere
});

test('the dashboard tolerates a user without a name', async () => {
  const html = await dashboardHtml({ role: 'cold_calling' });
  assert.match(html, /Good morning</);
  assert.match(html, /No leads assigned yet/);
});

test('My Leads renders the empty queue and no lead data', async () => {
  const html = await renderToHtml(`
    import { renderToStaticMarkup } from 'react-dom/server';
    import { ColdCallingMyLeadsView } from './components/cold-calling/ColdCallingViews';
    export default () => renderToStaticMarkup(<ColdCallingMyLeadsView />);
  `);
  assert.match(html, /My Leads/);
  assert.match(html, /No leads assigned yet/);
  assert.doesNotMatch(html, /<table|<tr|<li|LD-\d/);
});
