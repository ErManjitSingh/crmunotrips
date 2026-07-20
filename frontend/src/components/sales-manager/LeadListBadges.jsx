import { MapPin, User, Users, MessageCircle, Calendar, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getLeadSourceShortLabel } from '../../lib/leadSourceLabels';
import Avatar from '../ui/Avatar';
import { STATUS_STYLES, formatBudget } from './managerUtils';
import RepeatedLeadBadge from '../leads/RepeatedLeadBadge';

const SOURCE_STYLES = {
  website: 'bg-gradient-to-r from-sky-500/20 to-blue-500/15 text-sky-700 dark:text-sky-300 ring-sky-400/40',
  google_ads: 'bg-gradient-to-r from-sky-500/20 to-blue-500/15 text-sky-700 dark:text-sky-300 ring-sky-400/40',
  referral: 'bg-gradient-to-r from-emerald-500/20 to-teal-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-400/40',
  social: 'bg-gradient-to-r from-violet-500/20 to-purple-500/15 text-violet-700 dark:text-violet-300 ring-violet-400/40',
  facebook_ads: 'bg-gradient-to-r from-indigo-500/20 to-blue-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-400/40',
  'fb-lead': 'bg-gradient-to-r from-indigo-500/20 to-blue-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-400/40',
  phone: 'bg-gradient-to-r from-amber-500/20 to-orange-500/15 text-amber-700 dark:text-amber-300 ring-amber-400/40',
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

/** Compact “when lead arrived” under customer name. */
export function formatLeadArrivedAt(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;

  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function leadArrivedFullTitle(date) {
  if (!date) return undefined;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function LeadIdPill({ id }) {
  return (
    <span className="text-sm font-semibold text-blue-600 whitespace-nowrap">
      {id}
    </span>
  );
}

export function SourceBadge({ source, label, sourceShort }) {
  const display = sourceShort || label || getLeadSourceShortLabel(source, label);
  const styleKey = (source || display || '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  const isWa = styleKey.includes('whatsapp') || display === 'WA';
  return (
    <span className={cn(
      'text-sm font-medium whitespace-nowrap',
      isWa ? 'text-green-600' : 'text-content-secondary'
    )}>
      {display}
    </span>
  );
}

export function DestinationChip({ name }) {
  if (!name) return <span className="text-sm text-content-muted">—</span>;
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset bg-gradient-to-r max-w-[130px] truncate', destStyle(name))}>
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
  const isActiveReactivated =
    lead?.reactivation?.isReactivated &&
    ['follow_up', 'working_progress', 'contacted', 'negotiation', 'quotation_sent'].includes(status);
  const label = isActiveReactivated ? 'active' : (status?.replace(/_/g, ' ') || 'new');
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset capitalize whitespace-nowrap',
      STATUS_STYLES[status] || STATUS_STYLES.new
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', status === 'new' && 'animate-pulse', {
        'bg-sky-500': status === 'new',
        'bg-violet-500': status === 'contacted',
        'bg-amber-500': status === 'follow_up',
        'bg-indigo-500': status === 'quotation_sent',
        'bg-orange-500': status === 'negotiation',
        'bg-emerald-500': status === 'converted',
        'bg-rose-500': status === 'lost',
        'bg-teal-500': isActiveReactivated,
      }[isActiveReactivated ? 'active' : status] || 'bg-sky-500')} />
      {label}
    </span>
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

export function CustomerCell({ name, lead, showPhone = false }) {
  const isRepeated = lead?.isRepeatCustomer || lead?.isVip;
  const arrived = formatLeadArrivedAt(lead?.createdAt);
  const arrivedTitle = leadArrivedFullTitle(lead?.createdAt);
  return (
    <div className="flex items-start gap-2.5 min-w-0 max-w-[240px]">
      <Avatar name={name} size="sm" className="!w-8 !h-8 !text-[11px] shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-semibold text-sm text-content-primary truncate">{name}</p>
        {arrived && (
          <p
            className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 leading-tight"
            title={arrivedTitle}
          >
            <Clock className="w-3 h-3 shrink-0 text-slate-400" />
            <span className="truncate">{arrived}</span>
          </p>
        )}
        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
          {isRepeated ? (
            <RepeatedLeadBadge size="sm" />
          ) : (
            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-[#5D5FEF]/10 text-[10px] font-semibold text-[#5D5FEF]">
              New
            </span>
          )}
        </div>
        {showPhone && lead?.phone && (
          <p className="text-xs text-content-muted font-mono mt-0.5 truncate">{lead.phone}</p>
        )}
      </div>
    </div>
  );
}

export function PhoneCell({ phone }) {
  if (!phone) return <span className="text-sm text-content-muted">—</span>;
  const digits = String(phone).replace(/\D/g, '');
  const waUrl = digits ? `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}` : null;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-sm text-content-secondary">{phone}</span>
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
          aria-label="Open WhatsApp"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </a>
      )}
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
