/**
 * Query-param contract for the Executive Lead Status report.
 * Run with: node --test src/lib/__tests__/executiveLeadStatusFilters.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPeriodPreset } from '../periodFilters.js';
import {
  createDefaultExecutiveLeadStatusFilters,
  toExecutiveLeadStatusParams,
  isDateRangeInvalid,
  shouldRetryExecutiveLeadStatus,
  filtersToSearchParams,
  filtersFromSearchParams,
  buildOverviewPath,
  buildExecutiveDetailPath,
  toExecutiveLeadsParams,
  isSummaryConsistent,
  formatAssignedDate,
  formatCount,
  describeAssignmentPeriod,
} from '../executiveLeadStatusFilters.js';

test('defaults to Today with no source / executive / branch', () => {
  const today = applyPeriodPreset('today');
  assert.deepEqual(createDefaultExecutiveLeadStatusFilters(), {
    dateFrom: today.dateFrom,
    dateTo: today.dateTo,
    source: '',
    executiveId: '',
    branchId: '',
  });
});

test('default filters produce only the period params', () => {
  const params = toExecutiveLeadStatusParams(createDefaultExecutiveLeadStatusFilters());
  assert.deepEqual(Object.keys(params).sort(), ['dateFrom', 'dateTo']);
});

test('every selected filter maps 1:1 to the API param the backend reads', () => {
  const params = toExecutiveLeadStatusParams({
    dateFrom: '2026-03-01',
    dateTo: '2026-03-10',
    source: 'dpw',
    executiveId: 'a'.repeat(24),
    branchId: 'b'.repeat(24),
  });
  assert.deepEqual(params, {
    dateFrom: '2026-03-01',
    dateTo: '2026-03-10',
    source: 'dpw',
    executiveId: 'a'.repeat(24),
    branchId: 'b'.repeat(24),
  });
});

test('All Time sends no date params; unknown filter keys are never forwarded', () => {
  const params = toExecutiveLeadStatusParams({ ...applyPeriodPreset('all'), destination: 'Goa', budgetMin: '5000' });
  assert.deepEqual(params, {});
});

test('the Destination and Package Cost filters are not part of this report', () => {
  const filters = createDefaultExecutiveLeadStatusFilters();
  for (const key of ['destination', 'budgetMin', 'budgetMax', 'budgetRange']) {
    assert.equal(key in filters, false);
  }
});

test('detects an inverted date range and accepts open-ended / equal ranges', () => {
  assert.equal(isDateRangeInvalid({ dateFrom: '2026-03-11', dateTo: '2026-03-10' }), true);
  assert.equal(isDateRangeInvalid({ dateFrom: '2026-03-10', dateTo: '2026-03-10' }), false);
  assert.equal(isDateRangeInvalid({ dateFrom: '2026-03-10', dateTo: '' }), false);
  assert.equal(isDateRangeInvalid({}), false);
});

test('retries a network error or 5xx once, never a 4xx', () => {
  const http = (status) => ({ response: { status } });
  assert.equal(shouldRetryExecutiveLeadStatus(0, new Error('Network Error')), true);
  assert.equal(shouldRetryExecutiveLeadStatus(0, http(500)), true);
  assert.equal(shouldRetryExecutiveLeadStatus(0, http(503)), true);
  assert.equal(shouldRetryExecutiveLeadStatus(1, http(500)), false);
  for (const status of [400, 401, 403, 404, 429]) {
    assert.equal(shouldRetryExecutiveLeadStatus(0, http(status)), false, `status ${status}`);
  }
});

test('formats counts for the en-IN locale and treats missing values as 0', () => {
  assert.equal(formatCount(1234567), '12,34,567');
  assert.equal(formatCount(undefined), '0');
  assert.equal(formatCount(0), '0');
});

test('describes the assignment period', () => {
  assert.equal(describeAssignmentPeriod({}), 'All time');
  assert.equal(describeAssignmentPeriod({ dateFrom: '2026-03-10', dateTo: '2026-03-10' }), '10 Mar 2026');
  assert.equal(describeAssignmentPeriod({ dateFrom: '2026-03-01', dateTo: '2026-03-10' }), '1 Mar 2026 – 10 Mar 2026');
  assert.equal(describeAssignmentPeriod({ dateFrom: '2026-03-01' }), 'From 1 Mar 2026');
  assert.equal(describeAssignmentPeriod({ dateTo: '2026-03-10' }), 'Until 10 Mar 2026');
});

const HEX = 'a'.repeat(24);

test('filters survive a round trip through the URL (period, source, executive, branch)', () => {
  const filters = { dateFrom: '2026-03-01', dateTo: '2026-03-10', source: 'dpw', executiveId: HEX, branchId: 'b'.repeat(24) };
  assert.deepEqual(filtersFromSearchParams(filtersToSearchParams(filters)), filters);
});

test('All Time round-trips as All Time (not silently reset to Today); a bare URL means Today', () => {
  const allTime = { dateFrom: '', dateTo: '', source: '', executiveId: '', branchId: '' };
  assert.deepEqual(filtersFromSearchParams(filtersToSearchParams(allTime)), allTime);
  assert.deepEqual(filtersFromSearchParams(new URLSearchParams()), createDefaultExecutiveLeadStatusFilters());
});

test('drill-down path keeps period/source/branch, moves the executive into the path, and never adds Destination/Package Cost', () => {
  const filters = { dateFrom: '2026-03-10', dateTo: '2026-03-10', source: 'dpw', executiveId: 'ignored', branchId: 'c'.repeat(24) };
  const path = buildExecutiveDetailPath(HEX, filters, 'cold');
  const url = new URL(path, 'http://x');
  assert.equal(url.pathname, `/leads/executive-lead-status/${HEX}`);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    dateFrom: '2026-03-10', dateTo: '2026-03-10', source: 'dpw', branchId: 'c'.repeat(24), bucket: 'cold',
  });
  assert.equal(buildOverviewPath(filters).startsWith('/leads/executive-lead-status?'), true);
});

test('drill-down API params keep the report period/source/branch and add bucket + paging only', () => {
  const filters = { dateFrom: '2026-03-10', dateTo: '2026-03-11', source: 'referral', executiveId: HEX, branchId: '' };
  assert.deepEqual(toExecutiveLeadsParams(filters, { page: 2, limit: 25 }), {
    dateFrom: '2026-03-10', dateTo: '2026-03-11', source: 'referral', page: 2, limit: 25,
  });
  assert.equal(toExecutiveLeadsParams(filters, { bucket: 'hot' }).bucket, 'hot');
});

test('detects overview/detail count drift', () => {
  assert.equal(isSummaryConsistent({ assigned: 7, cold: 4, warm: 0, hot: 0, unclassified: 3 }), true);
  assert.equal(isSummaryConsistent({ assigned: 7, cold: 4, warm: 0, hot: 0, unclassified: 2 }), false);
  assert.equal(isSummaryConsistent(undefined), true);
});

test('formats the assigned date in IST (a late-evening UTC instant is already the next IST day)', () => {
  assert.equal(formatAssignedDate('2026-03-10T18:29:59.999Z'), '10 Mar 2026');
  assert.equal(formatAssignedDate('2026-03-10T18:30:00.000Z'), '11 Mar 2026');
  assert.equal(formatAssignedDate(null), '—');
  assert.equal(formatAssignedDate('nonsense'), '—');
});
