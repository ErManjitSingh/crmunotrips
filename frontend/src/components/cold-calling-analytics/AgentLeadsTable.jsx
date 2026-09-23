import { Link } from 'react-router-dom';
import { History, ClipboardList } from 'lucide-react';
import { CATEGORY_LABELS, dash, describeCategoryReason, formatDateTime, formatNumber, outcomeLabel } from '../../lib/coldCallingAnalytics';
import { formatAssignedDate } from '../../lib/executiveLeadStatusFilters';
import { formatLeadId } from '../leads/constants';
import { STATUS_THEME } from '../executive-lead-status/statusTheme';
import { cn } from '../../lib/utils';

const HEADERS = ['Lead', 'Customer', 'Original Sales Executive', 'Current Sales Owner', 'Calls', 'Last Call', 'Current Status', 'Assigned At'];

function StatusCell({ row, stacked = false }) {
  const theme = STATUS_THEME[row.category] || STATUS_THEME.unclassified;
  const reason = describeCategoryReason(row);
  return (
    <span className={cn('flex min-w-0 max-w-full', stacked ? 'flex-col items-end gap-0.5' : 'items-center gap-1.5')}>
      <span className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset', theme.badge)} aria-label={`Status: ${CATEGORY_LABELS[row.category] || row.category}`}>
        <span className={cn('h-1.5 w-1.5 rounded-full', theme.dot)} aria-hidden="true" />
        {CATEGORY_LABELS[row.category] || row.category}
      </span>
      <span className="min-w-0 max-w-full truncate text-xs font-medium text-slate-500" title={reason}>
        {!stacked && reason !== dash && <span aria-hidden="true">· </span>}
        <span className="sr-only">Reason: </span>
        {reason}
      </span>
    </span>
  );
}

function CallsCell({ row, onOpenHistory }) {
  if (!row.calls.count) return <span className="text-xs text-slate-400">No calls</span>;
  return (
    <button
      type="button"
      onClick={() => onOpenHistory(row.lead)}
      aria-label={`Call history for ${row.lead.name}`}
      className="group inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-left transition hover:bg-violet-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70"
    >
      <span className="metric-tabular text-sm font-bold text-slate-900">{formatNumber(row.calls.count)}</span>
      <History className="h-3.5 w-3.5 text-slate-400 group-hover:text-violet-600" aria-hidden="true" />
    </button>
  );
}

function SkeletonRows() {
  return [...Array(6)].map((_, i) => (
    <tr key={i} className="border-t border-slate-100">
      {HEADERS.map((h) => <td key={h} className="px-3 py-3.5"><div className="h-4 w-full max-w-[100px] animate-pulse rounded bg-slate-100" /></td>)}
    </tr>
  ));
}

/**
 * One agent's leads. Original Sales Executive is the assignment snapshot; Current Sales Owner is live — the
 * two are never merged. No phone number is shown; the Lead ID opens the existing Lead Detail (which applies
 * the existing call-gated masking). "Calls" opens that lead's complete call history.
 */
export default function AgentLeadsTable({ rows = [], loading = false, refreshing = false, onOpenHistory, emptyMessage }) {
  const empty = !loading && rows.length === 0;
  return (
    <div className={cn('rounded-2xl border border-subtle bg-white shadow-sm', refreshing && 'opacity-70 transition-opacity')} aria-busy={loading || refreshing}>
      {!empty && (
        <div className="hidden overflow-x-auto rounded-2xl lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80">
                {HEADERS.map((h) => <th key={h} scope="col" className="px-2.5 py-2.5 text-left text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-500">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows />}
              {!loading && rows.map((row) => (
                <tr key={row.assignmentId} className="border-t border-slate-100" data-lead={row.lead.name}>
                  <td className="whitespace-nowrap px-2.5 py-2.5">
                    <Link to={`/leads/${row.lead._id}`} className="font-semibold text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70" aria-label={`Open lead ${formatLeadId(row.lead._id)}, ${row.lead.name}`}>
                      {formatLeadId(row.lead._id)}
                    </Link>
                  </td>
                  <td className="max-w-[170px] px-2.5 py-2.5 font-semibold text-slate-900"><span className="block truncate">{row.lead.name}</span></td>
                  <td className="max-w-[140px] px-2.5 py-2.5 text-slate-700"><span className="block truncate">{row.originalSalesOwner.name || dash}</span></td>
                  <td className="max-w-[140px] px-2.5 py-2.5 text-slate-700"><span className="block truncate">{row.currentSalesOwner?.name || dash}</span></td>
                  <td className="px-2.5 py-2.5"><CallsCell row={row} onOpenHistory={onOpenHistory} /></td>
                  <td className="px-2.5 py-2.5 text-xs text-slate-600">
                    {row.calls.lastCallAt ? (
                      <>
                        <span className="block whitespace-nowrap">{formatDateTime(row.calls.lastCallAt)}</span>
                        <span className="block text-slate-400">{outcomeLabel(row.calls.lastOutcome)}</span>
                      </>
                    ) : dash}
                  </td>
                  <td className="max-w-[240px] px-2.5 py-2.5"><StatusCell row={row} /></td>
                  <td className="whitespace-nowrap px-2.5 py-2.5 text-slate-600">{formatAssignedDate(row.assignedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!empty && (
        <ul className="divide-y divide-slate-100 lg:hidden">
          {loading && [...Array(4)].map((_, i) => <li key={i} className="space-y-2 px-4 py-4"><div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" /><div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" /></li>)}
          {!loading && rows.map((row) => (
            <li key={row.assignmentId} className="flex items-stretch gap-3 px-4 py-3.5" data-lead={row.lead.name}>
              <span className={cn('w-1 shrink-0 rounded-full', (STATUS_THEME[row.category] || STATUS_THEME.unclassified).dot)} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-2">
                  <Link to={`/leads/${row.lead._id}`} className="text-sm font-semibold text-blue-600">{formatLeadId(row.lead._id)}</Link>
                  <span className="block min-w-0 max-w-[65%]"><StatusCell row={row} stacked /></span>
                </span>
                <span className="mt-1 block truncate font-semibold text-slate-900">{row.lead.name}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  Original: <span className="font-medium text-slate-700">{row.originalSalesOwner.name || dash}</span>
                  {' · '}Now: <span className="font-medium text-slate-700">{row.currentSalesOwner?.name || dash}</span>
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  <span>Assigned {formatAssignedDate(row.assignedAt)}</span>
                  {row.calls.lastCallAt && <span>· Last call {formatDateTime(row.calls.lastCallAt)}</span>}
                </span>
                <span className="mt-1.5 block"><CallsCell row={row} onOpenHistory={onOpenHistory} /></span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {empty && (
        <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
          <ClipboardList className="h-8 w-8 text-content-muted" aria-hidden="true" />
          <p className="text-sm font-semibold text-content-primary">No leads to show</p>
          <p className="max-w-sm text-xs text-content-muted">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
