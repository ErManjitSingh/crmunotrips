import {
  UserPlus,
  UserCheck,
  Phone,
  MessageCircle,
  Mail,
  CalendarPlus,
  FileText,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { getLeadStatusLabel } from '../../lib/leadStatusLabel';

export const PIPELINE_STAGES = [
  { value: 'working', label: 'Working in Progress', shortLabel: 'WIP' },
  { value: 'warm', label: 'Warm', shortLabel: 'Warm' },
  { value: 'hot', label: 'Hot', shortLabel: 'Hot' },
  { value: 'cold', label: 'Cold', shortLabel: 'Cold' },
  { value: 'converted', label: 'Converted', shortLabel: 'Converted' },
];

export const ACTIVITY_CONFIG = {
  lead_created: { label: 'Lead Created', icon: UserPlus, color: 'bg-blue-500/10 text-blue-600' },
  lead_assigned: { label: 'Lead Assigned', icon: UserCheck, color: 'bg-violet-500/10 text-violet-600' },
  lead_accepted: { label: 'Lead Accepted', icon: UserCheck, color: 'bg-emerald-500/10 text-emerald-600' },
  lead_accept_expired: { label: 'Accept Window Expired', icon: RefreshCw, color: 'bg-rose-500/10 text-rose-600' },
  call_made: { label: 'Call Made', icon: Phone, color: 'bg-emerald-500/10 text-emerald-600' },
  whatsapp_sent: { label: 'WhatsApp Sent', icon: MessageCircle, color: 'bg-green-500/10 text-green-600' },
  whatsapp_contact_initiated: { label: 'WhatsApp Contact Initiated', icon: MessageCircle, color: 'bg-green-500/10 text-green-600' },
  email_sent: { label: 'Email Sent', icon: Mail, color: 'bg-sky-500/10 text-sky-600' },
  followup_added: { label: 'Follow Up Added', icon: CalendarPlus, color: 'bg-amber-500/10 text-amber-600' },
  followup_completed: { label: 'Follow Up Completed', icon: CalendarPlus, color: 'bg-emerald-500/10 text-emerald-600' },
  quotation_sent: { label: 'Quotation Sent', icon: FileText, color: 'bg-orange-500/10 text-orange-600' },
  lead_reactivated: { label: 'Lead Reactivated', icon: RefreshCw, color: 'bg-teal-500/10 text-teal-700' },
  lead_reassigned: { label: 'Lead Reassigned', icon: UserCheck, color: 'bg-cyan-500/10 text-cyan-700' },
  lead_transferred: { label: 'Lead Transferred', icon: UserCheck, color: 'bg-indigo-500/10 text-indigo-700' },
  lead_merged: { label: 'Lead Merged', icon: UserPlus, color: 'bg-violet-500/10 text-violet-700' },
  reactivation_progress: { label: 'Reactivation Progress', icon: RefreshCw, color: 'bg-sky-500/10 text-sky-700' },
  status_changed: { label: 'Status Changed', icon: RefreshCw, color: 'bg-indigo-500/10 text-indigo-600' },
  lead_converted: { label: 'Lead Converted', icon: Trophy, color: 'bg-emerald-500/10 text-emerald-700' },
  lead_edited: { label: 'Lead Edited', icon: RefreshCw, color: 'bg-slate-500/10 text-slate-600' },
  lead_deleted: { label: 'Lead Deleted', icon: RefreshCw, color: 'bg-rose-500/10 text-rose-600' },
  lead_restored: { label: 'Lead Restored', icon: RefreshCw, color: 'bg-teal-500/10 text-teal-700' },
  lead_lost: { label: 'Lead Lost', icon: RefreshCw, color: 'bg-rose-500/10 text-rose-600' },
  quotation_created: { label: 'Quotation Created', icon: FileText, color: 'bg-orange-500/10 text-orange-600' },
  quotation_submitted: { label: 'Quotation Submitted', icon: FileText, color: 'bg-violet-500/10 text-violet-600' },
  quotation_approved: { label: 'Quotation Approved', icon: FileText, color: 'bg-emerald-500/10 text-emerald-700' },
  quotation_rejected: { label: 'Quotation Rejected', icon: FileText, color: 'bg-rose-500/10 text-rose-600' },
  followup_missed: { label: 'Follow-up Missed', icon: CalendarPlus, color: 'bg-rose-500/10 text-rose-600' },
  call_note_added: { label: 'Call Note Added', icon: Phone, color: 'bg-emerald-500/10 text-emerald-600' },
  escalation_created: { label: 'Escalation Created', icon: RefreshCw, color: 'bg-orange-500/10 text-orange-700' },
  sla_breached: { label: 'SLA Breached', icon: RefreshCw, color: 'bg-rose-500/10 text-rose-700' },
};

const FOLLOWUP_CATEGORY_LABELS = {
  warm: 'Warm',
  cold: 'Cold',
  converted: 'Converted',
  expected_conv: 'Expected Conv.',
};

export function resolveQuotationAmount(q) {
  if (!q) return 0;
  const direct = Number(q.amount);
  if (direct > 0) return direct;
  const pricingTotal = Number(q.pricing?.total);
  if (pricingTotal > 0) return pricingTotal;
  const costingTotal = Number(q.costing?.grandTotal);
  if (costingTotal > 0) return costingTotal;
  return pricingTotal || costingTotal || 0;
}

function formatQuoteActivityNotes({ quoteNumber, pkgName, amount, status, sent = false }) {
  const price = `₹${Number(amount).toLocaleString('en-IN')}`;
  if (sent) return `${quoteNumber} sent to customer · ${pkgName} · ${price}`;
  return `${quoteNumber} · ${pkgName} · ${price} · ${(status || 'draft').replace(/_/g, ' ')}`;
}

export function findQuotationForActivity(item, quotations = []) {
  const id = item?.meta?.quotationId;
  const num = item?.meta?.quoteNumber;
  return quotations.find(
    (q) => (id && String(q._id) === String(id)) || (num && q.quoteNumber === num)
  );
}

/** Add price and download meta to quotation timeline rows from lead quotations. */
export function enrichQuotationActivities(activities = [], quotations = []) {
  if (!quotations.length) return activities;

  return activities.map((item) => {
    if (!item.type?.startsWith('quotation_')) return item;

    const quote = findQuotationForActivity(item, quotations);
    if (!quote) return item;

    const amount = resolveQuotationAmount(quote);
    const pkgName = quote.packageSnapshot?.name || quote.package?.name || 'Package';
    const quoteNumber = quote.quoteNumber || item.meta?.quoteNumber || 'Quote';
    const sent = item.type === 'quotation_sent';
    const notes = formatQuoteActivityNotes({
      quoteNumber,
      pkgName,
      amount,
      status: quote.status,
      sent,
    });

    return {
      ...item,
      notes,
      meta: {
        ...item.meta,
        quotationId: quote._id,
        quoteNumber,
        amount,
      },
    };
  });
}

export function followUpToActivity(f, fallbackUser = 'User') {
  const category = FOLLOWUP_CATEGORY_LABELS[f.category] || f.category || 'Warm';
  const typeLabel = (f.type || 'call').replace(/_/g, ' ');
  const when = f.scheduledAt
    ? new Date(f.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  const remarks = f.notes || f.outcome || '';
  const noteParts = [category, typeLabel, when && `Scheduled ${when}`, remarks].filter(Boolean);

  return {
    id: `fu-${f._id || f.id}`,
    type: f.status === 'completed' ? 'followup_completed' : 'followup_added',
    user: f.createdBy?.name || f.assignedTo?.name || fallbackUser,
    date: f.createdAt || f.completedAt || f.scheduledAt || new Date().toISOString(),
    notes: noteParts.join(' · '),
  };
}

/** Merge DB timeline with client-built activities (follow-ups, legacy quotes). */
export function mergeLeadActivities(synthetic = [], timeline = []) {
  if (!timeline.length) return synthetic;

  const timelineHasQuotations = timeline.some((a) => a.type?.startsWith('quotation_'));

  const extras = synthetic.filter((a) => {
    if (a.type === 'followup_added' || a.type === 'followup_completed') return true;
    if (a.type?.startsWith('quotation_') && !timelineHasQuotations) return true;
    if (['lead_reactivated', 'lead_reassigned', 'reactivation_progress'].includes(a.type)) {
      return !timeline.some((t) => t.type === a.type);
    }
    return false;
  });

  return [...timeline, ...extras].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function getLeadDetailData(lead) {
  const agent = lead.assignedTo?.name || 'Unassigned';
  const created = lead.createdAt || new Date().toISOString();

  const activities = [
    {
      id: 'a1',
      type: 'lead_created',
      user: lead.createdBy?.name || 'System',
      date: created,
      notes: `Lead created from ${lead.sourceLabel || lead.source || 'unknown source'}`,
    },
  ];
  if (lead.assignedTo) {
    activities.push({
      id: 'a2',
      type: 'lead_assigned',
      user: lead.assignedManager?.name || lead.assignedTeamLeader?.name || 'Manager',
      date: lead.updatedAt || created,
      notes: `Assigned to ${agent}`,
    });
  }

  if (lead.status && lead.status !== 'new') {
    const statusTypeMap = {
      contacted: 'status_changed',
      working_progress: 'status_changed',
      follow_up: 'status_changed',
      quotation_sent: 'quotation_sent',
      negotiation: 'status_changed',
      converted: 'lead_converted',
      lost: 'lead_lost',
      booked_from_another_company: 'lead_lost',
      reactivated: 'lead_reactivated',
    };
    const statusNotes = `Status: ${getLeadStatusLabel(lead.status)}`;
    activities.push({
      id: `status-${lead.status}`,
      type: statusTypeMap[lead.status] || 'status_changed',
      user: lead.assignedTo?.name || agent,
      date: lead.statusReasonUpdatedAt || lead.updatedAt || created,
      notes: lead.statusReason ? `${statusNotes} — ${lead.statusReason}` : statusNotes,
    });
  }

  const followUpItems = lead.followups || lead.followUps || [];
  followUpItems.forEach((f) => {
    activities.push(followUpToActivity(f, agent));
  });

  const quoteItems = lead.quotations || [];
  quoteItems.forEach((q) => {
    const amount = resolveQuotationAmount(q);
    const pkgName = q.packageSnapshot?.name || lead.destination || 'Package';
    const quoteUser = q.createdByExecutive?.name || q.createdBy?.name || agent;
    const quoteNumber = q.quoteNumber || 'Quote';

    activities.push({
      id: `qc-${q._id}`,
      type: 'quotation_created',
      user: quoteUser,
      date: q.createdAt || created,
      notes: formatQuoteActivityNotes({ quoteNumber, pkgName, amount, status: q.status }),
      meta: { quotationId: q._id, quoteNumber, amount },
    });

    if (q.sentAt) {
      activities.push({
        id: `qs-${q._id}`,
        type: 'quotation_sent',
        user: quoteUser,
        date: q.sentAt,
        notes: formatQuoteActivityNotes({ quoteNumber, pkgName, amount, status: q.status, sent: true }),
        meta: { quotationId: q._id, quoteNumber, amount },
      });
    } else if (['sent', 'approved'].includes(q.status)) {
      activities.push({
        id: `qs-${q._id}-sent`,
        type: 'quotation_sent',
        user: quoteUser,
        date: q.updatedAt || q.createdAt || created,
        notes: formatQuoteActivityNotes({ quoteNumber, pkgName, amount, status: q.status, sent: true }),
        meta: { quotationId: q._id, quoteNumber, amount },
      });
    }
  });

  const stageHistory = lead.reactivation?.stageHistory || [];
  stageHistory.forEach((item, idx) => {
    const stage = item.stage || 'reactivated';
    const note = item.note || '';
    activities.push({
      id: `react-${idx}-${item.at || idx}`,
      type:
        stage === 'reactivated'
          ? 'lead_reactivated'
          : stage === 'reassigned'
            ? 'lead_reassigned'
            : 'reactivation_progress',
      user: item.by?.name || item.byName || 'System',
      date: item.at || lead.updatedAt || created,
      notes: `${stage.replace(/_/g, ' ')}${note ? ` · ${note}` : ''}`,
    });
  });

  const notesFromDb = (lead.notesList || []).map((n) => ({
    id: n._id,
    user: n.user?.name || 'User',
    message: n.text,
    date: n.createdAt,
    isOwn: false,
  }));

  const legacyNote = lead.notes?.trim()
    ? [{ id: 'legacy-notes', user: agent, message: lead.notes, date: created, isOwn: false }]
    : [];

  const notes = notesFromDb.length ? notesFromDb : legacyNote;

  const followUps = (lead.followups || lead.followUps || []).map((f, i) => ({
    id: f._id || `f-${i}`,
    date: f.scheduledAt,
    status: f.status,
    category: f.category,
    type: f.type,
    remarks: f.notes || f.outcome || '',
  }));

  const quotations = (lead.quotations || []).map((q, i) => ({
    ...q,
    id: q.quoteNumber || q._id || `q-${i}`,
    title: q.packageSnapshot?.name || q.lead?.destination || `${lead.destination} Package`,
    amount: resolveQuotationAmount(q) || lead.budget || 0,
    status: q.status,
    sentAt: q.sentAt || q.createdAt || null,
  }));

  return {
    activities,
    notes,
    followUps,
    quotations,
  };
}
