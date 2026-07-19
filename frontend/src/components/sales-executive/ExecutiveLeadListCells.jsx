import { Link } from 'react-router-dom';
import {
  MapPin,
  Phone,
  Mail,
  Calendar,
  Flame,
  Clock,
  Star,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getLeadSourceShortLabel } from '../../lib/leadSourceLabels';
import Avatar from '../ui/Avatar';
import { STATUS_STYLES, formatBudget } from '../sales-manager/managerUtils';

function formatCreatedAt(date) {
  if (!date) return null;
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatTravelDate(date) {
  if (!date) return null;
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatFollowUp(date) {
  if (!date) return null;
  return new Date(date).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function splitDestination(name = '') {
  const parts = String(name).split(',').map((p) => p.trim()).filter(Boolean);
  return { city: parts[0] || '', region: parts.slice(1).join(', ') };
}

const STATUS_DOT = {
  new: 'bg-sky-500',
  contacted: 'bg-violet-500',
  working_progress: 'bg-indigo-500',
  follow_up: 'bg-amber-500',
  quotation_sent: 'bg-indigo-500',
  negotiation: 'bg-orange-500',
  converted: 'bg-emerald-500',
  lost: 'bg-rose-500',
  booked_from_another_company: 'bg-rose-500',
  reactivated: 'bg-teal-500',
};

export function ExecLeadIdCell({ lead }) {
  const status = lead?.status || 'new';
  const label = status === 'new' ? 'New' : status.replace(/_/g, ' ');
  const created = formatCreatedAt(lead?.createdAt || lead?.assignedAt);

  return (
    <div className="min-w-[128px] space-y-1.5">
      <p className="text-sm font-bold text-[#5D5FEF] tracking-tight whitespace-nowrap">
        {lead?.leadId || '—'}
      </p>
      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold capitalize',
          status === 'new'
            ? 'bg-[#5D5FEF]/12 text-[#5D5FEF]'
            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        )}
      >
        {label}
      </span>
      {created && (
        <p className="text-[11px] text-content-muted leading-snug whitespace-nowrap">{created}</p>
      )}
    </div>
  );
}

export function ExecCustomerCell({ lead }) {
  const name = lead?.name || 'Unknown';
  const source = getLeadSourceShortLabel(lead?.source, lead?.sourceLabel);
  const isReturning = lead?.isRepeatCustomer || lead?.isVip;

  return (
    <Link
      to={`/sales-executive/leads/${lead._id}/view`}
      className="flex items-start gap-3 min-w-[200px] max-w-[260px] rounded-xl -m-1 p-1.5 hover:bg-[#5D5FEF]/[0.04] transition-colors"
    >
      <Avatar name={name} size="sm" className="!w-10 !h-10 !text-xs shrink-0 shadow-sm ring-2 ring-white dark:ring-slate-900" />
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-content-primary truncate leading-tight">{name}</p>
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {source && (
            <span className="text-[11px] font-medium text-content-muted truncate">{source}</span>
          )}
          {!isReturning ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-500/12 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-500/20">
              New Lead
            </span>
          ) : (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-violet-500/12 text-[10px] font-bold text-violet-700 ring-1 ring-inset ring-violet-500/20">
              Returning
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ExecContactCell({ lead }) {
  const phone = lead?.phone;
  const email = lead?.email;
  const tel = phone ? `tel:${String(phone).replace(/\s/g, '')}` : null;

  if (!phone && !email) {
    return <span className="text-sm text-content-muted">—</span>;
  }

  return (
    <div className="min-w-[160px] space-y-1.5">
      {phone && (
        <a
          href={tel}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 text-sm text-content-primary hover:text-[#5D5FEF] transition-colors"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 shrink-0">
            <Phone className="w-3 h-3" />
          </span>
          <span className="font-medium tabular-nums truncate">{phone}</span>
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 text-xs text-content-muted hover:text-[#5D5FEF] transition-colors"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 shrink-0">
            <Mail className="w-3 h-3" />
          </span>
          <span className="truncate max-w-[150px]">{email}</span>
        </a>
      )}
    </div>
  );
}

export function ExecDestinationCell({ name }) {
  if (!name) return <span className="text-sm text-content-muted">—</span>;
  const { city, region } = splitDestination(name);

  return (
    <div className="min-w-[120px] space-y-1">
      <span className="inline-flex items-center gap-1.5 max-w-[150px] px-2.5 py-1 rounded-full text-xs font-semibold bg-[#5D5FEF]/10 text-[#5D5FEF] ring-1 ring-inset ring-[#5D5FEF]/20">
        <MapPin className="w-3 h-3 shrink-0" />
        <span className="truncate">{city || name}</span>
      </span>
      {region && (
        <p className="text-[11px] text-content-muted pl-0.5 truncate max-w-[150px]">{region}</p>
      )}
    </div>
  );
}

export function ExecDateCell({ date, empty = '—' }) {
  const formatted = formatTravelDate(date);
  if (!formatted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-content-muted">
        <Calendar className="w-3.5 h-3.5 opacity-60" />
        {empty}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-content-secondary whitespace-nowrap">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-content-muted shrink-0">
        <Calendar className="w-3 h-3" />
      </span>
      {formatted}
    </span>
  );
}

export function ExecFollowUpCell({ date }) {
  const formatted = formatFollowUp(date);
  if (!formatted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-content-muted">
        <Calendar className="w-3.5 h-3.5 opacity-60" />
        —
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-content-secondary whitespace-nowrap">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
        <Calendar className="w-3 h-3" />
      </span>
      {formatted}
    </span>
  );
}

export function ExecBudgetCell({ amount }) {
  if (amount == null || amount === '') {
    return <span className="text-sm text-content-muted">—</span>;
  }
  const n = Number(amount);
  const display = Number.isFinite(n)
    ? `₹ ${n.toLocaleString('en-IN')}`
    : formatBudget(amount);

  return (
    <span className="text-sm font-bold text-[#5D5FEF] tabular-nums whitespace-nowrap">
      {display}
    </span>
  );
}

export function ExecStatusCell({ lead }) {
  const status = lead?.status || 'new';
  const isActiveReactivated =
    lead?.reactivation?.isReactivated &&
    ['follow_up', 'working_progress', 'contacted', 'negotiation', 'quotation_sent'].includes(status);
  const label = isActiveReactivated ? 'Active' : status.replace(/_/g, ' ');
  const styleKey = isActiveReactivated ? 'active' : status;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize ring-1 ring-inset whitespace-nowrap',
        STATUS_STYLES[styleKey] || STATUS_STYLES.new
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          status === 'new' && 'animate-pulse',
          STATUS_DOT[isActiveReactivated ? 'reactivated' : status] || 'bg-sky-500'
        )}
      />
      {label}
    </span>
  );
}

const PRIORITY_CFG = {
  urgent: {
    label: 'Urgent',
    icon: Clock,
    className: 'bg-rose-500/12 text-rose-700 ring-rose-400/30',
  },
  hot: {
    label: 'Hot',
    icon: Flame,
    className: 'bg-orange-500/12 text-orange-700 ring-orange-400/30',
  },
  high: {
    label: 'High',
    icon: Flame,
    className: 'bg-amber-500/12 text-amber-700 ring-amber-400/30',
  },
  medium: {
    label: 'Medium',
    icon: Star,
    className: 'bg-slate-100 text-slate-600 ring-slate-300/50 dark:bg-slate-800 dark:text-slate-300',
  },
  low: {
    label: 'Low',
    icon: Star,
    className: 'bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-900 dark:text-slate-400',
  },
};

export function ExecPriorityCell({ lead }) {
  let key = null;
  if (lead?.priority === 'urgent' || lead?.isUrgent) key = 'urgent';
  else if (lead?.isHot || lead?.priority === 'hot') key = 'hot';
  else if (lead?.isHighBudget || lead?.priority === 'high') key = 'high';
  else if (lead?.priority === 'medium') key = 'medium';
  else if (lead?.priority === 'low') key = 'low';
  else if (lead?.isHot) key = 'hot';

  if (!key) {
    return <span className="text-sm text-content-muted">—</span>;
  }

  const cfg = PRIORITY_CFG[key];
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ring-inset whitespace-nowrap',
        cfg.className
      )}
    >
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}
