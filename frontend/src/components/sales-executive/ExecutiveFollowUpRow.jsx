import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  MoreHorizontal,
  Phone,
  RefreshCw,
  MapPin,
  CalendarClock,
} from 'lucide-react';
import { Button } from '../ui/button';
import FollowUpCategoryBadge from '../followups/FollowUpCategoryBadge';
import FollowUpPriorityBadge from '../followups/FollowUpPriorityBadge';
import { formatFollowUpDateTime } from '../followups/followupUtils';
import { FOLLOWUP_TYPES } from '../followups/constants';
import { cn } from '../../lib/utils';

function avatarTone(name = '') {
  const tones = [
    'bg-orange-500',
    'bg-violet-500',
    'bg-sky-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-amber-500',
  ];
  return tones[(name.charCodeAt(0) || 0) % tones.length];
}

function typeLabel(type) {
  return FOLLOWUP_TYPES.find((t) => t.value === type)?.label || type || 'Call';
}

function statusChip(f) {
  if (f.status === 'completed') {
    return {
      label: f.type === 'call' ? 'Call Done' : 'Completed',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
    };
  }
  if (f.effectiveStatus === 'missed' || f.status === 'missed') {
    return {
      label: 'Missed',
      className: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: null,
    };
  }
  if (f.status === 'rescheduled') {
    return {
      label: 'Rescheduled',
      className: 'bg-violet-50 text-violet-700 border-violet-200',
      icon: null,
    };
  }
  return {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: null,
  };
}

export default function ExecutiveFollowUpRow({
  followup: f,
  onComplete,
  onReschedule,
  onRemarks,
}) {
  const lead = f.lead || {};
  const leadName = lead.name || 'Customer';
  const initial = leadName.trim().charAt(0).toUpperCase() || '?';
  const chip = statusChip(f);
  const ChipIcon = chip.icon;
  const destination = lead.destination || '—';
  const phone = lead.phone || lead.whatsapp;

  return (
    <div className="group rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-violet-200/70 dark:hover:border-violet-800/50 transition-all">
      <div className="flex flex-col xl:flex-row xl:items-center gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={cn(
              'w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-sm',
              avatarTone(leadName)
            )}
          >
            {initial}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-content-primary truncate">{leadName}</h3>
              <FollowUpCategoryBadge category={f.category || 'warm'} />
              <FollowUpPriorityBadge priority={f.priority || 'medium'} />
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-secondary">
              <span className="inline-flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-violet-500" />
                {destination}
                <span className="text-content-muted">•</span>
                {typeLabel(f.type)}
              </span>
              <span className="inline-flex items-center gap-1 text-content-muted">
                <CalendarClock className="w-3.5 h-3.5" />
                {formatFollowUpDateTime(f.scheduledAt)}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                  chip.className
                )}
              >
                {ChipIcon && <ChipIcon className="w-3 h-3" />}
                {chip.label}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">Lead</p>
                {lead._id ? (
                  <Link
                    to={`/sales-executive/leads/${lead._id}`}
                    className="text-sm font-semibold text-[#5D5FEF] hover:underline truncate block"
                  >
                    {leadName}
                    {lead.leadId && (
                      <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/40 text-[10px] font-bold text-violet-600 border border-violet-100 dark:border-violet-800">
                        {lead.leadId}
                      </span>
                    )}
                  </Link>
                ) : (
                  <p className="text-sm font-medium text-content-primary truncate">{leadName}</p>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">Customer</p>
                <p className="text-sm font-semibold text-content-primary truncate">{leadName}</p>
                {phone ? (
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline mt-0.5"
                  >
                    <Phone className="w-3 h-3" />
                    +91 {String(phone).replace(/\D/g, '').slice(-10)}
                  </a>
                ) : (
                  <p className="text-xs text-content-muted mt-0.5">No phone</p>
                )}
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">Notes</p>
                <p className="text-sm text-content-secondary line-clamp-2">
                  {f.notes?.trim() || f.remarks?.trim() || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 xl:justify-end">
          {f.status !== 'completed' && (
            <Button
              size="sm"
              onClick={onComplete}
              className="rounded-xl h-9 gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white border-0 shadow-sm shadow-emerald-500/25"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Completed
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onReschedule}
            className="rounded-xl h-9 gap-1.5 border-violet-200 text-violet-700 bg-violet-50/50 hover:bg-violet-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reschedule
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRemarks}
            className="rounded-xl h-9 w-9 p-0 text-content-muted hover:text-content-primary"
            title="More"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
