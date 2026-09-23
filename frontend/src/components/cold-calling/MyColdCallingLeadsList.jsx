import { History, PhoneCall } from 'lucide-react';
import { formatAssignedDate } from '../../lib/executiveLeadStatusFilters';
import { callButtonLead, describeCallActivity, formatCallDateTime } from '../../lib/coldCallingCalls';
import { formatLeadId } from '../leads/constants';
import { describeLeadStatusReason } from '../../lib/executiveLeadStatusReason';
import { DestinationChip, TravelDateCell } from '../sales-manager/LeadListBadges';
import { getStatusReasonLabel } from '../../lib/executiveStatusDisplay';
import { STATUS_THEME } from '../executive-lead-status/statusTheme';
import TrackedCallButton from '../leads/TrackedCallButton';
import { cn } from '../../lib/utils';

const HEADERS = ['Lead', 'Customer', 'Destination', 'Travel Date', 'Original Sales Executive', 'Current Sales Owner', 'Status', 'Calls', 'Assigned At'];

/** The lead's CURRENT status (backend `bucket`, never re-derived here) in the shape the shared badge expects. */
const statusOf = (row) => ({ bucket: row.bucket, status: row.status, statusReason: row.statusReason });
const ownerName = (owner) => owner?.name || '—';

const LIFECYCLE_LABEL = { lost: 'Lost', converted: 'Converted' };

/**
 * Status cell. A live lead shows its Cold / Warm / Hot bucket and reason. A lead that is Lost or Converted
 * shows THAT instead ("LOST · Not interested" / "CONVERTED"): the bucket only reflects the lead's last
 * reason, so on its own it would read "Cold" for a lead that can no longer be called. `lifecycle` comes from
 * the server, from the same terminal-status list that decides `canCall`. The reason sits under the badge
 * (left-aligned in the table, right-aligned on phone cards) so the column stays narrow.
 */
function RowStatus({ row, stacked = false }) {
  const lifecycle = row.lifecycle;
  const theme = STATUS_THEME[lifecycle || row.bucket] || STATUS_THEME.unclassified;
  const label = lifecycle ? LIFECYCLE_LABEL[lifecycle] : theme.label;
  const reason = lifecycle
    ? (lifecycle === 'lost' ? getStatusReasonLabel(row.statusReason) : '')
    : describeLeadStatusReason(statusOf(row));
  return (
    <span className={cn('flex min-w-0 max-w-full flex-col gap-0.5', stacked ? 'items-end' : 'items-start')} data-lifecycle={lifecycle || undefined}>
      <span
        className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset', theme.badge)}
        aria-label={`Status: ${label}`}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', theme.dot)} aria-hidden="true" />
        {label}
      </span>
      {reason && reason !== '—' && (
        <span className="min-w-0 max-w-full truncate text-xs font-medium text-slate-500" title={reason}>
          <span className="sr-only">Reason: </span>
          {reason}
        </span>
      )}
    </span>
  );
}

function Skeleton() {
  return [...Array(5)].map((_, row) => (
    <tr key={row} className="border-t border-slate-100">
      {[...HEADERS, 'Action'].map((header) => (
        <td key={header} className="px-3 py-3.5"><div className="h-4 w-full max-w-[110px] animate-pulse rounded bg-slate-100" /></td>
      ))}
    </tr>
  ));
}

function CallActivity({ calls }) {
  const activity = describeCallActivity(calls);
  if (!activity.called) return <span className="whitespace-nowrap text-xs text-slate-400">{activity.label}</span>;
  return (
    <span className="block min-w-0">
      <span className="block text-sm font-semibold text-slate-800">{activity.label}</span>
      <span className="block truncate text-xs text-slate-500" title={`Last: ${activity.lastOutcome} · ${formatCallDateTime(activity.lastCallAt)}`}>
        Last: {activity.lastOutcome}
      </span>
    </span>
  );
}

/** Call (the CRM's shared call button, Cold Calling authorization) + call history for one lead. */
function RowActions({ row, onOpenHistory, className }) {
  const hasCalls = Number(row.calls?.count || 0) > 0;
  // The server decides (a converted / lost lead can no longer be called); history stays available either way.
  const callable = row.canCall !== false;
  return (
    <span className={cn('flex items-center gap-1.5', className)}>
      {callable ? (
        <TrackedCallButton
          lead={callButtonLead(row)}
          coldCalling
          aria-label={`Call ${row.lead.name}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
        />
      ) : (
        <span
          title="This lead is closed (converted or lost) and can no longer be called"
          className="inline-flex h-9 cursor-not-allowed items-center rounded-lg bg-slate-100 px-2.5 text-sm font-semibold text-slate-400"
        >
          Closed
        </span>
      )}
      {onOpenHistory && (
        <button
          type="button"
          onClick={() => onOpenHistory(row)}
          disabled={!hasCalls}
          aria-label={`Call history for ${row.lead.name}`}
          title={hasCalls ? 'Call history' : 'No calls yet'}
          className="inline-flex h-9 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <History className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/**
 * The signed-in Cold Caller's own assigned leads. Read-only apart from calling: no links into Lead
 * Detail, no phone number in the page (the server hands the number over only when Call is pressed,
 * for a lead the agent is assigned). "Original Sales Executive" is the snapshot taken at assignment;
 * "Current Sales Owner" is live.
 */
export default function MyColdCallingLeadsList({ rows = [], loading = false, onOpenHistory }) {
  const empty = !loading && rows.length === 0;
  return (
    <div className="rounded-2xl border border-subtle bg-white shadow-sm" aria-busy={loading}>
      {!empty && (
        <div className="hidden overflow-x-auto rounded-2xl xl:block">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead>
              <tr className="bg-slate-50/80">
                {HEADERS.map((header) => (
                  <th key={header} scope="col" className="px-2 py-3 text-left text-[11px] leading-tight font-bold uppercase tracking-wide text-slate-500">
                    {header}
                  </th>
                ))}
                <th scope="col" className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && <Skeleton />}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.assignmentId} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-2 py-3 font-semibold text-slate-700">{formatLeadId(row.lead._id)}</td>
                    <td className="max-w-[200px] px-2 py-3 font-semibold text-slate-900"><span className="block truncate">{row.lead.name}</span></td>
                    <td className="max-w-[170px] px-2 py-3"><DestinationChip name={row.lead.destination} /></td>
                    <td className="px-2 py-3"><TravelDateCell date={row.lead.travelDate} /></td>
                    <td className="max-w-[160px] px-2 py-3 text-slate-700"><span className="block truncate">{ownerName(row.originalSalesOwner)}</span></td>
                    <td className="max-w-[160px] px-2 py-3 text-slate-700"><span className="block truncate">{ownerName(row.currentSalesOwner)}</span></td>
                    <td className="max-w-[170px] px-2 py-3"><RowStatus row={row} /></td>
                    <td className="max-w-[90px] px-2 py-3"><CallActivity calls={row.calls} /></td>
                    <td className="whitespace-nowrap px-2 py-3 text-slate-600">{formatAssignedDate(row.assignedAt)}</td>
                    <td className="px-2 py-3"><RowActions row={row} onOpenHistory={onOpenHistory} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {!empty && (
        <ul className="divide-y divide-slate-100 xl:hidden">
          {loading &&
            [...Array(3)].map((_, i) => (
              <li key={i} className="space-y-2 px-4 py-4">
                <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
              </li>
            ))}
          {!loading &&
            rows.map((row) => (
              <li key={row.assignmentId} className="flex items-stretch gap-3 px-4 py-3.5">
                <span className={cn('w-1 shrink-0 rounded-full', (STATUS_THEME[row.lifecycle || row.bucket] || STATUS_THEME.unclassified).dot)} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-700">{formatLeadId(row.lead._id)}</span>
                    <span className="block min-w-0 max-w-[65%]"><RowStatus row={row} stacked /></span>
                  </span>
                  <span className="mt-1 block truncate font-semibold text-slate-900">{row.lead.name}</span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <DestinationChip name={row.lead.destination} />
                    <TravelDateCell date={row.lead.travelDate} />
                  </span>
                  <span className="mt-1.5 block text-xs text-slate-500">
                    Original: <span className="font-medium text-slate-700">{ownerName(row.originalSalesOwner)}</span>
                    {' · '}Now: <span className="font-medium text-slate-700">{ownerName(row.currentSalesOwner)}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    Assigned {formatAssignedDate(row.assignedAt)}
                    {' · '}
                    {describeCallActivity(row.calls).called
                      ? `${describeCallActivity(row.calls).label}, last: ${describeCallActivity(row.calls).lastOutcome}`
                      : 'Not called yet'}
                  </span>
                  <RowActions row={row} onOpenHistory={onOpenHistory} className="mt-2.5" />
                </span>
              </li>
            ))}
        </ul>
      )}

      {empty && (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100">
            <PhoneCall className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-slate-900">No leads assigned yet</p>
          <p className="max-w-sm text-xs leading-relaxed text-slate-500">
            Leads assigned to you for Cold Calling will appear here. Once Admin assigns Cold leads to you, they will show up in this list.
          </p>
        </div>
      )}
    </div>
  );
}
