import { Phone } from 'lucide-react';
import { formatCallDuration, formatCallDurationExact } from '../../lib/callSession';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { CALL_OUTCOMES } from './PostCallFollowUpModal';

const OUTCOME_LABEL = Object.fromEntries(CALL_OUTCOMES.map((o) => [o.value, o.label]));

const OUTCOME_TONE = {
  interested: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  discussed_package: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  need_better_hotel: 'bg-violet-100 text-violet-700 ring-violet-200',
  budget_issue: 'bg-rose-100 text-rose-700 ring-rose-200',
  call_back_later: 'bg-amber-100 text-amber-700 ring-amber-200',
  call_back_tomorrow: 'bg-amber-100 text-amber-700 ring-amber-200',
  busy: 'bg-amber-100 text-amber-700 ring-amber-200',
  no_answer: 'bg-slate-100 text-slate-600 ring-slate-200',
  not_interested: 'bg-rose-100 text-rose-700 ring-rose-200',
  other: 'bg-sky-100 text-sky-700 ring-sky-200',
};

function outcomeLabel(outcome) {
  if (!outcome) return 'Logged';
  return OUTCOME_LABEL[outcome] || String(outcome).replace(/_/g, ' ');
}

function buildCallItems(lead) {
  const count = Number(lead?.callStats?.count || 0);
  const recent = Array.isArray(lead?.callStats?.recent) ? lead.callStats.recent : [];
  if (!count && !recent.length) return [];

  const byN = new Map(recent.filter((r) => r?.n).map((r) => [Number(r.n), r]));
  const total = Math.max(count, recent.length ? Math.max(...recent.map((r) => Number(r.n) || 0)) : 0);
  const maxShow = Math.min(total, 8);
  const start = Math.max(1, total - maxShow + 1);

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

export default function LeadCallStats({ lead, className, compact = false }) {
  const items = buildCallItems(lead);
  if (!items.length) return null;

  const totalSeconds = Number(lead?.callStats?.totalDurationSeconds || 0);
  const totalCount = Number(lead?.callStats?.count || items.length);

  return (
    <TooltipProvider delayDuration={120}>
      <div
        className={cn('flex flex-wrap items-center gap-1', className)}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((call) => {
          const tone = OUTCOME_TONE[call.outcome] || 'bg-sky-100 text-sky-700 ring-sky-200';
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
                    'inline-flex items-center gap-0.5 rounded-md ring-1 ring-inset font-bold tabular-nums cursor-default',
                    compact ? 'px-1 py-0.5 text-[9px]' : 'px-1.5 py-0.5 text-[10px]',
                    tone
                  )}
                  aria-label={`Call ${call.n}: ${outcomeLabel(call.outcome)}, ${formatCallDurationExact(call.duration)}`}
                >
                  <Phone className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                  <span>{call.n}</span>
                  {call.duration > 0 && (
                    <span className="font-semibold opacity-90">{formatCallDuration(call.duration)}</span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[240px] text-left leading-snug">
                <p className="font-semibold">Call {call.n}</p>
                <p className="text-content-secondary mt-0.5">{outcomeLabel(call.outcome)}</p>
                <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-sky-700">
                  Duration: {formatCallDurationExact(call.duration)}
                </p>
                {when && (
                  <p className="text-content-muted mt-0.5 text-[11px]">{when}</p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {totalCount > items.length && (
          <span
            className={cn(
              'font-bold text-sky-700 tabular-nums',
              compact ? 'text-[9px]' : 'text-[10px]'
            )}
            title={`${totalCount} calls · total ${formatCallDurationExact(totalSeconds)}`}
          >
            +{totalCount - items.length}
          </span>
        )}
      </div>
    </TooltipProvider>
  );
}
