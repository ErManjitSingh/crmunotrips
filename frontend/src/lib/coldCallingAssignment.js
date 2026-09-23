/**
 * Pure helpers for the Admin "Assign to Cold Calling" flow. No React, no network — the rules that
 * decide what can be selected and what the UI says, so they can be tested directly. The server is
 * still the authority: everything here only avoids sending requests that are certain to fail.
 */

/** A lead can be picked only while it is Cold and not already with a Cold Calling agent. */
export function isAssignableToColdCalling(lead) {
  return Boolean(lead && lead.bucket === 'cold' && !lead.coldCalling);
}

export function assignableLeadIds(leads = []) {
  return leads.filter(isAssignableToColdCalling).map((lead) => lead._id);
}

/** Selection that only ever contains ids that are visible AND still assignable. */
export function pruneSelection(selectedIds, leads = []) {
  const allowed = new Set(assignableLeadIds(leads));
  return selectedIds.filter((id) => allowed.has(id));
}

export function toggleId(selectedIds, id) {
  return selectedIds.includes(id) ? selectedIds.filter((existing) => existing !== id) : [...selectedIds, id];
}

/** "Select all" tri-state for the header checkbox: none / some / all of the selectable rows. */
export function selectAllState(selectedIds, leads = []) {
  const selectable = assignableLeadIds(leads);
  if (!selectable.length) return 'none';
  const picked = selectable.filter((id) => selectedIds.includes(id)).length;
  if (picked === 0) return 'none';
  return picked === selectable.length ? 'all' : 'some';
}

export function toggleAll(selectedIds, leads = []) {
  return selectAllState(selectedIds, leads) === 'all' ? [] : assignableLeadIds(leads);
}

/** Text under a lead's status: who is calling it, or that a Cold lead is still waiting. */
export function coldCallingIndicator(lead) {
  if (lead?.coldCalling) {
    return { kind: 'assigned', label: `Cold Calling: ${lead.coldCalling.coldCallerName || 'Assigned'}` };
  }
  if (lead?.bucket === 'cold') return { kind: 'unassigned', label: 'Unassigned' };
  return null;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Toast text after a successful request. */
export function describeAssignSuccess(result) {
  const name = result?.coldCaller?.name || 'the Cold Calling agent';
  const assigned = Number(result?.assignedCount || 0);
  const already = Number(result?.alreadyAssignedCount || 0);
  if (assigned === 0 && already > 0) return `${plural(already, 'lead')} already assigned to ${name}. Nothing changed.`;
  const base = `${plural(assigned, 'lead')} assigned to ${name} for Cold Calling.`;
  return already > 0 ? `${base} ${already} already assigned.` : base;
}

/**
 * Turns a failed request into what the modal shows: a headline plus per-lead reasons (the server's
 * 409 `failures`). `nameById` maps lead ids to a friendly label.
 */
export function describeAssignError(error, nameById = {}) {
  const data = error?.response?.data;
  const failures = Array.isArray(data?.failures)
    ? data.failures.map((failure) => ({
        leadId: String(failure.leadId),
        label: nameById[String(failure.leadId)] || 'Lead',
        message: failure.message || 'Cannot be assigned',
      }))
    : [];
  const message = data?.message || (error?.response ? 'Assignment failed.' : 'Network problem. Nothing was assigned — please try again.');
  return { message, failures };
}

/** Modal submit rule: an agent is chosen, something is selected, and a request isn't already in flight. */
export function canSubmitAssignment({ coldCallerId, count, pending }) {
  return Boolean(coldCallerId) && count > 0 && !pending;
}
