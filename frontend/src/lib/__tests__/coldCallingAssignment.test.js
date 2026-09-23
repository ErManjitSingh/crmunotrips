/**
 * Phase 3 (Admin assigns Cold leads to Cold Calling): selection rules, messages, and rendering.
 * Run with: node --test src/lib/__tests__/coldCallingAssignment.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignableLeadIds,
  canSubmitAssignment,
  coldCallingIndicator,
  describeAssignError,
  describeAssignSuccess,
  isAssignableToColdCalling,
  pruneSelection,
  selectAllState,
  toggleAll,
  toggleId,
} from '../coldCallingAssignment.js';
import { buildCallingSummary } from '../coldCallingWorkspace.js';
import { renderToHtml } from './renderJsx.mjs';

const cold = (id, extra = {}) => ({ _id: id, name: `Lead ${id}`, bucket: 'cold', statusReason: 'not_interested', coldCalling: null, ...extra });
const leads = [
  cold('a'),
  cold('b'),
  cold('c', { coldCalling: { coldCallerName: 'Amit Sharma' } }), // already assigned
  { _id: 'd', name: 'Lead d', bucket: 'warm', coldCalling: null },
];

test('only Cold leads that are not already with an agent are selectable', () => {
  assert.equal(isAssignableToColdCalling(leads[0]), true);
  assert.equal(isAssignableToColdCalling(leads[2]), false);
  assert.equal(isAssignableToColdCalling(leads[3]), false);
  assert.equal(isAssignableToColdCalling(null), false);
  assert.deepEqual(assignableLeadIds(leads), ['a', 'b']);
});

test('selecting, deselecting, select all visible and clear', () => {
  let selected = [];
  selected = toggleId(selected, 'a');
  assert.deepEqual(selected, ['a']);
  assert.equal(selectAllState(selected, leads), 'some');
  selected = toggleAll(selected, leads);
  assert.deepEqual(selected, ['a', 'b']); // the already-assigned and non-Cold rows are never picked up
  assert.equal(selectAllState(selected, leads), 'all');
  assert.deepEqual(toggleAll(selected, leads), []); // toggling when all are selected clears
  assert.deepEqual(toggleId(['a', 'b'], 'a'), ['b']);
  assert.equal(selectAllState([], leads), 'none');
  assert.equal(selectAllState([], [leads[2], leads[3]]), 'none'); // nothing selectable
});

test('the selection is pruned to rows that are still visible and assignable', () => {
  assert.deepEqual(pruneSelection(['a', 'x', 'c', 'd'], leads), ['a']);
  assert.deepEqual(pruneSelection(['a'], []), []);
});

test('the indicator: agent name, "Unassigned" for Cold leads only, nothing for other buckets', () => {
  assert.deepEqual(coldCallingIndicator(leads[2]), { kind: 'assigned', label: 'Cold Calling: Amit Sharma' });
  assert.deepEqual(coldCallingIndicator(leads[0]), { kind: 'unassigned', label: 'Unassigned' });
  assert.equal(coldCallingIndicator(leads[3]), null);
  // history is still shown after the lead moved on from Cold
  assert.equal(coldCallingIndicator({ bucket: 'warm', coldCalling: { coldCallerName: 'Amit' } }).label, 'Cold Calling: Amit');
});

test('success message names the agent and counts, including the already-assigned case', () => {
  assert.equal(describeAssignSuccess({ assignedCount: 5, alreadyAssignedCount: 0, coldCaller: { name: 'Amit Sharma' } }), '5 leads assigned to Amit Sharma for Cold Calling.');
  assert.equal(describeAssignSuccess({ assignedCount: 1, alreadyAssignedCount: 0, coldCaller: { name: 'Amit Sharma' } }), '1 lead assigned to Amit Sharma for Cold Calling.');
  assert.equal(describeAssignSuccess({ assignedCount: 2, alreadyAssignedCount: 1, coldCaller: { name: 'Amit' } }), '2 leads assigned to Amit for Cold Calling. 1 already assigned.');
  assert.equal(describeAssignSuccess({ assignedCount: 0, alreadyAssignedCount: 3, coldCaller: { name: 'Amit' } }), '3 leads already assigned to Amit. Nothing changed.');
});

test('a 409 becomes a headline plus a per-lead reason with the lead name', () => {
  const error = { response: { status: 409, data: { message: 'No leads were assigned.', failures: [{ leadId: 'a', code: 'already_assigned', message: 'Already assigned to Amit Sharma' }] } } };
  assert.deepEqual(describeAssignError(error, { a: 'Priya Nair' }), {
    message: 'No leads were assigned.',
    failures: [{ leadId: 'a', label: 'Priya Nair', message: 'Already assigned to Amit Sharma' }],
  });
  assert.equal(describeAssignError({ message: 'Network Error' }).failures.length, 0);
  assert.match(describeAssignError({ message: 'Network Error' }).message, /Nothing was assigned/);
});

test('submit needs an agent, a selection, and no request already in flight (double-click safe)', () => {
  assert.equal(canSubmitAssignment({ coldCallerId: 'u1', count: 3, pending: false }), true);
  assert.equal(canSubmitAssignment({ coldCallerId: '', count: 3, pending: false }), false);
  assert.equal(canSubmitAssignment({ coldCallerId: 'u1', count: 0, pending: false }), false);
  assert.equal(canSubmitAssignment({ coldCallerId: 'u1', count: 3, pending: true }), false);
});

test('the workspace summary is real for Assigned and "not known" for the rest; unknown total stays null', () => {
  assert.deepEqual(buildCallingSummary(7), { assigned: 7, calledToday: null, stillCold: null, movedToWarm: null, movedToHot: null });
  assert.equal(buildCallingSummary(undefined).assigned, null);
  assert.equal(buildCallingSummary(0).assigned, 0);
});

const listHtml = (leadsJson, selection) =>
  renderToHtml(`
    import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    import ExecutiveLeadsList from './components/executive-lead-status/ExecutiveLeadsList';
    const selection = ${selection};
    export default () => renderToStaticMarkup(<MemoryRouter><ExecutiveLeadsList leads={${leadsJson}} loading={false} emptyMessage="none" selection={selection} /></MemoryRouter>);
  `);

const rowLeads = JSON.stringify(leads);

test('no checkboxes outside the Cold tab (selection not passed)', async () => {
  const html = await listHtml(rowLeads, 'undefined');
  assert.doesNotMatch(html, /type="checkbox"/);
});

test('Cold tab: header + row checkboxes; assigned rows are disabled; selected rows are checked', async () => {
  const html = await listHtml(rowLeads, '{ selectedIds: ["a"], onToggle() {}, onToggleAll() {} }');
  assert.match(html, /aria-label="Select all visible unassigned Cold leads"/);
  const rowBoxes = [...html.matchAll(/<input[^>]*aria-label="Select Lead ([a-d])"[^>]*>/g)];
  // desktop table + mobile cards each render one box per lead
  assert.equal(rowBoxes.length, 8);
  const byLead = (id) => rowBoxes.filter((m) => m[1] === id).map((m) => m[0]);
  // match the HTML attribute (the class list also contains "disabled:" utilities)
  for (const box of byLead('a')) assert.match(box, /\schecked=/);
  for (const box of byLead('b')) assert.doesNotMatch(box, /\schecked=/);
  for (const box of [...byLead('c'), ...byLead('d')]) assert.match(box, /\sdisabled=/); // already assigned / not Cold
  for (const box of [...byLead('a'), ...byLead('b')]) assert.doesNotMatch(box, /\sdisabled=/);
});

test('the status cell shows "Cold Calling: <agent>" or "Unassigned" beneath the status', async () => {
  const html = await listHtml(rowLeads, 'undefined');
  assert.match(html, /data-cold-calling="assigned"[^>]*>.*?Cold Calling: Amit Sharma/);
  assert.match(html, /data-cold-calling="unassigned"[^>]*>.*?Unassigned/);
  assert.equal([...html.matchAll(/data-cold-calling="unassigned"/g)].length, 4); // two Cold, unassigned leads x (table + card)
  assert.doesNotMatch(html, /Cold Calling: undefined/);
});

const myLeadsHtml = (rows) =>
  renderToHtml(`
    import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    import { ColdCallingMyLeadsView } from './components/cold-calling/ColdCallingViews';
    export default () => renderToStaticMarkup(<MemoryRouter><ColdCallingMyLeadsView rows={${JSON.stringify(rows)}} pagination={{ total: ${rows.length}, totalPages: 1 }} /></MemoryRouter>);
  `);

const myRow = {
  assignmentId: 'as1',
  assignedAt: '2026-09-21T05:00:00.000Z',
  lead: { _id: '6ab0f453be0dc76659ef6766', name: 'Priya Nair' },
  bucket: 'warm',
  status: 'follow_up',
  statusReason: 'requested_callback',
  initial: { bucket: 'cold', statusReason: 'not_interested' },
  originalSalesOwner: { _id: 'u1', name: 'Rahul' },
  currentSalesOwner: { _id: 'u2', name: 'Sippy' },
};

test('My Leads: the six required columns, original vs current owner, current status, read-only', async () => {
  const html = await myLeadsHtml([myRow]);
  for (const header of ['Lead', 'Customer', 'Original Sales Executive', 'Current Sales Owner', 'Status', 'Assigned At']) {
    assert.match(html, new RegExp(`>${header}<`));
  }
  assert.match(html, /Priya Nair/);
  assert.match(html, />Rahul</);
  assert.match(html, />Sippy</);
  assert.match(html, /Warm/); // current bucket, not the initial Cold snapshot
  assert.match(html, /21 Sept? 2026/);
  // read-only apart from the calling actions: no links into Lead Detail, no inputs, no number in the page
  assert.doesNotMatch(html, /<a |<input|href=/);
  assert.doesNotMatch(html, /whatsapp|tel:/i);
  assert.doesNotMatch(html, /9d{9}/);
});

test('My Leads: empty state when nothing is assigned, and an error state with retry', async () => {
  const empty = await myLeadsHtml([]);
  assert.match(empty, /No leads assigned yet/);
  const failed = await renderToHtml(`
    import { renderToStaticMarkup } from 'react-dom/server';
    import { ColdCallingMyLeadsView } from './components/cold-calling/ColdCallingViews';
    export default () => renderToStaticMarkup(<ColdCallingMyLeadsView error="boom" onRetry={() => {}} />);
  `);
  assert.match(failed, /load your leads/);
  assert.match(failed, /Try again/);
  assert.doesNotMatch(failed, /No leads assigned yet/); // an error is not an empty list
});

test('Dashboard: real assigned count + View My Leads; other cards show an em dash, never a fake zero', async () => {
  const html = await renderToHtml(`
    import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    import { ColdCallingDashboardView } from './components/cold-calling/ColdCallingViews';
    import { buildCallingSummary } from './lib/coldCallingWorkspace';
    export default () => renderToStaticMarkup(<MemoryRouter><ColdCallingDashboardView user={{ name: 'Amit Sharma' }} summary={buildCallingSummary(5)} now={new Date(2026, 8, 21, 9)} /></MemoryRouter>);
  `);
  const values = [...html.matchAll(/metric-tabular[^"]*text-2xl[^"]*">([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(values, ['5', '—', '—', '—', '—']);
  assert.match(html, /View My Leads/);
  assert.match(html, /href="\/cold-calling\/leads"/);
  assert.doesNotMatch(html, /No leads assigned yet/);
});
