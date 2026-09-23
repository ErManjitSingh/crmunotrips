import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardList } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatAssignedDate } from '../../lib/executiveLeadStatusFilters';
import { formatLeadId } from '../leads/constants';
import { DestinationChip, TravelDateCell } from '../sales-manager/LeadListBadges';
import { ColdCallingIndicator, LeadStatusWithReason } from './LeadBucketBadge';
import { isAssignableToColdCalling, selectAllState } from '../../lib/coldCallingAssignment';
import { STATUS_THEME } from './statusTheme';

const HEADERS = ['Lead ID', 'Customer', 'Phone', 'Destination', 'Travel Date', 'Status', 'Assigned'];

const leadPath = (lead) => `/leads/${lead._id}`;
const linkFocus = 'rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70';

function Phone({ value }) {
  if (!value) return <span className="text-slate-400">—</span>;
  return <span className="font-mono text-[13px] text-slate-700">{value}</span>;
}

function SkeletonRows({ selectable }) {
  return [...Array(6)].map((_, row) => (
    <tr key={row} className="border-t border-slate-100">
      {selectable && <td className="w-10 px-3 py-3.5"><div className="h-4 w-4 animate-pulse rounded bg-slate-100" /></td>}
      {HEADERS.map((header) => (
        <td key={header} className="px-3 py-3.5"><div className="h-4 w-full max-w-[110px] animate-pulse rounded bg-slate-100" /></td>
      ))}
      <td className="w-8" />
    </tr>
  ));
}

/**
 * Lead list for one executive. Each lead opens the EXISTING Lead Detail page (/leads/:id) — the
 * Lead ID is a native link and the row is clickable for mouse users. Status is the backend's
 * `bucket` (never re-derived here). Desktop is a table; on small screens it becomes cards, so
 * nothing needs sideways scrolling to be readable.
 */
export default function ExecutiveLeadsList({ leads, loading, emptyMessage, selection }) {
  const navigate = useNavigate();
  const empty = !loading && leads.length === 0;
  // Selection is only offered (Cold tab) when the page passes it: { selectedIds, onToggle, onToggleAll }.
  const selectable = Boolean(selection);
  const selectedIds = selection?.selectedIds ?? [];
  const headerState = selectable ? selectAllState(selectedIds, leads) : 'none';

  return (
    <div className="rounded-2xl border border-subtle bg-white shadow-sm" aria-busy={loading}>
      {/* Desktop / tablet */}
      <div className="hidden overflow-x-auto rounded-2xl md:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="bg-slate-50/80">
              {selectable && (
                <th scope="col" className="w-10 px-3">
                  <input
                    type="checkbox"
                    aria-label="Select all visible unassigned Cold leads"
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-violet-600"
                    checked={headerState === 'all'}
                    ref={(node) => { if (node) node.indeterminate = headerState === 'some'; }}
                    disabled={loading || !leads.some(isAssignableToColdCalling)}
                    onChange={() => selection.onToggleAll()}
                  />
                </th>
              )}
              {HEADERS.map((header) => (
                <th key={header} scope="col" className="whitespace-nowrap px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  {header}
                </th>
              ))}
              <th scope="col" className="w-8"><span className="sr-only">Open lead</span></th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonRows selectable={selectable} />}
            {!loading &&
              leads.map((lead) => (
                <tr
                  key={lead._id}
                  onClick={() => navigate(leadPath(lead))}
                  className="group cursor-pointer border-t border-slate-100 transition-colors duration-200 hover:bg-violet-50/60 focus-within:bg-violet-50/60"
                >
                  {selectable && (
                    <td className="w-10 px-3 py-3" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${lead.name}`}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
                        checked={selectedIds.includes(lead._id)}
                        disabled={!isAssignableToColdCalling(lead)}
                        onChange={() => selection.onToggle(lead._id)}
                      />
                    </td>
                  )}
                  <td className="whitespace-nowrap px-3 py-3">
                    <Link
                      to={leadPath(lead)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Open lead ${formatLeadId(lead._id)}, ${lead.name}`}
                      className={cn('font-semibold text-blue-600 hover:underline', linkFocus)}
                    >
                      {formatLeadId(lead._id)}
                    </Link>
                  </td>
                  <td className="max-w-[220px] px-3 py-3 font-semibold text-slate-900"><span className="block truncate">{lead.name}</span></td>
                  <td className="px-3 py-3"><Phone value={lead.phone} /></td>
                  <td className="px-3 py-3"><DestinationChip name={lead.destination} /></td>
                  <td className="px-3 py-3"><TravelDateCell date={lead.travelDate} /></td>
                  <td className="max-w-[280px] px-3 py-3">
                    <LeadStatusWithReason lead={lead} />
                    <ColdCallingIndicator lead={lead} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatAssignedDate(lead.assignedAt)}</td>
                  <td className="w-8 pr-3 text-slate-300 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-violet-500 motion-reduce:transform-none">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {loading &&
          [...Array(4)].map((_, i) => (
            <li key={i} className="space-y-2 px-4 py-4">
              <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            </li>
          ))}
        {!loading &&
          leads.map((lead) => (
            <li key={lead._id} className="flex items-stretch">
              {selectable && (
                <label className="flex w-11 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    aria-label={`Select ${lead.name}`}
                    className="h-5 w-5 cursor-pointer rounded border-slate-300 accent-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
                    checked={selectedIds.includes(lead._id)}
                    disabled={!isAssignableToColdCalling(lead)}
                    onChange={() => selection.onToggle(lead._id)}
                  />
                </label>
              )}
              <Link
                to={leadPath(lead)}
                className={cn(
                  selectable ? 'pl-0' : 'pl-4',
                  'flex min-w-0 flex-1 items-stretch gap-3 py-3.5 pr-4 transition-colors duration-200 hover:bg-violet-50/60 focus:outline-none focus-visible:bg-violet-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/70'
                )}
              >
                <span className={cn('w-1 shrink-0 rounded-full', (STATUS_THEME[lead.bucket] || STATUS_THEME.unclassified).dot)} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-blue-600">{formatLeadId(lead._id)}</span>
                    <span className="block min-w-0 max-w-[65%]">
                      <LeadStatusWithReason lead={lead} stacked />
                      <ColdCallingIndicator lead={lead} stacked />
                    </span>
                  </span>
                  <span className="mt-1 block truncate font-semibold text-slate-900">{lead.name}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <Phone value={lead.phone} />
                    {lead.destination && <span>{lead.destination}</span>}
                    <span>Assigned {formatAssignedDate(lead.assignedAt)}</span>
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 self-center text-slate-300" aria-hidden="true" />
              </Link>
            </li>
          ))}
      </ul>

      {empty && (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
          <ClipboardList className="h-8 w-8 text-content-muted" />
          <p className="text-sm font-semibold text-content-primary">No leads to show</p>
          <p className="max-w-sm text-xs text-content-muted">{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
