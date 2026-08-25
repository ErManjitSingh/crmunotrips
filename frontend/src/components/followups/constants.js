import {
  CalendarClock,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { getOutcomesForCategoryDynamic } from '../../lib/leadStatusOptionsStore';

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

/** Warm lead outcomes */
export const WARM_OUTCOMES = [
  { value: 'discussed_package', label: 'Package discussed' },
  { value: 'requested_callback', label: 'Request call back' },
  { value: 'cnp_same_day', label: 'CNP for same day' },
  { value: 'price_negotiation', label: 'Price negotiation going on' },
];

/** Hot lead outcomes */
export const HOT_OUTCOMES = [
  { value: 'ready_to_book', label: 'Ready to Book' },
];

/** Cold lead outcomes */
export const COLD_OUTCOMES = [
  { value: 'booked_elsewhere', label: 'Booked from another company' },
  { value: 'language_barrier', label: 'Language barrier' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'invalid_number', label: 'Invalid no' },
  { value: 'budget_issues', label: 'Budget issues' },
];

/** Converted lead outcomes */
export const CONVERTED_OUTCOMES = [
  { value: 'converted', label: 'Converted' },
];

/** @deprecated Use WARM_OUTCOMES — kept for older imports */
export const CALL_PICKED_OUTCOMES = WARM_OUTCOMES;

/** @deprecated Use WARM_OUTCOMES */
export const FOLLOWUP_OUTCOMES = WARM_OUTCOMES.map((o) => o.label);

/** @deprecated Not connected is no longer a category — CNP is under Warm */
export const CALL_NOT_PICKED_REASONS = [
  { value: 'cnp_same_day', label: 'CNP for same day' },
];

/** @deprecated Use COLD_OUTCOMES */
export const FOLLOWUP_COLD_REASONS = COLD_OUTCOMES;

export const FOLLOWUP_TYPES = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Other' },
];

/** Pipeline follow-up categories — UI shows Warm / Hot / Cold / Converted */
export const FOLLOWUP_CATEGORIES = [
  { value: 'warm', label: 'Warm', color: 'text-amber-800 bg-gradient-to-r from-amber-400/25 to-orange-400/15 border-amber-400/50' },
  { value: 'hot', label: 'Hot', color: 'text-rose-800 bg-gradient-to-r from-rose-400/25 to-orange-400/15 border-rose-400/50' },
  { value: 'cold', label: 'Cold', color: 'text-sky-800 bg-gradient-to-r from-sky-400/25 to-cyan-400/15 border-sky-400/50' },
  { value: 'converted', label: 'Converted', color: 'text-emerald-800 bg-gradient-to-r from-emerald-400/25 to-teal-400/15 border-emerald-400/50' },
  // legacy (older records / filters)
  { value: 'call_picked', label: 'Connected lead', color: 'text-emerald-800 bg-gradient-to-r from-emerald-400/25 to-teal-400/15 border-emerald-400/50' },
  { value: 'call_not_picked', label: 'Not connected', color: 'text-amber-800 bg-gradient-to-r from-amber-400/25 to-orange-400/15 border-amber-400/50' },
  { value: 'lost', label: 'Lost lead', color: 'text-red-800 bg-gradient-to-r from-red-400/25 to-rose-400/15 border-red-400/50' },
  { value: 'dead_lead', label: 'Dead lead', color: 'text-red-800 bg-gradient-to-r from-red-400/25 to-rose-400/15 border-red-400/50' },
  { value: 'expected_conv', label: 'Expected Conversion', color: 'text-violet-800 bg-gradient-to-r from-violet-400/25 to-purple-400/15 border-violet-400/50' },
];

/** Categories shown when creating/editing a follow-up or changing lead status */
export const FOLLOWUP_CATEGORY_OPTIONS = FOLLOWUP_CATEGORIES.filter((c) =>
  ['warm', 'hot', 'cold', 'converted'].includes(c.value)
);

export function getOutcomesForCategory(category) {
  return getOutcomesForCategoryDynamic(category);
}

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
