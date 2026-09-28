import { getStatusReasonLabel } from './executiveStatusDisplay';

/** "21 Sept 2026, 11:32 am" in IST — the timezone the CRM's reports are defined in. */
export function formatCallDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });
}

/** "11:32 am" in IST. */
export function formatCallTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
}

const istDayKey = (date) => date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** A server day key ("2026-09-27", IST) as "Today" / "Yesterday" / "Sun, 27 Sept 2026". */
export function formatActivityDayLabel(dayKey, now = new Date()) {
  if (!dayKey) return '—';
  if (dayKey === istDayKey(now)) return 'Today';
  if (dayKey === istDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))) return 'Yesterday';
  const date = new Date(`${dayKey}T12:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return dayKey;
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

/** CRM wording for a call outcome (same option labels the post-call form shows). */
export function outcomeLabel(outcome) {
  if (!outcome) return '—';
  return getStatusReasonLabel(outcome) || String(outcome).replace(/_/g, ' ');
}

/** One-line summary of an agent's activity on a lead, from the My Leads `calls` block. */
export function describeCallActivity(calls) {
  const count = Number(calls?.count || 0);
  if (!count) return { called: false, label: 'Not called yet' };
  return { called: true, label: `${count} call${count === 1 ? '' : 's'}`, lastOutcome: outcomeLabel(calls.lastOutcome), lastCallAt: calls.lastCallAt };
}

/** The lead object the shared Call button needs. The real number is never here: the server hands it over at dial time. */
export function callButtonLead(row) {
  return { _id: row.lead._id, name: row.lead.name, phone: 'XXXX' };
}

/** The Cold Calling twins of the call-access / call-end / history endpoints (each requires an active assignment). */
export const coldCallingCallAccessPath = (leadId) => `/cold-calling/leads/${leadId}/call-access`;
export const coldCallingCallNotesPath = (leadId) => `/cold-calling/leads/${leadId}/call-notes`;
export const coldCallingCallHistoryPath = (leadId) => `/cold-calling/leads/${leadId}/call-history`;
export const coldCallingLeadActivityPath = (leadId) => `/cold-calling/leads/${leadId}/activity`;
export const coldCallingReassignOptionsPath = (leadId) => `/cold-calling/leads/${leadId}/reassign-options`;
export const coldCallingReassignPath = (leadId) => `/cold-calling/leads/${leadId}/reassign`;
