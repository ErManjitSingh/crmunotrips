import { Link } from 'react-router-dom';
import { ArrowUpRight, Inbox } from 'lucide-react';
import LeadStatusBadge from '../leads/LeadStatusBadge';
import DashboardPanel from './DashboardPanel';
import { CustomerCell, DestinationChip, MealPlanBadge, TravelDateCell, SourceBadge } from '../sales-manager/LeadListBadges';
import { LEAD_LIST_TH, LEAD_LIST_TD, leadListRowClass } from '../leads/leadListStyles';

export default function RecentLeadsTable({
  leads = [],
  title = 'Recent Leads',
  subtitle = 'Latest inquiries',
  viewAllHref = '/leads',
  emptyMessage = 'No leads to show',
  maxRows = 5,
  totalCount,
  embedded = false,
  showAgent = true,
}) {
  const visibleLeads = maxRows ? leads.slice(0, maxRows) : leads;
  const total = totalCount ?? leads.length;
  const hasMore = total > visibleLeads.length;

  const columns = [
    { key: 'customer', label: 'Customer' },
    { key: 'destination', label: 'Destination' },
    { key: 'mealPlan', label: 'Meal Plan' },
    { key: 'travelDate', label: 'Travel Date' },
    ...(showAgent
      ? [{ key: 'agent', label: 'Agent' }]
      : [{ key: 'created', label: 'Created' }]),
    { key: 'status', label: 'Status' },
    { key: 'source', label: 'Source' },
  ];

  const tableBody = visibleLeads.length === 0 ? (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <Inbox className="w-10 h-10 text-content-muted/40 mb-3" />
      <p className="text-sm font-medium text-content-muted">{emptyMessage}</p>
    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] table-auto border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={LEAD_LIST_TH}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleLeads.map((lead, i) => (
            <tr key={lead._id} className={leadListRowClass(i, 'cursor-pointer')}>
              <td className={LEAD_LIST_TD}>
                <Link to={`/leads/${lead._id}`} className="block min-w-0">
                  <CustomerCell name={lead.name} lead={lead} />
                </Link>
              </td>
              <td className={LEAD_LIST_TD}>
                <DestinationChip name={lead.destination} />
              </td>
              <td className={LEAD_LIST_TD}>
                <MealPlanBadge mealPlan={lead.mealPlan} mealPreference={lead.mealPreference} />
              </td>
              <td className={LEAD_LIST_TD}>
                <TravelDateCell date={lead.travelDate} />
              </td>
              {showAgent ? (
                <td className={`${LEAD_LIST_TD} text-xs text-content-secondary truncate`}>
                  {lead.assignedTo?.name || 'Unassigned'}
                </td>
              ) : (
                <td className={`${LEAD_LIST_TD} text-xs text-content-muted whitespace-nowrap`}>
                  {lead.createdAt
                    ? new Date(lead.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })
                    : '—'}
                </td>
              )}
              <td className={LEAD_LIST_TD}>
                <LeadStatusBadge status={lead.status} pulse={lead.status === 'new'} size="sm" />
              </td>
              <td className={LEAD_LIST_TD}>
                <SourceBadge
                  source={lead.source}
                  label={lead.sourceLabel}
                  sourceShort={lead.sourceShort}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const viewAllLink = (
    <Link to={viewAllHref} className="text-xs font-medium text-brand-600 hover:underline inline-flex items-center gap-1">
      View all{hasMore ? ` (${total})` : ''} <ArrowUpRight className="w-3.5 h-3.5" />
    </Link>
  );

  if (embedded) {
    return (
      <div>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-subtle">
          <p className="text-xs text-content-muted">
            {hasMore ? `${subtitle} · Showing ${visibleLeads.length} of ${total}` : subtitle}
          </p>
          {viewAllLink}
        </div>
        {tableBody}
      </div>
    );
  }

  return (
    <DashboardPanel
      title={title}
      subtitle={hasMore ? `${subtitle} · Showing ${visibleLeads.length} of ${total}` : subtitle}
      noPadding
      action={viewAllLink}
    >
      {tableBody}
    </DashboardPanel>
  );
}
