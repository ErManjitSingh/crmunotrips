import { Link } from 'react-router-dom';
import { ArrowRight, Trophy, Users, FileText, CalendarCheck2 } from 'lucide-react';
import Avatar from '../ui/Avatar';
import DashboardPanel from './DashboardPanel';
import { cn } from '../../lib/utils';

const STATUS_META = {
  Excellent: {
    label: 'Excellent',
    bar: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  Good: {
    label: 'Good',
    bar: 'bg-sky-500',
    chip: 'bg-sky-50 text-sky-700 ring-sky-200/80',
    dot: 'bg-sky-500',
  },
  'Needs Attention': {
    label: 'Needs focus',
    bar: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-800 ring-amber-200/80',
    dot: 'bg-amber-500',
  },
  Low: {
    label: 'Low',
    bar: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 ring-rose-200/80',
    dot: 'bg-rose-500',
  },
  Inactive: {
    label: 'Inactive',
    bar: 'bg-slate-300',
    chip: 'bg-slate-100 text-slate-500 ring-slate-200/80',
    dot: 'bg-slate-400',
  },
};

const RANK_STYLE = [
  'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-amber-500/30',
  'bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-slate-400/30',
  'bg-gradient-to-br from-orange-300 to-orange-600 text-white shadow-orange-400/30',
];

function Metric({ icon: Icon, label, value, tone }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50/90 px-2 py-1.5 ring-1 ring-inset ring-slate-100">
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon className="h-3 w-3 shrink-0" strokeWidth={2.2} />
        <span className="truncate">{label}</span>
      </div>
      <p className={cn('mt-0.5 text-[13px] font-bold tabular-nums leading-none', tone)}>
        {value}
      </p>
    </div>
  );
}

export default function SalesTeamPerformanceTable({ data }) {
  const executives = (data?.executives || [])
    .slice(0, 6)
    .map((ex) => ({
      id: ex._id || ex.name,
      name: ex.name || 'Unknown',
      leads: Number(ex.leads ?? ex.assigned ?? 0),
      followUps: Number(ex.followUps ?? 0),
      quotes: Number(ex.quotes ?? 0),
      bookings: Number(ex.bookings ?? ex.converted ?? 0),
      conversionRate: Number(ex.conversionRate ?? 0),
      followUpCompletion: Number(ex.followUpCompletion ?? 0),
      status: ex.performanceStatus || 'Inactive',
    }));

  const totals = executives.reduce(
    (acc, ex) => {
      acc.leads += ex.leads;
      acc.bookings += ex.bookings;
      acc.quotes += ex.quotes;
      return acc;
    },
    { leads: 0, bookings: 0, quotes: 0 }
  );
  const avgConv = executives.length
    ? Math.round(
        (executives.reduce((s, ex) => s + ex.conversionRate, 0) / executives.length) * 10
      ) / 10
    : 0;
  const maxBookings = Math.max(...executives.map((ex) => ex.bookings), 1);

  return (
    <DashboardPanel
      title="Sales Team Performance"
      subtitle="Today’s ranking by bookings & conversion"
      className="h-full"
      action={
        <Link
          to="/team"
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-800"
        >
          View team
          <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {executives.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 px-3 py-2.5 text-white shadow-sm shadow-violet-600/20">
            <p className="text-[10px] font-medium text-violet-100">Team leads</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums leading-none">{totals.leads}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-medium text-slate-400">Bookings</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums leading-none text-slate-900">
              {totals.bookings}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm">
            <p className="text-[10px] font-medium text-slate-400">Avg conv.</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums leading-none text-emerald-600">
              {avgConv}%
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {executives.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Trophy className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">No team activity yet</p>
            <p className="mt-1 text-xs text-slate-400">Executive performance will show up here today</p>
          </div>
        ) : (
          executives.map((ex, index) => {
            const status = STATUS_META[ex.status] || STATUS_META.Inactive;
            const share = Math.round((ex.bookings / maxBookings) * 100);
            const progress = Math.min(100, Math.max(ex.conversionRate * 4, ex.followUpCompletion));

            return (
              <div
                key={ex.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 transition hover:border-slate-200 hover:shadow-md hover:shadow-slate-200/60"
              >
                <div
                  className={cn('absolute inset-y-0 left-0 w-1', status.bar)}
                  aria-hidden
                />

                <div className="flex items-start gap-2.5 pl-1.5">
                  <div
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold shadow-sm',
                      index < 3 ? RANK_STYLE[index] : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {index + 1}
                  </div>

                  <Avatar name={ex.name} size="sm" className="ring-2 ring-white shadow-sm" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-slate-900">{ex.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {ex.conversionRate}% conversion · {ex.followUpCompletion}% FU done
                        </p>
                      </div>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                          status.chip
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-4 gap-1.5">
                      <Metric icon={Users} label="Leads" value={ex.leads} tone="text-slate-800" />
                      <Metric
                        icon={CalendarCheck2}
                        label="Follow"
                        value={ex.followUps}
                        tone="text-slate-800"
                      />
                      <Metric icon={FileText} label="Quotes" value={ex.quotes} tone="text-slate-800" />
                      <Metric
                        icon={Trophy}
                        label="Booked"
                        value={ex.bookings}
                        tone="text-violet-700"
                      />
                    </div>

                    <div className="mt-2.5">
                      <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-400">
                        <span>Booking share</span>
                        <span className="tabular-nums text-slate-500">{share}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            index === 0
                              ? 'bg-gradient-to-r from-amber-400 to-violet-600'
                              : status.bar
                          )}
                          style={{ width: `${Math.max(progress > 0 ? share : 0, share ? 8 : 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </DashboardPanel>
  );
}
