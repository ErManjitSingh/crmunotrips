import { MapPin, User, Users, MessageCircle, Calendar, Clock, Phone, ClipboardList, Snowflake, Sun, Flame, XCircle, CircleDashed, Trophy } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { getLeadSourceChannel, getLeadSourceShortLabel } from '../../lib/leadSourceLabels';
import Avatar from '../ui/Avatar';
import { formatBudget } from './managerUtils';
import RepeatedLeadBadge from '../leads/RepeatedLeadBadge';
import LeadCallStats from '../leads/LeadCallStats';
import { getLeadListStatusDisplay, listStatusTextClass } from '../../lib/executiveStatusDisplay';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/ToastContext';
import { openCrmWhatsApp } from '../../lib/openCrmWhatsApp';

function WhatsAppSourceIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const SOURCE_STYLES = {
  dpw: 'bg-gradient-to-r from-sky-500/20 to-blue-500/15 text-sky-700 dark:text-sky-300 ring-sky-400/40',
  dpw_wa: 'bg-gradient-to-r from-green-500/20 to-emerald-500/15 text-green-700 dark:text-green-300 ring-green-400/40',
  dpw_call: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/15 text-blue-700 dark:text-blue-300 ring-blue-400/40',
  dpw2: 'bg-gradient-to-r from-indigo-500/20 to-blue-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-400/40',
  dpw2_wa: 'bg-gradient-to-r from-teal-500/20 to-cyan-500/15 text-teal-700 dark:text-teal-300 ring-teal-400/40',
  dpw2_call: 'bg-gradient-to-r from-violet-500/20 to-indigo-500/15 text-violet-700 dark:text-violet-300 ring-violet-400/40',
  website: 'bg-gradient-to-r from-sky-500/20 to-blue-500/15 text-sky-700 dark:text-sky-300 ring-sky-400/40',
  google_ads: 'bg-gradient-to-r from-sky-500/20 to-blue-500/15 text-sky-700 dark:text-sky-300 ring-sky-400/40',
  referral: 'bg-gradient-to-r from-emerald-500/20 to-teal-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-400/40',
  social: 'bg-gradient-to-r from-violet-500/20 to-purple-500/15 text-violet-700 dark:text-violet-300 ring-violet-400/40',
  facebook_ads: 'bg-gradient-to-r from-indigo-500/20 to-blue-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-400/40',
  'fb-lead': 'bg-gradient-to-r from-indigo-500/20 to-blue-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-400/40',
  phone: 'bg-gradient-to-r from-amber-500/20 to-orange-500/15 text-amber-700 dark:text-amber-300 ring-amber-400/40',
  call_lead: 'bg-gradient-to-r from-amber-500/20 to-orange-500/15 text-amber-700 dark:text-amber-300 ring-amber-400/40',
  'walk-in': 'bg-gradient-to-r from-rose-500/20 to-pink-500/15 text-rose-700 dark:text-rose-300 ring-rose-400/40',
  whatsapp: 'bg-gradient-to-r from-green-500/20 to-emerald-500/15 text-green-700 dark:text-green-300 ring-green-400/40',
  wa: 'bg-gradient-to-r from-green-500/20 to-emerald-500/15 text-green-700 dark:text-green-300 ring-green-400/40',
  organic: 'bg-gradient-to-r from-teal-500/20 to-cyan-500/15 text-teal-700 dark:text-teal-300 ring-teal-400/40',
  other: 'bg-gradient-to-r from-slate-500/15 to-slate-500/10 text-slate-700 dark:text-slate-300 ring-slate-400/30',
};

const DEST_COLORS = [
  'from-sky-500/15 to-cyan-500/10 text-sky-700 ring-sky-400/30',
  'from-violet-500/15 to-purple-500/10 text-violet-700 ring-violet-400/30',
  'from-amber-500/15 to-orange-500/10 text-amber-700 ring-amber-400/30',
  'from-emerald-500/15 to-teal-500/10 text-emerald-700 ring-emerald-400/30',
  'from-rose-500/15 to-pink-500/10 text-rose-700 ring-rose-400/30',
];

function destStyle(name = '') {
  const i = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % DEST_COLORS.length;
  return DEST_COLORS[i];
}

/** Full date + time for when the lead arrived. */
export function formatLeadArrivedAt(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function leadArrivedFullTitle(date) {
  return formatLeadArrivedAt(date) || undefined;
}

/** Compact date+time lines under lead name (created / assigned / creator). */
export function LeadTimingLines({ lead, className }) {
  const created = formatLeadArrivedAt(lead?.createdAt);
  const assigned = formatLeadArrivedAt(lead?.assignedAt);
  const creatorRole = lead?.createdBy?.role;
  const creatorName = lead?.createdBy?.name;
  const assigneeName = lead?.assignedTo?.name;
  const creatorId = lead?.createdBy?._id || lead?.createdBy;
  const assigneeId = lead?.assignedTo?._id || lead?.assignedTo;
  const sameOwner =
    Boolean(creatorId) && Boolean(assigneeId) && String(creatorId) === String(assigneeId);
  const selfCreatedByExec =
    Boolean(creatorName) &&
    (creatorRole === 'sales_executive' ||
      (sameOwner && lead?.assigneeRole === 'sales_executive'));

  if (!created && !assigned && !selfCreatedByExec) return null;

  return (
    <div className={cn('mt-0.5 space-y-0.5 text-[11px] leading-tight text-slate-500', className)}>
      {selfCreatedByExec ? (
        <p className="flex items-center gap-1 min-w-0" title={`Created by ${creatorName}`}>
          <User className="w-3 h-3 shrink-0 text-emerald-500" />
          <span className="truncate">
            <span className="font-semibold text-emerald-700">Created by</span>
            {' · '}
            {creatorName}
          </span>
        </p>
      ) : null}
      {created ? (
        <p className="flex items-center gap-1 min-w-0" title={`Created ${created}`}>
          <Clock className="w-3 h-3 shrink-0 text-slate-400" />
          <span className="truncate">
            <span className="font-semibold text-slate-600">Created</span>
            {' · '}
            {created}
          </span>
        </p>
      ) : null}
      {assigned ? (
        <p className="flex items-center gap-1 min-w-0" title={`Assigned ${assigned}`}>
          <User className="w-3 h-3 shrink-0 text-slate-400" />
          <span className="truncate">
            <span className="font-semibold text-slate-600">Assigned</span>
            {' · '}
            {assigned}
          </span>
        </p>
      ) : null}
    </div>
  );
}

export function LeadListStatusIcon({ lead, className }) {
  const display = getLeadListStatusDisplay(lead);
  const listBucket = display.listBucket || display.bucket;
  const label = display.mainLabel || 'No status';
  const subLabel = display.subLabel || '';
  const cfg = {
    cold: { Icon: Snowflake, wrap: 'bg-slate-100 text-slate-600 ring-slate-200' },
    warm: { Icon: Sun, wrap: 'bg-amber-100 text-amber-700 ring-amber-200' },
    hot: { Icon: Flame, wrap: 'bg-rose-100 text-rose-600 ring-rose-200' },
    working: { Icon: Sun, wrap: 'bg-orange-100 text-orange-700 ring-orange-200' },
    lost: { Icon: XCircle, wrap: 'bg-red-100 text-red-600 ring-red-200' },
    new: { Icon: CircleDashed, wrap: 'bg-sky-100 text-sky-600 ring-sky-200' },
    converted: { Icon: Trophy, wrap: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  }[listBucket] || { Icon: CircleDashed, wrap: 'bg-slate-100 text-slate-500 ring-slate-200' };
  const Icon = cfg.Icon;

  return (
    <div className={cn('inline-flex min-w-0 flex-col items-start gap-0.5', className)}>
      <span
        className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 ring-1 ring-inset', cfg.wrap)}
        title={[label, subLabel].filter(Boolean).join(' · ')}
      >
        <Icon
          className={cn('h-3 w-3 shrink-0', display.animateLabel && 'animate-hot-text')}
          strokeWidth={2.4}
        />
        <span className={cn('text-[10px] font-bold leading-none whitespace-nowrap', listStatusTextClass(display))}>
          {label}
        </span>
      </span>
      {subLabel ? (
        <span className="max-w-[140px] truncate text-[9px] font-medium leading-tight text-slate-500" title={subLabel}>
          {subLabel}
        </span>
      ) : null}
    </div>
  );
}

export function LeadIdPill({ id, lead }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <span className="text-sm font-semibold text-blue-600 whitespace-nowrap">
        {id}
      </span>
      {lead ? <LeadListStatusIcon lead={lead} /> : null}
    </div>
  );
}

export function SourceBadge({ source, label, sourceShort }) {
  const display = sourceShort || getLeadSourceShortLabel(source, label) || label || '—';
  const channel = getLeadSourceChannel(source, label || sourceShort);
  const iconClass = 'w-3.5 h-3.5 shrink-0';

  let Icon = null;
  let tone = 'text-content-secondary';
  if (channel === 'whatsapp') {
    Icon = WhatsAppSourceIcon;
    tone = 'text-green-600';
  } else if (channel === 'call') {
    Icon = Phone;
    tone = 'text-sky-600';
  } else if (channel === 'form') {
    Icon = ClipboardList;
    tone = 'text-indigo-600';
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium break-words', tone)}>
      {Icon ? <Icon className={iconClass} /> : null}
      {display}
    </span>
  );
}

export function DestinationChip({ name }) {
  if (!name) return <span className="text-sm text-content-muted">—</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset bg-gradient-to-r max-w-[220px] whitespace-normal break-words', destStyle(name))}>
      <MapPin className="w-3 h-3 shrink-0 opacity-70" />
      {name}
    </span>
  );
}

export function TravelersBadge({ travelers, adults, children }) {
  const count = travelers ?? adults ?? null;
  if (count == null || count === '') {
    return <span className="text-sm text-content-muted">—</span>;
  }
  const childCount = children ?? 0;
  const detail = childCount > 0 ? `${count} (${childCount} child${childCount > 1 ? 'ren' : ''})` : String(count);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-content-secondary whitespace-nowrap">
      <Users className="w-3.5 h-3.5 text-content-muted shrink-0" />
      {detail}
    </span>
  );
}

export function BudgetBadge({ amount }) {
  if (!amount) return <span className="text-sm text-content-muted">—</span>;
  return (
    <span className="text-sm font-semibold text-blue-600 tabular-nums whitespace-nowrap">
      {formatBudget(amount)}
    </span>
  );
}

export function MealPlanBadge({ mealPlan, mealPreference }) {
  const key = String(mealPlan || mealPreference || 'map')
    .trim()
    .toLowerCase();
  const label = ['ep', 'cp', 'map', 'ap'].includes(key) ? key.toUpperCase() : 'MAP';
  return (
    <span className="text-sm font-semibold text-amber-700 whitespace-nowrap">{label}</span>
  );
}

export function ExecutiveBadge({ name, unassigned }) {
  if (unassigned || !name) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-content-muted">
        <span className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5" />
        </span>
        Unassigned
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 max-w-[150px]">
      <Avatar name={name} size="sm" className="!w-7 !h-7 !text-[10px] shrink-0" />
      <span className="text-sm text-content-primary truncate">{name}</span>
    </span>
  );
}

export function ManagerStatusBadge({ status, lead }) {
  const display = getLeadListStatusDisplay(lead || { status });
  const label = display.mainLabel || 'No status';
  const subLabel = display.subLabel || '';
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <span
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium tracking-wide ring-1 ring-inset whitespace-nowrap max-w-[160px] truncate',
          display.listClassName || display.className
        )}
        title={[label, subLabel].filter(Boolean).join(' · ')}
      >
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            display.listDotClass || display.dotClass,
            display.bucket === 'new' && 'animate-pulse'
          )}
        />
        <span className={listStatusTextClass(display)}>{label}</span>
      </span>
      {subLabel ? (
        <span className="max-w-[140px] truncate text-[9px] font-medium leading-tight text-slate-500" title={subLabel}>
          {subLabel}
        </span>
      ) : null}
    </div>
  );
}

export function formatFollowUpDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function NextFollowUpLine({ lead, className }) {
  const raw = lead?.nextFollowUp;
  if (!raw) {
    return (
      <p className={cn('mt-0.5 flex items-center gap-1 min-w-0 text-[11px] leading-tight text-slate-400', className)}>
        <Calendar className="w-3 h-3 shrink-0" />
        <span className="truncate">No next follow-up</span>
      </p>
    );
  }
  const when = formatFollowUpDate(raw);
  const overdue = new Date(raw).getTime() < Date.now();
  return (
    <p
      className={cn(
        'mt-0.5 flex items-center gap-1 min-w-0 text-[11px] leading-tight',
        overdue ? 'text-rose-600' : 'text-slate-500',
        className
      )}
      title={`Next follow-up ${when}`}
    >
      <Calendar className="w-3 h-3 shrink-0" />
      <span className="truncate">
        <span className="font-semibold text-slate-600">Next F/U</span>
        {' · '}
        {when}
      </span>
    </p>
  );
}

export function CustomerCell({ name, lead, showPhone = false }) {
  const isRepeated = lead?.isRepeatCustomer || lead?.isVip;
  const isLost =
    lead?.status === 'lost' || lead?.status === 'booked_from_another_company';
  const isConverted = lead?.status === 'converted';
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Avatar name={name} size="sm" className="!w-8 !h-8 !text-[11px] shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <p
            className={cn(
              'font-semibold text-sm break-words text-content-primary',
              isLost && 'rounded-md bg-red-100 px-2 py-0.5 ring-1 ring-inset ring-red-300',
              isConverted && 'rounded-md bg-emerald-100 px-2 py-0.5 ring-1 ring-inset ring-emerald-300'
            )}
          >
            {name}
          </p>
          {isRepeated ? (
            <RepeatedLeadBadge size="sm" />
          ) : (
            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-[#5D5FEF]/10 text-[10px] font-semibold text-[#5D5FEF]">
              New
            </span>
          )}
        </div>
        <NextFollowUpLine lead={lead} />
        <LeadTimingLines lead={lead} />
        {/* Same call chips as executive / converted lists — under the name */}
        <LeadCallStats lead={lead} compact className="mt-1.5" />
        {showPhone && lead?.phone && (
          <p className="text-xs text-content-muted font-mono mt-0.5 truncate">{lead.phone}</p>
        )}
      </div>
    </div>
  );
}

export function PhoneCell({ phone, leadId, lead }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [opening, setOpening] = useState(false);
  if (!phone) return <span className="text-sm text-content-muted">—</span>;
  const id = leadId || lead?._id;

  const openWa = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!id || opening) return;
    setOpening(true);
    try {
      await openCrmWhatsApp({
        leadId: id,
        phone,
        navigate,
        role: user?.role,
        toast,
      });
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-sm text-content-secondary">{phone}</span>
      {id ? (
        <button
          type="button"
          onClick={openWa}
          disabled={opening}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors disabled:opacity-60"
          aria-label="Open CRM WhatsApp"
          title="Open CRM WhatsApp"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function TravelDateCell({ date }) {
  if (!date) return <span className="text-sm text-content-muted">—</span>;
  const formatted = new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-content-secondary whitespace-nowrap">
      <Calendar className="w-3.5 h-3.5 text-content-muted shrink-0" />
      {formatted}
    </span>
  );
}

export const assignLeadBtnClass =
  'h-6 text-[10px] px-1.5 py-0 leading-none shadow-sm shadow-violet-600/20 whitespace-nowrap rounded-l-md rounded-r-none';

export const moreLeadBtnClass =
  'h-6 px-1.5 py-0 text-[10px] leading-none font-medium text-content-secondary hover:text-violet-600 hover:bg-violet-500/10 rounded-r-md rounded-l-none border border-subtle border-l-0';

export const moreLeadBtnSoloClass =
  'h-6 px-1.5 py-0 text-[10px] leading-none font-medium text-content-secondary hover:text-violet-600 hover:bg-violet-500/10 rounded-md border border-subtle';

export function AssignedExecutiveChip({ name }) {
  if (!name) return null;
  return (
    <span
      title={name}
      className="inline-flex items-center gap-1 h-6 px-1.5 max-w-[92px] rounded-l-md border border-subtle border-r-0 bg-emerald-500/10 text-[10px] font-medium text-emerald-800 truncate"
    >
      <Avatar name={name} size="sm" className="!w-4 !h-4 !text-[8px] shrink-0 ring-1 ring-emerald-500/20" />
      <span className="truncate">{name}</span>
    </span>
  );
}

export const FILTER_THEMES = {
  all: {
    gradient: 'from-brand-500/25 via-violet-500/15 to-indigo-500/20',
    border: 'border-brand-500/25',
    header: 'from-brand-600/10 via-violet-600/8 to-indigo-600/10',
    icon: 'text-brand-600',
  },
  returned: {
    gradient: 'from-amber-500/25 via-orange-500/15 to-rose-500/15',
    border: 'border-amber-500/30',
    header: 'from-amber-500/12 via-orange-500/8 to-rose-500/10',
    icon: 'text-amber-600',
  },
  unassigned: {
    gradient: 'from-amber-500/25 via-orange-500/15 to-yellow-500/20',
    border: 'border-amber-500/30',
    header: 'from-amber-500/12 via-orange-500/8 to-yellow-500/10',
    icon: 'text-amber-600',
  },
  assigned: {
    gradient: 'from-emerald-500/20 via-teal-500/15 to-cyan-500/15',
    border: 'border-emerald-500/25',
    header: 'from-emerald-500/10 via-teal-500/8 to-cyan-500/10',
    icon: 'text-emerald-600',
  },
  'working-progress': {
    gradient: 'from-orange-500/25 via-amber-500/15 to-yellow-500/20',
    border: 'border-orange-500/30',
    header: 'from-orange-500/12 via-amber-500/8 to-yellow-500/10',
    icon: 'text-orange-600',
  },
  hot: {
    gradient: 'from-rose-500/25 via-orange-500/20 to-amber-500/15',
    border: 'border-rose-500/30',
    header: 'from-rose-500/12 via-orange-500/10 to-amber-500/8',
    icon: 'text-rose-600',
  },
  lost: {
    gradient: 'from-slate-500/15 via-zinc-500/10 to-neutral-500/10',
    border: 'border-slate-500/25',
    header: 'from-slate-500/10 to-zinc-500/8',
    icon: 'text-slate-500',
  },
  reactivated: {
    gradient: 'from-teal-500/25 via-cyan-500/15 to-emerald-500/15',
    border: 'border-teal-500/30',
    header: 'from-teal-500/12 via-cyan-500/8 to-emerald-500/10',
    icon: 'text-teal-600',
  },
};
