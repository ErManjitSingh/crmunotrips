import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Users } from 'lucide-react';
import { formatCount, isSummaryConsistent } from '../../lib/executiveLeadStatusFilters';
import { cn } from '../../lib/utils';
import { STATUS_COLUMNS } from './statusTheme';
import ExecutiveAvatar from './ExecutiveAvatar';
import DistributionBar from './DistributionBar';

const COLUMN_HINTS = {
  assigned: 'Leads currently owned by the executive and assigned in the selected period',
  unclassified: 'Converted leads and leads with no matching Cold / Warm / Hot status',
};

function SkeletonRows() {
  return [...Array(6)].map((_, row) => (
    <tr key={row} className="border-t border-slate-100">
      <td className="px-3 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
          <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
        </div>
      </td>
      {STATUS_COLUMNS.map((column) => (
        <td key={column.key} className="px-3 py-3.5"><div className="ml-auto h-4 w-10 animate-pulse rounded bg-slate-100" /></td>
      ))}
      <td className="hidden px-3 py-3.5 md:table-cell"><div className="h-2 w-full animate-pulse rounded-full bg-slate-100" /></td>
      <td className="w-8" />
    </tr>
  ));
}

/** Phones: one card per executive — name + Assigned, then the four buckets side by side, all visible without scrolling. */
function MobileExecutiveCards({ rows, loading, detailPathFor }) {
  return (
    <ul className="divide-y divide-slate-100 md:hidden">
      {loading &&
        [...Array(4)].map((_, i) => (
          <li key={i} className="space-y-3 px-4 py-4">
            <div className="h-5 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-10 w-full animate-pulse rounded bg-slate-100" />
          </li>
        ))}
      {!loading &&
        rows.map((row) => (
          <li key={row._id}>
            <Link
              to={detailPathFor(row)}
              aria-label={`${row.name}: ${formatCount(row.assigned)} assigned leads. View leads`}
              className="block px-4 py-3.5 transition-colors duration-200 hover:bg-violet-50/70 focus:outline-none focus-visible:bg-violet-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/70"
            >
              <span className="flex items-center gap-3">
                <ExecutiveAvatar name={row.name} />
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-900">{row.name}</span>
                <span className="metric-tabular text-lg font-bold text-violet-700">{formatCount(row.assigned)}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-violet-500">Assigned</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
              </span>
              <span className="mt-3 grid grid-cols-4 gap-2">
                {STATUS_COLUMNS.filter((column) => column.key !== 'assigned').map((column) => (
                  <span key={column.key} className={cn('rounded-lg px-2 py-1.5 text-center', column.headerTint)}>
                    <span className={cn('block text-[9px] font-bold uppercase tracking-wide', column.text)}>
                      {column.key === 'unclassified' ? 'Unclass.' : column.label}
                    </span>
                    <span className={cn('metric-tabular block text-base font-bold', row[column.key] ? column.text : 'text-slate-300')}>
                      {formatCount(row[column.key])}
                    </span>
                  </span>
                ))}
              </span>
              <DistributionBar row={row} className="mt-2.5" />
            </Link>
          </li>
        ))}
    </ul>
  );
}

/**
 * Executive overview. Every row opens that executive's lead list: the name is a real link
 * (keyboard focus + Enter, screen-reader "link"), and the whole row is also clickable for mouse
 * users, so no <div>/<tr> is "clickable" without a native, focusable equivalent.
 * Loading never renders numbers (no misleading zeros): skeleton rows until data arrives.
 */
export default function ExecutiveLeadStatusTable({ rows, totals, loading, refreshing, detailPathFor }) {
  const navigate = useNavigate();
  const empty = !loading && rows.length === 0;

  return (
    <div
      className={cn('rounded-2xl border border-subtle bg-white shadow-sm transition-opacity duration-200', refreshing && 'opacity-70')}
      aria-busy={loading || refreshing}
    >
      <MobileExecutiveCards rows={rows} loading={loading} detailPathFor={detailPathFor} />

      <div className="hidden max-h-[600px] overflow-auto rounded-2xl md:block">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgb(226,232,240)]">
            <tr>
              <th scope="col" className="sticky left-0 z-20 whitespace-nowrap bg-white px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Executive
              </th>
              {STATUS_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  title={COLUMN_HINTS[column.key]}
                  className={cn('whitespace-nowrap px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wide', column.headerTint, column.text)}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', column.dot)} aria-hidden="true" />
                    {column.label}
                  </span>
                </th>
              ))}
              <th scope="col" className="hidden whitespace-nowrap px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 md:table-cell">
                Mix
              </th>
              <th scope="col" className="w-8"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows />}
            {!loading &&
              rows.map((row) => {
                const path = detailPathFor(row);
                return (
                  <tr
                    key={row._id}
                    onClick={() => navigate(path)}
                    className="group cursor-pointer border-t border-slate-100 transition-colors duration-200 hover:bg-violet-50/70 focus-within:bg-violet-50/70"
                  >
                    <th
                      scope="row"
                      className="sticky left-0 z-[1] min-w-[190px] bg-white px-3 py-2.5 text-left font-normal transition-shadow duration-200 group-hover:bg-violet-50 group-focus-within:bg-violet-50 group-hover:shadow-[inset_3px_0_0_0_#8b5cf6] group-focus-within:shadow-[inset_3px_0_0_0_#8b5cf6]"
                    >
                      <Link
                        to={path}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`${row.name}: ${formatCount(row.assigned)} assigned leads. View leads`}
                        className="flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70"
                      >
                        <ExecutiveAvatar name={row.name} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-900 group-hover:text-violet-800">{row.name}</span>
                          {row.email && <span className="block max-w-[200px] truncate text-[11px] text-slate-400">{row.email}</span>}
                        </span>
                      </Link>
                    </th>
                    {STATUS_COLUMNS.map((column) => {
                      const value = row[column.key];
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            'metric-tabular px-3 py-2.5 text-right',
                            column.key === 'assigned' ? 'text-base font-bold' : 'font-semibold',
                            value ? column.text : 'text-slate-300'
                          )}
                        >
                          <span className="inline-flex items-center justify-end gap-1.5">
                            {column.key === 'assigned' && !isSummaryConsistent(row) && (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-label="Counts do not add up" />
                            )}
                            {formatCount(value)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="hidden px-3 py-2.5 md:table-cell"><DistributionBar row={row} /></td>
                    <td className="w-8 pr-3 text-right text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-violet-500 group-focus-within:text-violet-500 motion-reduce:transform-none">
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </td>
                  </tr>
                );
              })}
          </tbody>
          {!loading && rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-10 bg-white shadow-[0_-1px_0_0_rgb(226,232,240)]">
              <tr>
                <th scope="row" className="sticky left-0 z-20 bg-white px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                  Total
                </th>
                {STATUS_COLUMNS.map((column) => (
                  <td key={column.key} className={cn('metric-tabular px-3 py-3 text-right font-bold', column.headerTint, column.strong)}>
                    {formatCount(totals?.[column.key])}
                  </td>
                ))}
                <td className="hidden md:table-cell" />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {empty && (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
          <Users className="h-8 w-8 text-content-muted" />
          <p className="text-sm font-semibold text-content-primary">No executives to show</p>
          <p className="max-w-sm text-xs text-content-muted">
            No matching Sales Executive was found for the selected branch and filters.
          </p>
        </div>
      )}
    </div>
  );
}

