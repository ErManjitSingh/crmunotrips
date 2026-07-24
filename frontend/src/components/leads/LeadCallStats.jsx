import { memo } from 'react';
import { Clock3, Phone, PhoneOff } from 'lucide-react';
import { formatCallDuration, formatCallDurationExact } from '../../lib/callSession';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { CALL_OUTCOMES } from './PostCallFollowUpModal';

const OUTCOME_LABEL = Object.fromEntries(CALL_OUTCOMES.map((o) => [o.value, o.label]));

/** Outcomes treated as customer/exec decline — always solid red */
const DECLINED_OUTCOMES = new Set(['not_interested']);

const OUTCOME_TONE = {
  interested: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  discussed_package: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  need_better_hotel: 'bg-violet-50 text-violet-800 ring-violet-200',
  budget_issue: 'bg-orange-50 text-orange-800 ring-orange-200',
  call_back_later: 'bg-amber-50 text-amber-800 ring-amber-200',
  call_back_tomorrow: 'bg-amber-50 text-amber-800 ring-amber-200',
  busy: 'bg-amber-50 text-amber-800 ring-amber-200',
  no_answer: 'bg-slate-100 text-slate-700 ring-slate-200',
  not_interested: 'bg-red-600 text-white ring-red-700 shadow-sm shadow-red-600/30',
  other: 'bg-sky-50 text-sky-800 ring-sky-200',
};

function outcomeLabel(outcome) {
  if (!outcome) return 'Status not logged';
  return OUTCOME_LABEL[outcome] || String(outcome).replace(/_/g, ' ');
}

function isDeclined(outcome) {
  return DECLINED_OUTCOMES.has(outcome);
}

function buildCallItems(lead, maxShow = 8) {
  const count = Number(lead?.callStats?.count || 0);
  const recent = Array.isArray(lead?.callStats?.recent) ? lead.callStats.recent : [];
  if (!count && !recent.length) return [];

  const byN = new Map(recent.filter((r) => r?.n).map((r) => [Number(r.n), r]));
  const total = Math.max(count, recent.length ? Math.max(...recent.map((r) => Number(r.n) || 0)) : 0);
  const show = Math.min(total, maxShow);
  const start = Math.max(1, total - show + 1);

  const items = [];
  for (let n = start; n <= total; n += 1) {
    const hit = byN.get(n);
    items.push({
      n,
      outcome: hit?.outcome || '',
      duration: Number(hit?.duration || 0),
      at: hit?.at || lead?.callStats?.lastCallAt,
    });
  }
  return items;
}

function LeadCallStats({ lead, className, compact = false }) {
  const maxShow = compact ? 4 : 8;
  const items = buildCallItems(lead, maxShow);
  if (!items.length) return null;

  const totalSeconds = Number(lead?.callStats?.totalDurationSeconds || 0);
  const totalCount = Number(lead?.callStats?.count || items.length);

  return (
    <TooltipProvider delayDuration={120}>
      <div
        className={cn('flex flex-col gap-1 min-w-0', className)}
        onClick={(e) => e.stopPropagation()}
      >
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((call) => {
          const declined = isDeclined(call.outcome);
          const tone = OUTCOME_TONE[call.outcome] || 'bg-sky-50 text-sky-800 ring-sky-200';
          const Icon = declined ? PhoneOff : Phone;
          const when = call.at
            ? new Date(call.at).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
            : '';

          return (
            <Tooltip key={call.n}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg ring-1 ring-inset cursor-default',
                    compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
                    tone
                  )}
                  aria-label={`Call number ${call.n}, duration ${formatCallDurationExact(call.duration)}, ${outcomeLabel(call.outcome)}`}
                >
                  <Icon className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5', 'shrink-0')} />
                  <span className="font-bold whitespace-nowrap">Call {call.n}</span>
                  <span
                    className={cn('h-3 w-px shrink-0', declined ? 'bg-white/40' : 'bg-current opacity-25')}
                    aria-hidden
                  />
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 font-semibold tabular-nums whitespace-nowrap',
                      declined ? 'text-white' : 'text-slate-700'
                    )}
                    title="Call duration"
                  >
                    <Clock3 className={cn(compact ? 'h-2.5 w-2.5' : 'h-3 w-3', 'opacity-80')} />
                    <span>{formatCallDuration(call.duration)}</span>
                  </span>
                  {declined && (
                    <span className="rounded bg-white/20 px-1 py-px text-[9px] font-extrabold uppercase tracking-wide">
                      Declined
                    </span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-left leading-snug">
                <p className="font-semibold">Call number: {call.n}</p>
                <p className={cn('mt-0.5 font-medium', declined ? 'text-red-600' : 'text-content-secondary')}>
                  Status: {outcomeLabel(call.outcome)}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-sky-700">
                  Duration: {formatCallDurationExact(call.duration)}
                </p>
                {when && <p className="text-content-muted mt-0.5 text-[11px]">{when}</p>}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {totalCount > items.length && (
          <span
            className={cn('font-bold text-slate-500 tabular-nums', compact ? 'text-[10px]' : 'text-[11px]')}
            title={`${totalCount} total calls`}
          >
            +{totalCount - items.length} more
          </span>
        )}
      </div>
      <p className={cn('font-medium text-slate-500 tabular-nums', compact ? 'text-[9px]' : 'text-[10px]')}>
        {totalCount} call{totalCount === 1 ? '' : 's'} · total duration {formatCallDurationExact(totalSeconds)}
      </p>
      </div>
    </TooltipProvider>
  );
}

export default memo(LeadCallStats);
