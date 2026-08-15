import API from '../api/axios';

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

export async function fetchCallNotes(leadId, params = {}) {
  const { data } = await API.get(`/leads/${leadId}/call-notes`, {
    params,
    skipSuccessToast: true,
  });
  return data;
}

export async function bulkUpdateLeadStatus(leadIds, status, statusReason) {
  const { data } = await API.post('/leads/bulk-status', {
    leadIds,
    status,
    ...(statusReason ? { statusReason } : {}),
  });
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
