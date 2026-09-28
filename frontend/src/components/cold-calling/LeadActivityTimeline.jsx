import { AlertTriangle, Eye, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOff } from 'lucide-react';
import { formatCallDuration } from '../../lib/callSession';
import { formatCallDateTime, formatCallTime, formatActivityDayLabel, outcomeLabel } from '../../lib/coldCallingCalls';
import { cn } from '../../lib/utils';

const BUCKET_STYLE = {
  connected: { icon: PhoneIncoming, dot: 'bg-emerald-500 text-white', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'Connected' },
  no_answer: { icon: PhoneMissed, dot: 'bg-amber-500 text-white', pill: 'bg-amber-50 text-amber-700 ring-amber-200', label: 'No answer' },
  failed: { icon: PhoneOff, dot: 'bg-rose-500 text-white', pill: 'bg-rose-50 text-rose-700 ring-rose-200', label: 'Failed' },
};

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-subtle bg-slate-50/70 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted">{label}</p>
      <p className="metric-tabular mt-0.5 text-lg font-bold text-content-primary">{value}</p>
    </div>
  );
}

function OpenedEvent({ event }) {
  return (
    <li className="relative flex gap-3 py-2">
      <span className="metric-tabular w-16 shrink-0 pt-1 text-right text-xs font-semibold text-content-muted">{formatCallTime(event.at)}</span>
      <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <p className="pt-1 text-sm text-content-muted">Opened the lead to call</p>
    </li>
  );
}

function CallEvent({ event }) {
  const style = BUCKET_STYLE[event.bucket] || BUCKET_STYLE.failed;
  const Icon = style.icon;
  return (
    <li className="relative flex gap-3 py-2">
      <span className="metric-tabular w-16 shrink-0 pt-1 text-right text-xs font-semibold text-content-primary">{formatCallTime(event.at)}</span>
      <span className={cn('relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', style.dot)}>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold text-content-primary">Call</span>
          <span className="metric-tabular font-semibold text-slate-700">{formatCallDuration(event.duration)}</span>
          <span className={cn('rounded-full px-2 py-px text-[11px] font-semibold ring-1 ring-inset', style.pill)}>{outcomeLabel(event.outcome)}</span>
        </p>
        {event.endedAt && (
          <p className="mt-0.5 text-xs text-content-muted">
            {formatCallTime(event.at)} → {formatCallTime(event.endedAt)}
          </p>
        )}
        {event.notes && <p className="mt-1 whitespace-pre-line break-words text-xs text-slate-600">{event.notes}</p>}
      </div>
    </li>
  );
}

/**
 * Day-by-day history of ONE agent on ONE lead: when they opened it and every call (time, duration, outcome,
 * notes), with per-day and overall totals. Data comes pre-grouped from the server (IST calendar days).
 */
export default function LeadActivityTimeline({ data, isPending, isError, onRetry, emptyHint }) {
  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center">
        <AlertTriangle className="h-6 w-6 text-rose-500" aria-hidden="true" />
        <p className="text-sm font-semibold text-rose-800">Couldn&apos;t load the history</p>
        {onRetry && <button type="button" onClick={onRetry} className="text-xs font-semibold text-rose-700 underline">Try again</button>}
      </div>
    );
  }
  if (isPending) {
    return (
      <ul className="space-y-2" aria-busy="true">
        {[...Array(3)].map((_, i) => <li key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
      </ul>
    );
  }

  const totals = data?.totals || {};
  const days = data?.days || [];
  if (!days.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-subtle px-4 py-10 text-center">
        <PhoneCall className="h-6 w-6 text-content-muted" aria-hidden="true" />
        <p className="text-sm font-semibold text-content-primary">No activity yet</p>
        <p className="text-xs text-content-muted">{emptyHint || 'Opens and calls on this lead will be listed here, day by day.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Total calls" value={totals.calls ?? 0} />
        <Stat label="Connected" value={totals.connected ?? 0} />
        <Stat label="Talk time" value={formatCallDuration(totals.talkTimeSec)} />
        <Stat label="Days active" value={totals.activeDays ?? 0} />
      </div>
      <p className="text-xs text-content-muted">
        {totals.firstOpenedAt && <>First opened <span className="font-semibold text-slate-700">{formatCallDateTime(totals.firstOpenedAt)}</span> · </>}
        Opened {plural(totals.opens ?? 0, 'time')}
        {totals.lastCallAt && <> · Last call <span className="font-semibold text-slate-700">{formatCallDateTime(totals.lastCallAt)}</span></>}
      </p>

      <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-1">
        {days.map((day) => (
          <section key={day.date} className="rounded-xl border border-subtle">
            <header className="flex flex-wrap items-center justify-between gap-2 rounded-t-xl border-b border-subtle bg-slate-50/80 px-3 py-2">
              <h4 className="text-sm font-bold text-content-primary">{formatActivityDayLabel(day.date)}</h4>
              <p className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-sky-700">{plural(day.calls, 'call')}</span>
                {day.calls > 0 && <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-emerald-700">{day.connected} connected</span>}
                {day.calls > 0 && <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-slate-700">{formatCallDuration(day.talkTimeSec)} talk</span>}
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-slate-600">opened {plural(day.opens, 'time')}</span>
              </p>
            </header>
            <ol className="relative px-3 py-1 before:absolute before:bottom-4 before:left-[101px] before:top-4 before:w-px before:bg-slate-200">
              {day.events.map((event) => (event.type === 'opened' ? <OpenedEvent key={event.id} event={event} /> : <CallEvent key={event.id} event={event} />))}
            </ol>
          </section>
        ))}
        {data?.truncated && <p className="text-center text-[11px] text-content-muted">Showing the most recent activity only.</p>}
      </div>
    </div>
  );
}
