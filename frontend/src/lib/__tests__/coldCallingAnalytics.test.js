/**
 * Phase 5 (Cold Calling analytics for Admin): URL/filter contract, display formatting, and rendering of the
 * server's figures. Run with: node --test src/lib/__tests__/coldCallingAnalytics.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLD_CALLING_VIEW,
  buildAgentKpiCards,
  buildColdCallingAgentPath,
  buildColdCallingOverviewPath,
  buildKpiCards,
  coldCallingFiltersFromSearchParams,
  coldCallingFiltersToSearchParams,
  createDefaultColdCallingFilters,
  describeCategoryReason,
  formatDuration,
  formatKpi,
  formatNumber,
  formatPercent,
  formatTalkTime,
  shouldRetryColdCalling,
  switchAnalyticsView,
  toColdCallingParams,
} from '../coldCallingAnalytics.js';
import { filtersFromSearchParams } from '../executiveLeadStatusFilters.js';
import { renderToHtml } from './renderJsx.mjs';

const filters = { dateFrom: '2026-09-01', dateTo: '2026-09-21', source: 'dpw', agentId: 'agent1', branchId: 'branch1' };

test('filters round-trip through the URL, including the agent and the view marker', () => {
  const params = coldCallingFiltersToSearchParams(filters);
  assert.equal(params.get('view'), COLD_CALLING_VIEW);
  assert.equal(params.get('agentId'), 'agent1');
  assert.deepEqual(coldCallingFiltersFromSearchParams(params), filters);
});

test('"All time" survives a round trip; an empty URL means the same default (Today) as the Sales tab', () => {
  const allTime = coldCallingFiltersToSearchParams({ dateFrom: '', dateTo: '', source: '', agentId: '', branchId: '' });
  assert.equal(allTime.get('period'), 'all');
  assert.equal(coldCallingFiltersFromSearchParams(allTime).dateFrom, '');
  const fresh = coldCallingFiltersFromSearchParams(new URLSearchParams(''));
  const sales = filtersFromSearchParams(new URLSearchParams(''));
  assert.equal(fresh.dateFrom, sales.dateFrom);
  assert.equal(fresh.dateTo, sales.dateTo);
  assert.deepEqual(createDefaultColdCallingFilters().agentId, '');
});

test('API params omit empty filters and never invent one', () => {
  assert.deepEqual(toColdCallingParams(filters), filters);
  assert.deepEqual(toColdCallingParams({ dateFrom: '', dateTo: '', source: '', agentId: '', branchId: '' }), {});
  assert.deepEqual(toColdCallingParams({ dateFrom: '2026-09-01', extra: 'x' }), { dateFrom: '2026-09-01' });
});

test('overview link keeps every filter (Back restores the context); agent link puts the agent in the path only', () => {
  const overview = buildColdCallingOverviewPath(filters);
  assert.match(overview, /^\/leads\/executive-lead-status\?/);
  assert.match(overview, /view=cold-calling/);
  assert.match(overview, /agentId=agent1/);

  const agent = buildColdCallingAgentPath('agentX', filters);
  assert.match(agent, /^\/leads\/executive-lead-status\/cold-calling\/agentX\?/);
  assert.match(agent, /dateFrom=2026-09-01/);
  assert.match(agent, /dateTo=2026-09-21/);
  assert.match(agent, /source=dpw/);
  assert.match(agent, /branchId=branch1/);
  assert.doesNotMatch(agent, /agentId=|view=/); // the agent is the route; the tab marker is not part of the detail URL

  // ...and the round trip through the detail page returns to the same overview context (minus the agent filter).
  const back = new URL(buildColdCallingOverviewPath({ ...coldCallingFiltersFromSearchParams(new URL(agent, 'http://x').searchParams), agentId: '' }), 'http://x');
  assert.equal(back.searchParams.get('dateFrom'), '2026-09-01');
  assert.equal(back.searchParams.get('source'), 'dpw');
});

test('switching tabs keeps period / source / branch and drops the tab-specific executive or agent', () => {
  const toCold = switchAnalyticsView(new URLSearchParams('dateFrom=2026-09-01&dateTo=2026-09-02&source=dpw&executiveId=e1&branchId=b1'), COLD_CALLING_VIEW);
  assert.equal(toCold.get('view'), COLD_CALLING_VIEW);
  assert.equal(toCold.get('source'), 'dpw');
  assert.equal(toCold.get('branchId'), 'b1');
  assert.equal(toCold.get('executiveId'), null);
  const toSales = switchAnalyticsView(new URLSearchParams('view=cold-calling&dateFrom=2026-09-01&dateTo=2026-09-02&agentId=a1'), 'sales');
  assert.equal(toSales.get('view'), null);
  assert.equal(toSales.get('agentId'), null);
  assert.equal(toSales.get('dateFrom'), '2026-09-01');
});

test('a 4xx is not retried; a server error is retried once', () => {
  assert.equal(shouldRetryColdCalling(0, { response: { status: 403 } }), false);
  assert.equal(shouldRetryColdCalling(0, { response: { status: 400 } }), false);
  assert.equal(shouldRetryColdCalling(0, { response: { status: 500 } }), true);
  assert.equal(shouldRetryColdCalling(1, { response: { status: 500 } }), false);
  assert.equal(shouldRetryColdCalling(0, new Error('network')), true);
});

test('formatting: numbers, percentages (server ratios), durations, talk time — null is an em dash, never a fake zero', () => {
  assert.equal(formatNumber(1234567), '12,34,567');
  assert.equal(formatNumber(null), '—');
  assert.equal(formatNumber(0), '0');
  assert.equal(formatPercent(62.5), '62.5%');
  assert.equal(formatPercent(null), '—');
  assert.equal(formatPercent(0), '0%');
  assert.equal(formatDuration(262), '4:22');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(null), '—');
  assert.equal(formatTalkTime(0), '0m');
  assert.equal(formatTalkTime(45), '45s');
  assert.equal(formatTalkTime(540), '9m');
  assert.equal(formatTalkTime(3725), '1h 2m');
});

test('the KPI cards are the eight the spec lists, in order, showing the server values verbatim', () => {
  const summary = { totalColdLeads: 615, assigned: 824, worked: 671, unworked: 153, workRate: 81.4, totalCalls: 3120, connectedCalls: 1980, avgCallDurationSec: 222 };
  const cards = buildKpiCards(summary);
  assert.deepEqual(cards.map((c) => c.label), ['Total Cold Leads', 'Assigned Leads', 'Worked Leads', 'Unworked Leads', 'Work Rate', 'Total Calls', 'Connected Calls', 'Avg Call Duration']);
  assert.deepEqual(cards.map(formatKpi), ['615', '824', '671', '153', '81.4%', '3,120', '1,980', '3:42']);
  // No client-side arithmetic: an inconsistent payload is shown as sent, not "corrected".
  assert.equal(formatKpi(buildKpiCards({ assigned: 10, worked: 3, unworked: 99, workRate: 12.3 })[3]), '99');
  // No denominator: the server sends null and the card says so.
  assert.equal(formatKpi(buildKpiCards({ assigned: 0, workRate: null, avgCallDurationSec: null })[4]), '—');
  assert.equal(formatKpi(buildKpiCards({ avgCallDurationSec: null })[7]), '—');
  assert.deepEqual(buildAgentKpiCards(summary).map((c) => c.key), ['assigned', 'worked', 'unworked', 'workRate', 'totalCalls', 'connectedCalls', 'avgCallDurationSec']);
});

test('reason text next to a status: the lead’s reason, Converted for converted, a dash otherwise', () => {
  assert.equal(describeCategoryReason({ category: 'converted', statusReason: 'ready_to_book' }), 'Converted');
  assert.equal(describeCategoryReason({ category: 'unclassified', statusReason: 'x' }), '—');
  assert.notEqual(describeCategoryReason({ category: 'warm', statusReason: 'discussed_package' }), 'discussed_package');
  assert.equal(describeCategoryReason({ category: 'lost', statusReason: '' }), '—');
});

/* ------------------------------------------------------------------------------- rendering */

const render = (body) =>
  renderToHtml(`
    import { renderToStaticMarkup } from 'react-dom/server';
    import { MemoryRouter } from 'react-router-dom';
    ${body}
  `);

const sampleAgents = [
  { _id: 'a1', name: 'Amit Sharma', active: true, assigned: 280, worked: 190, unworked: 90, workRate: 67.9, calls: 842, connected: 531, avgCallDurationSec: 222, coldToWarm: 72, coldToHot: 31, converted: 21 },
  { _id: 'a2', name: 'Ravi Caller', active: false, assigned: 214, worked: 180, unworked: 34, workRate: 84.1, calls: 615, connected: 382, avgCallDurationSec: null, coldToWarm: 54, coldToHot: 24, converted: 15 },
];
const sampleSummary = { assigned: 494, worked: 370, unworked: 124, workRate: 74.9, totalCalls: 1457, connectedCalls: 913, avgCallDurationSec: 230 };
const sampleMovements = [{ key: 'cold_to_warm', leads: 126 }, { key: 'cold_to_hot', leads: 55 }, { key: 'cold_to_converted', leads: 36 }, { key: 'still_cold', leads: 200 }];

const tableHtml = (props) =>
  render(`
    import AgentPerformanceTable from './components/cold-calling-analytics/AgentPerformanceTable';
    export default () => renderToStaticMarkup(<MemoryRouter><AgentPerformanceTable detailPathFor={(a) => '/leads/executive-lead-status/cold-calling/' + a._id + '?period=all'} ${props} /></MemoryRouter>);
  `);

test('agent table: the ten spec columns, one clickable row per agent linking to the agent page, server values verbatim', async () => {
  const html = await tableHtml(`agents={${JSON.stringify(sampleAgents)}} summary={${JSON.stringify(sampleSummary)}} movements={${JSON.stringify(sampleMovements)}}`);
  for (const header of ['Agent', 'Assigned', 'Worked', 'Unworked', 'Work Rate', 'Calls', 'Connected', 'Avg Duration', 'Cold → Warm', 'Cold → Hot', 'Converted']) {
    assert.ok(html.includes(`>${header}<`) || html.includes(`>${header}`), `missing column ${header}`);
  }
  assert.match(html, /href="\/leads\/executive-lead-status\/cold-calling\/a1\?period=all"/);
  assert.match(html, /href="\/leads\/executive-lead-status\/cold-calling\/a2\?period=all"/);
  assert.match(html, />Amit Sharma</);
  assert.match(html, />67\.9%</);
  assert.match(html, />3:42</); // 222 s
  assert.match(html, />84\.1%</);
  assert.match(html, />—</); // Ravi has no connected calls: an em dash, not 0:00
  assert.match(html, /Inactive/);
  assert.match(html, />All agents</); // footer: the server's overall summary
  assert.match(html, />494</);
});

test('agent table never ranks, scores or labels an agent best/worst', async () => {
  const html = await tableHtml(`agents={${JSON.stringify(sampleAgents)}} summary={${JSON.stringify(sampleSummary)}} movements={[]}`);
  assert.doesNotMatch(html, /rank|score|best|worst|leaderboard|top performer|#1/i);
});

test('agent table states: loading skeleton, and an honest empty state', async () => {
  const loading = await tableHtml('agents={[]} loading');
  assert.match(loading, /animate-pulse/);
  assert.match(loading, /aria-busy="true"/);
  assert.doesNotMatch(loading, /No Cold Calling agents to show/);
  const empty = await tableHtml('agents={[]}');
  assert.match(empty, /No Cold Calling agents to show/);
  assert.doesNotMatch(empty, /<table/);
});

test('agent table has a phone layout (cards) beside the desktop table, with the same links', async () => {
  const html = await tableHtml(`agents={${JSON.stringify(sampleAgents)}}`);
  assert.match(html, /hidden overflow-x-auto lg:block/); // table only from lg
  assert.match(html, /divide-y divide-slate-100 lg:hidden/); // cards below lg
  assert.equal([...html.matchAll(/cold-calling\/a1\?period=all/g)].length, 2); // table row + card
});

test('status distribution: counts and percentages from the server, labelled with their denominator', async () => {
  const html = await render(`
    import StatusDistributionCard from './components/cold-calling-analytics/StatusDistributionCard';
    const distribution = [
      { key: 'cold', count: 515, percentOfAssigned: 61.9 }, { key: 'warm', count: 184, percentOfAssigned: 22.1 },
      { key: 'hot', count: 79, percentOfAssigned: 9.5 }, { key: 'converted', count: 46, percentOfAssigned: 5.5 },
      { key: 'lost', count: 8, percentOfAssigned: 1 }, { key: 'unclassified', count: 0, percentOfAssigned: 0 },
    ];
    export default () => renderToStaticMarkup(<StatusDistributionCard distribution={distribution} assigned={832} />);
  `);
  for (const label of ['Cold', 'Warm', 'Hot', 'Converted', 'Lost / Closed']) assert.ok(html.includes(label), label);
  assert.match(html, />515</);
  assert.match(html, />61\.9%</);
  assert.match(html, /of the 832 assigned leads/); // the denominator is stated
  assert.doesNotMatch(html, /Unclassified/); // hidden while zero
  assert.match(html, /width:61\.9%/);
});

test('status distribution: empty and loading states', async () => {
  const empty = await render(`
    import StatusDistributionCard from './components/cold-calling-analytics/StatusDistributionCard';
    export default () => renderToStaticMarkup(<StatusDistributionCard distribution={[]} assigned={0} />);
  `);
  assert.match(empty, /No leads were assigned to Cold Calling/);
  const loading = await render(`
    import StatusDistributionCard from './components/cold-calling-analytics/StatusDistributionCard';
    export default () => renderToStaticMarkup(<StatusDistributionCard distribution={[]} assigned={5} loading />);
  `);
  assert.match(loading, /animate-pulse/);
});

test('movement visualisation: Cold → Warm, Cold → Hot, Cold → Converted and Still Cold, with counts and a stated base', async () => {
  const html = await render(`
    import StatusMovementCard from './components/cold-calling-analytics/StatusMovementCard';
    const movements = [
      { key: 'cold_to_warm', leads: 3, byAgent: 2, percentOfAssigned: 37.5 }, { key: 'cold_to_hot', leads: 2, byAgent: 2, percentOfAssigned: 25 },
      { key: 'cold_to_converted', leads: 1, byAgent: null, percentOfAssigned: 12.5 }, { key: 'still_cold', leads: 3, byAgent: null, percentOfAssigned: 37.5 },
    ];
    export default () => renderToStaticMarkup(<StatusMovementCard movements={movements} assigned={8} />);
  `);
  for (const label of ['Cold → Warm', 'Cold → Hot', 'Cold → Converted', 'Still Cold']) assert.ok(html.includes(label), label);
  assert.match(html, /Of 8 assigned leads/);
  assert.match(html, /width:37\.5%/);
  assert.match(html, /2 recorded on the agent&#x27;s own calls|2 recorded on the agent's own calls/);
  assert.match(html, /status history/);
});

test('call outcomes come from the data as recorded, largest first, tagged with their bucket', async () => {
  const html = await render(`
    import CallOutcomesCard from './components/cold-calling-analytics/CallOutcomesCard';
    const outcomes = [{ outcome: 'discussed_package', bucket: 'connected', calls: 531 }, { outcome: 'cnp_same_day', bucket: 'no_answer', calls: 182 }, { outcome: 'invalid_number', bucket: 'failed', calls: 5 }];
    export default () => renderToStaticMarkup(<CallOutcomesCard outcomes={outcomes} totalCalls={718} />);
  `);
  assert.match(html, />531</);
  assert.match(html, /Connected/);
  assert.match(html, /No answer/);
  assert.match(html, /Failed \/ other/);
  assert.match(html, /718 calls/);
  assert.ok(html.indexOf('531') < html.indexOf('182')); // order preserved from the server
  const empty = await render(`
    import CallOutcomesCard from './components/cold-calling-analytics/CallOutcomesCard';
    export default () => renderToStaticMarkup(<CallOutcomesCard outcomes={[]} totalCalls={0} />);
  `);
  assert.match(empty, /No calls were made/);
});

test('KPI cards: skeleton while loading, values otherwise', async () => {
  const loaded = await render(`
    import AnalyticsKpiCards from './components/cold-calling-analytics/AnalyticsKpiCards';
    import { buildKpiCards } from './lib/coldCallingAnalytics';
    export default () => renderToStaticMarkup(<AnalyticsKpiCards cards={buildKpiCards({ totalColdLeads: 6, assigned: 8, worked: 5, unworked: 3, workRate: 62.5, totalCalls: 8, connectedCalls: 6, avgCallDurationSec: 88 })} />);
  `);
  assert.deepEqual([...loaded.matchAll(/metric-tabular[^"]*text-2xl[^"]*">([^<]*)</g)].map((m) => m[1]), ['6', '8', '5', '3', '62.5%', '8', '6', '1:28']);
  const loading = await render(`
    import AnalyticsKpiCards from './components/cold-calling-analytics/AnalyticsKpiCards';
    import { buildKpiCards } from './lib/coldCallingAnalytics';
    export default () => renderToStaticMarkup(<AnalyticsKpiCards cards={buildKpiCards({})} loading />);
  `);
  assert.doesNotMatch(loading, /text-2xl/);
  assert.match(loading, /animate-pulse/);
});

const leadRow = (name, extra = {}) => ({
  assignmentId: `as-${name}`, assignmentStatus: 'active', assignedAt: '2026-09-21T05:00:00.000Z',
  lead: { _id: '6ab0f453be0dc76659ef6766', leadId: 'L1', name, source: 'dpw' }, category: 'warm', status: 'contacted', statusReason: 'discussed_package',
  originalSalesOwner: { _id: 'u1', name: 'Rahul' }, currentSalesOwner: { _id: 'u2', name: 'Sippy' },
  calls: { count: 3, connected: 2, lastCallAt: '2026-09-22T05:00:00Z', lastOutcome: 'discussed_package' }, movedToWarm: true, movedToHot: false,
  ...extra,
});

const leadsHtml = (rows, props = '') =>
  render(`
    import AgentLeadsTable from './components/cold-calling-analytics/AgentLeadsTable';
    export default () => renderToStaticMarkup(<MemoryRouter><AgentLeadsTable rows={${JSON.stringify(rows)}} onOpenHistory={() => {}} emptyMessage="none here" ${props} /></MemoryRouter>);
  `);

test('lead table: the nine spec columns, original vs current Sales owner kept apart, a call-history button, no phone number', async () => {
  const html = await leadsHtml([leadRow('ABC Travels')]);
  for (const header of ['Lead', 'Customer', 'Original Sales Executive', 'Current Sales Owner', 'Calls', 'Last Call', 'Current Status', 'Assigned At']) {
    assert.ok(html.includes(`>${header}<`), `missing ${header}`);
  }
  assert.match(html, />Rahul</);
  assert.match(html, />Sippy</);
  assert.match(html, /aria-label="Call history for ABC Travels"/);
  assert.match(html, /href="\/leads\/6ab0f453be0dc76659ef6766"/); // opens the existing Lead Detail
  assert.match(html, /Warm/);
  assert.doesNotMatch(html, /phone|tel:|9\d{9}|XXXX/i);
});

test('lead table: a lead with no calls has no history button; converted / lost leads show their state; empty and loading states', async () => {
  const html = await leadsHtml([leadRow('Quiet', { calls: { count: 0, connected: 0, lastCallAt: null, lastOutcome: '' } }), leadRow('Done', { category: 'converted' }), leadRow('Gone', { category: 'lost', statusReason: 'booked_elsewhere' })]);
  assert.doesNotMatch(html, /aria-label="Call history for Quiet"/);
  assert.match(html, /No calls/);
  assert.match(html, /Converted/);
  assert.match(html, /Lost \/ Closed/);
  assert.match(await leadsHtml([]), /No leads to show/);
  assert.match(await leadsHtml([]), /none here/);
  assert.match(await leadsHtml([], 'loading'), /animate-pulse/);
  assert.match(await leadsHtml([leadRow('X')]), /lg:hidden/); // phone cards exist
});
