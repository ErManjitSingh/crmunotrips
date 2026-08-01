import {
  CalendarClock,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';

export const FOLLOWUP_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'text-amber-800 bg-gradient-to-r from-amber-400/25 to-orange-400/15 border-amber-400/50 shadow-sm shadow-amber-500/10' },
  { value: 'completed', label: 'Completed', color: 'text-emerald-800 bg-gradient-to-r from-emerald-400/25 to-teal-400/15 border-emerald-400/50 shadow-sm shadow-emerald-500/10' },
  { value: 'missed', label: 'Missed', color: 'text-red-800 bg-gradient-to-r from-red-400/25 to-rose-400/15 border-red-400/50 shadow-sm shadow-red-500/10' },
  { value: 'rescheduled', label: 'Rescheduled', color: 'text-violet-800 bg-gradient-to-r from-violet-400/25 to-purple-400/15 border-violet-400/50 shadow-sm shadow-violet-500/10' },
];

export const FOLLOWUP_PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-slate-700 bg-gradient-to-r from-slate-400/20 to-slate-500/10 border-slate-400/40' },
  { value: 'medium', label: 'Medium', color: 'text-sky-800 bg-gradient-to-r from-sky-400/25 to-cyan-400/15 border-sky-400/50 shadow-sm shadow-sky-500/10' },
  { value: 'high', label: 'High', color: 'text-amber-800 bg-gradient-to-r from-amber-400/25 to-yellow-400/15 border-amber-400/50 shadow-sm shadow-amber-500/10' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-800 bg-gradient-to-r from-red-400/30 to-orange-400/15 border-red-400/50 shadow-sm shadow-red-500/15 animate-pulse' },
];

/** Outcomes shown when category = Call picked */
export const CALL_PICKED_OUTCOMES = [
  { value: 'interested_quotation', label: 'Interested — needs quotation' },
  { value: 'requested_callback', label: 'Requested callback later' },
  { value: 'price_negotiation', label: 'Price negotiation ongoing' },
  { value: 'ready_to_book', label: 'Ready to book' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'converted', label: 'Converted to customer' },
  { value: 'rescheduled', label: 'Rescheduled per customer request' },
];

/** @deprecated Use CALL_PICKED_OUTCOMES */
export const FOLLOWUP_OUTCOMES = CALL_PICKED_OUTCOMES.map((o) => o.label);

export const FOLLOWUP_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Other' },
];

/** Pipeline follow-up categories */
export const FOLLOWUP_CATEGORIES = [
  { value: 'call_picked', label: 'Call picked', color: 'text-emerald-800 bg-gradient-to-r from-emerald-400/25 to-teal-400/15 border-emerald-400/50' },
  { value: 'call_not_picked', label: 'Call not picked', color: 'text-amber-800 bg-gradient-to-r from-amber-400/25 to-orange-400/15 border-amber-400/50' },
  { value: 'dead_lead', label: 'Dead lead', color: 'text-red-800 bg-gradient-to-r from-red-400/25 to-rose-400/15 border-red-400/50' },
  { value: 'cold', label: 'Cold lead', color: 'text-sky-800 bg-gradient-to-r from-sky-400/25 to-cyan-400/15 border-sky-400/50' },
  // legacy values (existing records / filters)
  { value: 'warm', label: 'Warm', color: 'text-orange-800 bg-gradient-to-r from-orange-400/25 to-amber-400/15 border-orange-400/50' },
  { value: 'converted', label: 'Converted', color: 'text-emerald-800 bg-gradient-to-r from-emerald-400/25 to-teal-400/15 border-emerald-400/50' },
  { value: 'expected_conv', label: 'Expected Conversion', color: 'text-violet-800 bg-gradient-to-r from-violet-400/25 to-purple-400/15 border-violet-400/50' },
];

/** Categories shown when creating/editing a follow-up */
export const FOLLOWUP_CATEGORY_OPTIONS = FOLLOWUP_CATEGORIES.filter((c) =>
  ['call_picked', 'call_not_picked', 'dead_lead', 'cold'].includes(c.value)
);

export const CALL_NOT_PICKED_REASONS = [
  { value: 'switched_off', label: 'Switched off' },
  { value: 'not_reachable', label: 'Not reachable' },
  { value: 'not_answering', label: 'Not answering' },
  { value: 'does_not_exist', label: 'Does not exist' },
];

export const KPI_CONFIG = [
  { key: 'today', label: "Today's Follow-ups", icon: CalendarClock, color: 'brand' },
  { key: 'missed', label: 'Missed Follow-ups', icon: AlertTriangle, color: 'red' },
  { key: 'upcoming', label: 'Upcoming Follow-ups', icon: CalendarDays, color: 'violet' },
  { key: 'completed', label: 'Completed Follow-ups', icon: CheckCircle2, color: 'emerald' },
  { key: 'conversion', label: 'Conversion Rate', icon: TrendingUp, color: 'amber', suffix: '%' },
];

export const PRIORITY_COLORS = {
  low: '#64748b',
  medium: '#0ea5e9',
  high: '#f59e0b',
  urgent: '#ef4444',
};

export const STATUS_COLORS = {
  pending: '#f59e0b',
  completed: '#10b981',
  missed: '#ef4444',
  rescheduled: '#8b5cf6',
};
