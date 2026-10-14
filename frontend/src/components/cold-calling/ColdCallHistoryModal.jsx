import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import AppModal from '../ui/AppModal';
import LeadActivityTimeline from './LeadActivityTimeline';
import { fetchColdCallingLeadActivity } from '../../services/leadEnterpriseApi';
import { shouldRetryExecutiveLeadStatus } from '../../lib/executiveLeadStatusFilters';

/**
 * The signed-in agent's own history on one lead, day by day: when they opened it and every call they made
 * (time, duration, outcome, notes). One request when opened (never one per row on My Leads); the server
 * only ever returns this agent's own activity.
 */
export default function ColdCallHistoryModal({ open, lead, onClose }) {
  const leadId = lead?._id;
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['cold-calling', 'lead-activity', leadId],
    queryFn: () => fetchColdCallingLeadActivity(leadId),
    enabled: Boolean(open && leadId),
    staleTime: 0,
    retry: shouldRetryExecutiveLeadStatus,
  });

  return (
    <AppModal open={open} onClose={onClose} size="lg">
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Lead history</p>
            <h3 className="mt-1 truncate text-xl font-bold text-content-primary">{lead?.name}</h3>
            <p className="mt-0.5 text-xs text-content-muted">When you opened this lead and every call you made, day by day</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-content-muted transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <LeadActivityTimeline data={data} isPending={isPending} isError={isError} onRetry={() => refetch()} />
      </div>
    </AppModal>
  );
}
