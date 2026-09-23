import { Link } from 'react-router-dom';
import { ChevronRight, Headphones } from 'lucide-react';
import ExecutiveAvatar from '../executive-lead-status/ExecutiveAvatar';
import { formatDuration, formatNumber, formatPercent } from '../../lib/coldCallingAnalytics';
import { cn } from '../../lib/utils';

const COLUMNS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'worked', label: 'Worked' },
  { key: 'unworked', label: 'Unworked' },
  { key: 'workRate', label: 'Work Rate', format: formatPercent, hint: 'Worked ÷ Assigned' },
  { key: 'calls', label: 'Calls' },
  { key: 'connected', label: 'Connected' },
  { key: 'avgCallDurationSec', label: 'Avg Duration', format: formatDuration, hint: 'Connected calls with a recorded duration' },
  { key: 'coldToWarm', label: 'Cold → Warm', hint: 'Reached Warm at any point after assignment' },
  { key: 'coldToHot', label: 'Cold → Hot', hint: 'Reached Hot at any point after assignment' },
  { key: 'converted', label: 'Converted', hint: 'Currently Converted' },
];

const cell = (row, column) => (column.format ? column.format(row[column.key]) : formatNumber(row[column.key]));

function SkeletonRows() {
  return [...Array(4)].map((_, row) => (
    <tr key={row} className="border-t border-slate-100">
      <td className="px-3 py-3.5"><div className="h-4 w-32 animate-pulse rounded bg-slate-100" /></td>
      {COLUMNS.map((column) => (
        <td key={column.key} className="px-2 py-3.5"><div className="ml-auto h-4 w-9 animate-pulse rounded bg-slate-100" /></td>
      ))}
      <td className="w-8" />
    </tr>
  ));
}

/**
 * Cold Calling Performance. One row per agent, straight from the server (factual figures only: no score,
 * rank or "best" marker). The footer row is the server's overall summary for the same filters. Each row
 * links to the agent's own page; on phones the table becomes cards.
 */
export default function AgentPerformanceTable({ agents = [], summary, movements = [], loading = false, refreshing = false, detailPathFor, linkState }) {
  const empty = !loading && agents.length === 0;
  const moved = Object.fromEntries(movements.map((m) => [m.key, m.leads]));
  const footer = summary
    ? { ...summary, calls: summary.totalCalls, connected: summary.connectedCalls, coldToWarm: moved.cold_to_warm, coldToHot: moved.cold_to_hot, converted: moved.cold_to_converted }
    : null;

  return (
    <section aria-label="Cold Calling Performance" className={cn('rounded-2xl border border-subtle bg-white shadow-sm', refreshing && 'opacity-70 transition-opacity')} aria-busy={loading || refreshing}>
      <header className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Cold Calling Performance</h2>
      </header>

      {!empty && (
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80">
                <th scope="col" className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Agent</th>
                {COLUMNS.map((column) => (
                  <th key={column.key} scope="col" title={column.hint} className="px-2 py-2.5 text-right text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-500">
                    {column.label}
                  </th>
                ))}
                <th scope="col" className="w-8"><span className="sr-only">Open agent</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows />}
              {!loading &&
                agents.map((agent) => (
                  <tr key={agent._id} className="group border-t border-slate-100 transition-colors hover:bg-violet-50/60 focus-within:bg-violet-50/60" data-agent={agent.name}>
                    <td className="px-3 py-2.5">
                      <Link to={detailPathFor(agent)} state={linkState} className="flex items-center gap-2.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70">
                        <ExecutiveAvatar name={agent.name} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-900">{agent.name}</span>
                          {agent.active === false && <span className="block text-[10px] font-semibold uppercase text-slate-400">Inactive</span>}
                        </span>
                      </Link>
                    </td>
                    {COLUMNS.map((column) => (
                      <td key={column.key} className="metric-tabular px-2 py-2.5 text-right text-slate-800">{cell(agent, column)}</td>
                    ))}
                    <td className="w-8 pr-3 text-slate-300 group-hover:text-violet-500"><ChevronRight className="h-4 w-4" aria-hidden="true" /></td>
                  </tr>
                ))}
            </tbody>
            {!loading && footer && agents.length > 1 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/70 font-bold text-slate-900">
                  <td className="px-3 py-2.5 text-xs uppercase tracking-wide text-slate-500">All agents</td>
                  {COLUMNS.map((column) => (
                    <td key={column.key} className="metric-tabular px-2 py-2.5 text-right">{cell(footer, column)}</td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {!empty && (
        <ul className="divide-y divide-slate-100 lg:hidden">
          {loading && [...Array(3)].map((_, i) => <li key={i} className="px-4 py-4"><div className="h-16 animate-pulse rounded bg-slate-100" /></li>)}
          {!loading &&
            agents.map((agent) => (
              <li key={agent._id}>
                <Link to={detailPathFor(agent)} state={linkState} className="block px-4 py-3.5 transition-colors hover:bg-violet-50/60 focus:outline-none focus-visible:bg-violet-50" data-agent={agent.name}>
                  <span className="flex items-center gap-2.5">
                    <ExecutiveAvatar name={agent.name} />
                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{agent.name}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                  </span>
                  <span className="mt-2.5 grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
                    {COLUMNS.map((column) => (
                      <span key={column.key}>
                        <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">{column.label}</span>
                        <span className="metric-tabular block text-sm font-semibold text-slate-800">{cell(agent, column)}</span>
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      )}

      {empty && (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <Headphones className="h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-900">No Cold Calling agents to show</p>
          <p className="max-w-sm text-xs text-slate-500">No active Cold Calling agent matches these filters, and none had leads assigned in this period.</p>
        </div>
      )}
    </section>
  );
}
