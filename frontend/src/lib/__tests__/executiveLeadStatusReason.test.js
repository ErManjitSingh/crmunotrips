/**
 * Status reason shown beside the bucket in the Executive Lead Status drill-down.
 * Run with: node --test src/lib/__tests__/executiveLeadStatusReason.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { describeLeadStatusReason } from '../executiveLeadStatusReason.js';
import { getStatusReasonLabel } from '../executiveStatusDisplay.js';
import { setLeadStatusOptionsFromApi } from '../leadStatusOptionsStore.js';

const reasonFor = (bucket, statusReason, status = 'follow_up') =>
  describeLeadStatusReason({ bucket, status, statusReason });

test('Cold + reason: the CRM\'s own option label', () => {
  assert.equal(reasonFor('cold', 'not_interested'), 'Not interested');
  assert.equal(reasonFor('cold', 'booked_elsewhere'), 'Booked from another company');
  assert.equal(reasonFor('cold', 'invalid_number'), 'Invalid no');
});

test('Warm + reason, including CNP (official label, not an invented one)', () => {
  assert.equal(reasonFor('warm', 'requested_callback'), 'Request call back');
  assert.equal(reasonFor('warm', 'cnp_same_day'), 'CNP for same day');
  assert.equal(reasonFor('warm', 'price_negotiation'), 'Price negotiation going on');
  assert.equal(reasonFor('warm', 'discussed_package'), 'Package discussed');
});

test('Hot + reason', () => {
  assert.equal(reasonFor('hot', 'ready_to_book'), 'Ready to Book');
});

test('legacy and decorated reasons resolve the same way the Lead Status filter matches them', () => {
  assert.equal(reasonFor('cold', 'budget_issue'), 'Budget issues');
  assert.equal(reasonFor('warm', 'cnp'), 'CNP');
  assert.equal(reasonFor('cold', 'not_connected:language_barrier'), 'Language barrier');
  assert.equal(reasonFor('cold', 'not_interested — customer said no'), 'Not interested');
  assert.equal(reasonFor('warm', 'Requested_Callback: call after 5'), 'Request call back');
});

test('Unclassified never shows its statusReason: "—", or "Converted" for a converted lead', () => {
  assert.equal(reasonFor('unclassified', ''), '—');
  assert.equal(reasonFor('unclassified', 'working_progress'), '—');
  assert.equal(reasonFor('unclassified', 'auto_connected_24h'), '—');
  assert.equal(reasonFor('unclassified', 'not_interested'), '—');
  assert.equal(reasonFor('unclassified', 'ready_to_book', 'converted'), 'Converted');
});

test('a missing / empty / non-string statusReason never crashes and never invents a reason', () => {
  for (const value of [undefined, null, '', '   ', 0, {}, []]) {
    assert.equal(reasonFor('cold', value), '—');
    assert.equal(reasonFor('unclassified', value), '—');
  }
  assert.equal(describeLeadStatusReason(), '—');
  assert.equal(describeLeadStatusReason({}), '—');
  assert.equal(getStatusReasonLabel(undefined), '');
});

test('the reason comes from the backend bucket: a Hot reason under a Cold bucket is shown as-is, never reclassified', () => {
  assert.equal(reasonFor('cold', 'ready_to_book'), 'Ready to Book');
});

test('follows the admin-configured Lead Status options (label change is picked up)', () => {
  setLeadStatusOptionsFromApi({
    warm: [{ key: 'requested_callback', label: 'Callback requested', enabled: true, sortOrder: 0 }],
    hot: [{ key: 'ready_to_book', label: 'Ready to Book', enabled: true, sortOrder: 0 }],
    cold: [{ key: 'site_closed', label: 'Site closed', enabled: true, sortOrder: 0 }],
  });
  assert.equal(reasonFor('warm', 'requested_callback'), 'Callback requested');
  assert.equal(reasonFor('cold', 'site_closed'), 'Site closed');
});
