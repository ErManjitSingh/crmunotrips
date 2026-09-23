import API from '../api/axios';
import { coldCallingCallHistoryPath, coldCallingCallNotesPath } from '../lib/coldCallingCalls';

export async function checkLeadDuplicate({ phone, alternatePhone, email, excludeId }) {
  const { data } = await API.get('/leads/check-duplicate', {
    params: { phone, alternatePhone, email, excludeId },
    skipSuccessToast: true,
    skipErrorToast: true,
  });
  return data;
}

export async function fetchLeadTimeline(leadId, { page = 1, limit = 50 } = {}) {
  const { data } = await API.get(`/leads/${leadId}/timeline`, {
    params: { page, limit },
    skipSuccessToast: true,
  });
  return data;
}

export async function fetchLeadAudit(leadId, params = {}) {
  const { data } = await API.get(`/leads/${leadId}/audit`, {
    params,
    skipSuccessToast: true,
  });
  return data;
}

export async function fetchRecycleBin(params = {}) {
  const { data } = await API.get('/leads/recycle-bin', {
    params,
    skipSuccessToast: true,
  });
  return data;
}

export async function restoreLead(leadId) {
  const { data } = await API.post(`/leads/${leadId}/restore`);
  return data;
}

export async function fetchLeadAgingAnalytics() {
  const { data } = await API.get('/leads/analytics/aging', { skipSuccessToast: true });
  return data;
}

export async function addCallNote(leadId, payload) {
  const { data } = await API.post(`/leads/${leadId}/call-notes`, payload);
  return data;
}

/** Cold Calling: same CallNote write as addCallNote, through the route that requires an active assignment. */
export async function addColdCallingCallNote(leadId, payload) {
  const { data } = await API.post(coldCallingCallNotesPath(leadId), payload, { skipSuccessToast: true });
  return data;
}

/** Cold Calling: the signed-in agent's own calls on one lead. */
export async function fetchColdCallingCallHistory(leadId, params = {}) {
  const { data } = await API.get(coldCallingCallHistoryPath(leadId), { params, skipSuccessToast: true, skipErrorToast: true });
  return data;
}

export async function fetchCallNotes(leadId, params = {}) {
  const { data } = await API.get(`/leads/${leadId}/call-notes`, {
    params,
    skipSuccessToast: true,
  });
  return data;
}

export async function bulkUpdateLeadStatus(leadIds, statusOrPayload, statusReason) {
  const body =
    statusOrPayload && typeof statusOrPayload === 'object'
      ? { leadIds, ...statusOrPayload }
      : {
          leadIds,
          status: statusOrPayload,
          ...(statusReason ? { statusReason } : {}),
        };
  const { data } = await API.post('/leads/bulk-status', body);
  return data;
}

export async function bulkExportLeads(leadIds) {
  const res = await API.post('/leads/bulk-export', { leadIds }, {
    responseType: 'blob',
    skipSuccessToast: true,
  });
  const blob = new Blob([res.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `leads-export-${Date.now()}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
  return res.data;
}

export async function fetchReminderCounts() {
  const { data } = await API.get('/reminders/counts', { skipSuccessToast: true });
  return data;
}

export async function fetchReminders({ tab = 'today', page = 1, limit = 25 } = {}) {
  const { data } = await API.get('/reminders', {
    params: { tab, page, limit },
    skipSuccessToast: true,
  });
  return data;
}

export async function mergeLeads(sourceLeadId, targetLeadId) {
  const { data } = await API.post('/leads/merge', { sourceLeadId, targetLeadId });
  return data;
}

export async function fetchLeadTransferHistory(leadId, params = {}) {
  const { data } = await API.get(`/leads/${leadId}/transfer-history`, {
    params,
    skipSuccessToast: true,
  });
  return data;
}

export async function fetchSourceAnalytics() {
  const { data } = await API.get('/leads/analytics/sources', { skipSuccessToast: true });
  return data;
}

export async function fetchExecutivePerformance() {
  const { data } = await API.get('/leads/analytics/executives', { skipSuccessToast: true });
  return data;
}

/** Admin: per-executive Assigned / Cold / Warm / Hot / Unclassified. Errors are shown inline by the page. */
export async function fetchExecutiveLeadStatus(params = {}) {
  const { data } = await API.get('/leads/analytics/executive-lead-status', {
    params,
    skipSuccessToast: true,
    skipErrorToast: true,
  });
  return data;
}

/** Admin: every lead in one executive's overview row (paginated). */
export async function fetchExecutiveLeadStatusLeads(executiveId, params = {}) {
  const { data } = await API.get(`/leads/analytics/executive-lead-status/${executiveId}/leads`, {
    params,
    skipSuccessToast: true,
    skipErrorToast: true,
  });
  return data;
}

/** Admin: active Cold Calling users for the assignment picker. */
export async function fetchColdCallingAgents(branchId) {
  const { data } = await API.get('/leads/analytics/executive-lead-status/cold-calling/agents', {
    params: branchId ? { branchId } : undefined,
    skipSuccessToast: true,
    skipErrorToast: true,
  });
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * Admin: assign Cold leads to a Cold Calling agent in one request (all-or-nothing). This does NOT
 * change the Sales owner. A 409 carries `failures` per lead; the modal shows them inline.
 */
export async function assignLeadsToColdCalling({ executiveId, leadIds, coldCallerId }) {
  const { data } = await API.post(
    '/leads/analytics/executive-lead-status/cold-calling/assign',
    { executiveId, leadIds, coldCallerId },
    { skipSuccessToast: true, skipErrorToast: true }
  );
  return data;
}

/** Admin: Cold Calling analytics overview / one agent / one agent's leads. Errors are shown inline by the page. */
export async function fetchColdCallingAnalytics(params = {}) {
  const { data } = await API.get('/leads/analytics/cold-calling', { params, skipSuccessToast: true, skipErrorToast: true });
  return data;
}

export async function fetchColdCallingAgentDetail(agentId, params = {}) {
  const { data } = await API.get(`/leads/analytics/cold-calling/${agentId}`, { params, skipSuccessToast: true, skipErrorToast: true });
  return data;
}

export async function fetchColdCallingAgentLeads(agentId, params = {}) {
  const { data } = await API.get(`/leads/analytics/cold-calling/${agentId}/leads`, { params, skipSuccessToast: true, skipErrorToast: true });
  return data;
}

/** Cold Caller: my own assignments (read-only). Scope comes from the session, never from a param. */
export async function fetchMyColdCallingLeads(params = {}) {
  const { data } = await API.get('/cold-calling/my-leads', { params, skipSuccessToast: true, skipErrorToast: true });
  return data;
}

export async function fetchLeadKpis() {
  const { data } = await API.get('/leads/analytics/kpis', { skipSuccessToast: true });
  return data;
}

export async function fetchSlaAnalytics(params = {}) {
  const { data } = await API.get('/leads/analytics/sla', { params, skipSuccessToast: true });
  return data;
}

export async function fetchGlobalAuditLog(params = {}) {
  const { data } = await API.get('/leads/audit-log', { params, skipSuccessToast: true });
  return data;
}
