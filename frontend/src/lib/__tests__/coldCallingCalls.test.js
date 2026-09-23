/**
 * Phase 4 (Cold Caller calls an assigned lead through the existing CRM calling mechanism).
 * Run with: node --test src/lib/__tests__/coldCallingCalls.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  callButtonLead,
  coldCallingCallAccessPath,
  coldCallingCallHistoryPath,
  coldCallingCallNotesPath,
  describeCallActivity,
  formatCallDateTime,
  outcomeLabel,
} from '../coldCallingCalls.js';
import { renderToHtml } from './renderJsx.mjs';

test('Cold Calling has its own assignment-gated twins of the three call endpoints — never the shared ones', () => {
  assert.equal(coldCallingCallAccessPath('abc'), '/cold-calling/leads/abc/call-access');
  assert.equal(coldCallingCallNotesPath('abc'), '/cold-calling/leads/abc/call-notes');
  assert.equal(coldCallingCallHistoryPath('abc'), '/cold-calling/leads/abc/call-history');
  for (const path of [coldCallingCallAccessPath('x'), coldCallingCallNotesPath('x'), coldCallingCallHistoryPath('x')]) {
    assert.doesNotMatch(path, /sales-executive|^\/leads\//);
  }
});

test('the call button is given a placeholder, never a real number', () => {
  const lead = callButtonLead({ lead: { _id: 'l1', name: 'ABC Travels', phone: '9876543210' }, assignmentId: 'a1' });
  assert.deepEqual(lead, { _id: 'l1', name: 'ABC Travels', phone: 'XXXX' });
});

test('call activity: "Not called yet" vs count and last outcome', () => {
  assert.deepEqual(describeCallActivity({ count: 0 }), { called: false, label: 'Not called yet' });
  assert.deepEqual(describeCallActivity(undefined), { called: false, label: 'Not called yet' });
  const one = describeCallActivity({ count: 1, lastOutcome: 'discussed_package', lastCallAt: '2026-09-21T06:02:00Z' });
  assert.equal(one.label, '1 call');
  assert.equal(describeCallActivity({ count: 3, lastOutcome: 'ready_to_book' }).label, '3 calls');
  assert.notEqual(one.lastOutcome, 'discussed_package'); // CRM wording, not the raw key
});

test('outcome wording and call timestamps (IST)', () => {
  assert.equal(outcomeLabel(''), '—');
  assert.equal(outcomeLabel('some_new_admin_outcome'), 'some new admin outcome');
  assert.equal(formatCallDateTime(null), '—');
  assert.equal(formatCallDateTime('not a date'), '—');
  assert.match(formatCallDateTime('2026-09-21T06:02:00Z'), /21 Sept? 2026/);
  assert.match(formatCallDateTime('2026-09-21T06:02:00Z'), /11:32/); // 06:02 UTC = 11:32 IST
});

const myLeadsHtml = (rows, extra = '') =>
  renderToHtml(`
    import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    import { ColdCallingMyLeadsView } from './components/cold-calling/ColdCallingViews';
    export default () => renderToStaticMarkup(<MemoryRouter><ColdCallingMyLeadsView rows={${JSON.stringify(rows)}} pagination={{ total: ${rows.length}, totalPages: 1 }} ${extra} /></MemoryRouter>);
  `);

const row = (name, calls, extra = {}) => ({
  assignmentId: `as-${name}`,
  assignedAt: '2026-09-21T05:00:00.000Z',
  lead: { _id: `6ab0f453be0dc76659ef67${name.length}0`, name },
  bucket: 'cold',
  status: 'follow_up',
  statusReason: 'not_interested',
  initial: { bucket: 'cold', statusReason: 'not_interested' },
  originalSalesOwner: { _id: 'u1', name: 'Rahul' },
  currentSalesOwner: { _id: 'u1', name: 'Rahul' },
  calls,
  ...extra,
});

test('My Leads: every row has a Call button (shared component) and a history button that is disabled until a call exists', async () => {
  const html = await myLeadsHtml(
    [row('ABC Travels', { count: 0, lastCallAt: null, lastOutcome: '' }), row('Sky Tours', { count: 3, lastCallAt: '2026-09-22T05:00:00Z', lastOutcome: 'discussed_package' })],
    'onOpenHistory={() => {}}'
  );
  for (const name of ['ABC Travels', 'Sky Tours']) {
    assert.match(html, new RegExp(`aria-label="Call ${name}"`));
    assert.match(html, new RegExp(`aria-label="Call history for ${name}"`));
  }
  const historyButtons = Object.fromEntries(
    [...html.matchAll(/<button[^>]*aria-label="Call history for ([^"]+)"[^>]*>/g)].reduce((acc, m) => [...acc, [m[1], m[0]]], [])
  );
  assert.match(historyButtons['ABC Travels'], /\sdisabled=/);
  assert.doesNotMatch(historyButtons['Sky Tours'], /\sdisabled=/);
  assert.match(html, /Not called yet/);
  assert.match(html, /3 calls/);
  assert.match(html, /Last: /);
});

test('My Leads: a lead the server marks canCall:false (converted / lost) shows "Closed" instead of a Call button, history stays', async () => {
  const html = await myLeadsHtml([row('Done Deal', { count: 2, lastCallAt: '2026-09-22T05:00:00Z', lastOutcome: 'ready_to_book' }, { canCall: false }), row('Live Lead', { count: 0 })], 'onOpenHistory={() => {}}');
  assert.doesNotMatch(html, /aria-label="Call Done Deal"/);
  assert.match(html, /aria-label="Call Live Lead"/);
  assert.match(html, /Closed/);
  assert.match(html, /aria-label="Call history for Done Deal"/);
});

test('My Leads: the page never contains a phone number, a tel: link, or a link into Lead Detail', async () => {
  const html = await myLeadsHtml([row('ABC Travels', { count: 1, lastOutcome: 'cnp_same_day' }, { lead: { _id: '6ab0f453be0dc76659ef6766', name: 'ABC Travels', phone: '9876543210' } })], 'onOpenHistory={() => {}}');
  assert.doesNotMatch(html, /9876543210|tel:|href=|<a /);
  assert.doesNotMatch(html, /XXXX/); // the placeholder is a prop of the button, not page content
});

test('call session: a Cold Calling session carries the routing hint; a Sales session is exactly what it was', async () => {
  const out = await renderToHtml(`
    import { startCallSession, clearCallSession } from './lib/callSession';
    const store = {};
    globalThis.sessionStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
    export default () => {
      const cold = startCallSession({ leadId: 'l1', leadName: 'ABC', phone: '9999999999', coldCalling: true });
      clearCallSession();
      const sales = startCallSession({ leadId: 'l1', leadName: 'ABC', phone: '9999999999' });
      return JSON.stringify({ cold: Object.keys(cold).sort(), sales: Object.keys(sales).sort() });
    };
  `);
  const { cold, sales } = JSON.parse(out);
  assert.deepEqual(sales, ['dialedAt', 'leadId', 'leadName', 'phone', 'startedAt']);
  assert.deepEqual(cold, [...sales, 'coldCalling'].sort());
});

test('a Cold Calling call that the server does not authorize never starts (no session, no dial)', async () => {
  const out = await renderToHtml(`
    import { beginLeadCall, peekCallSession } from './lib/callSession';
    const store = {};
    globalThis.sessionStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: (k) => { delete store[k]; } };
    export default async () => {
      // No API is reachable here, so authorization fails — exactly what a 404 for an unassigned lead looks like to the client.
      const result = await beginLeadCall({ leadId: 'l1', leadName: 'ABC', phone: 'XXXX', coldCalling: true });
      return JSON.stringify({ result, session: peekCallSession() });
    };
  `);
  assert.deepEqual(JSON.parse(out), { result: null, session: null });
});

const lead = (name, extra = {}) => ({ _id: `6ab0f453be0dc76659ef67${name.length}0`, name, destination: 'Manali', travelDate: '2026-10-14T00:00:00.000Z', ...extra });

test('My Leads: Destination and Travel Date columns sit after Customer, in the requested order, showing the lead’s own values', async () => {
  const html = await myLeadsHtml([row('Test lead', { count: 3, lastOutcome: 'cnp_same_day' }, { lead: lead('Test lead'), lifecycle: null, canCall: true })], 'onOpenHistory={() => {}}');
  const headers = [...html.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]).filter(Boolean);
  assert.deepEqual(headers, ['Lead', 'Customer', 'Destination', 'Travel Date', 'Original Sales Executive', 'Current Sales Owner', 'Status', 'Calls', 'Assigned At', 'Action']);
  assert.match(html, />Manali</);
  assert.match(html, /14 Oct 2026/);
  assert.match(html, /aria-label="Call Test lead"/); // active Cold lead keeps its Call button
  assert.match(html, /Cold/);
  assert.doesNotMatch(html, /Closed/);
});

test('My Leads: missing destination and travel date show an em dash — never a made-up value', async () => {
  const html = await myLeadsHtml([row('Bare', { count: 0 }, { lead: lead('Bare', { destination: null, travelDate: null }), lifecycle: null })], 'onOpenHistory={() => {}}');
  assert.doesNotMatch(html, /Manali|Oct 2026|Invalid Date|undefined|null/);
  assert.ok([...html.matchAll(/text-content-muted">—</g)].length >= 4); // destination + travel date, table + card
});

test('My Leads: a Lost lead reads LOST · Not interested (not Cold), keeps its context, and shows Closed instead of Call', async () => {
  const html = await myLeadsHtml([row('Lost One', { count: 2, lastOutcome: 'not_interested' }, { lead: lead('Lost One'), bucket: 'cold', status: 'lost', statusReason: 'not_interested', lifecycle: 'lost', canCall: false })], 'onOpenHistory={() => {}}');
  assert.match(html, /data-lifecycle="lost"/);
  assert.match(html, /aria-label="Status: Lost"/);
  assert.match(html, /Not interested/);
  assert.doesNotMatch(html, /aria-label="Status: Cold"/); // the Cold badge is not what the user sees for a lost lead
  assert.match(html, />Manali</);
  assert.match(html, /14 Oct 2026/);
  assert.match(html, /Closed/);
  assert.doesNotMatch(html, /aria-label="Call Lost One"/);
  assert.match(html, /aria-label="Call history for Lost One"/); // history stays reachable
});

test('My Leads: a Converted lead reads CONVERTED and shows Closed', async () => {
  const html = await myLeadsHtml([row('Won', { count: 1, lastOutcome: 'ready_to_book' }, { lead: lead('Won'), bucket: 'unclassified', status: 'converted', statusReason: 'ready_to_book', lifecycle: 'converted', canCall: false })], 'onOpenHistory={() => {}}');
  assert.match(html, /data-lifecycle="converted"/);
  assert.match(html, /aria-label="Status: Converted"/);
  assert.doesNotMatch(html, /Reason: /); // no reason next to a converted badge
  assert.match(html, /Closed/);
  assert.doesNotMatch(html, /aria-label="Call Won"/);
});

test('My Leads: the phone card shows destination and travel date beside the name', async () => {
  const html = await myLeadsHtml([row('Card Lead', { count: 0 }, { lead: lead('Card Lead'), lifecycle: null })], 'onOpenHistory={() => {}}');
  const card = html.slice(html.indexOf('<ul'));
  assert.match(card, /Manali/);
  assert.match(card, /14 Oct 2026/);
  assert.match(card, /Original:/);
});
