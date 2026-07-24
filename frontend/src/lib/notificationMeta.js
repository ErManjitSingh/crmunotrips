import {
  Bell,
  UserPlus,
  CalendarClock,
  AlertTriangle,
  FileText,
  FileCheck,
  FileX,
  Luggage,
  IndianRupee,
  AtSign,
} from 'lucide-react';

export const NOTIFICATION_META = {
  lead_created: { icon: UserPlus, color: 'text-sky-600 bg-sky-500/10' },
  lead_assigned: { icon: UserPlus, color: 'text-indigo-600 bg-indigo-500/10' },
  lead_merged: { icon: UserPlus, color: 'text-violet-600 bg-violet-500/10' },
  followup_reminder: { icon: CalendarClock, color: 'text-violet-600 bg-violet-500/10' },
  followup_missed: { icon: AlertTriangle, color: 'text-amber-600 bg-amber-500/10' },
  followup_escalation: { icon: AlertTriangle, color: 'text-orange-600 bg-orange-500/10' },
  followup_outcome: { icon: FileCheck, color: 'text-emerald-600 bg-emerald-500/10' },
  lead_sla_breach: { icon: AlertTriangle, color: 'text-rose-600 bg-rose-500/10' },
  lead_accept_missed: { icon: AlertTriangle, color: 'text-amber-600 bg-amber-500/10' },
  quotation_created: { icon: FileText, color: 'text-blue-600 bg-blue-500/10' },
  quotation_approved: { icon: FileCheck, color: 'text-emerald-600 bg-emerald-500/10' },
  quotation_rejected: { icon: FileX, color: 'text-red-600 bg-red-500/10' },
  booking_confirmed: { icon: Luggage, color: 'text-teal-600 bg-teal-500/10' },
  payment_received: { icon: IndianRupee, color: 'text-green-600 bg-green-500/10' },
  user_mentioned: { icon: AtSign, color: 'text-pink-600 bg-pink-500/10' },
  new_lead: { icon: UserPlus, color: 'text-sky-600 bg-sky-500/10' },
  followup: { icon: CalendarClock, color: 'text-violet-600 bg-violet-500/10' },
  quote_approval: { icon: FileText, color: 'text-blue-600 bg-blue-500/10' },
  quote_approved: { icon: FileCheck, color: 'text-emerald-600 bg-emerald-500/10' },
};

export function getNotificationMeta(type) {
  return NOTIFICATION_META[type] || { icon: Bell, color: 'text-content-muted bg-surface-elevated' };
}
