import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ColdCallingMyLeadsView } from '../components/cold-calling/ColdCallingViews';
import ColdCallHistoryModal from '../components/cold-calling/ColdCallHistoryModal';
import ReassignLeadModal from '../components/cold-calling/ReassignLeadModal';
import { useMyColdCallingLeadsQuery, useMyColdCallingSummaryQuery } from '../features/leads/hooks/useExecutiveLeadStatusQuery';
import { buildCallingSummary, resolveMyLeadsView } from '../lib/coldCallingWorkspace';

const PAGE_SIZE = 25;

export default function ColdCallingMyLeads() {
  // The filter lives in the URL (?view=) so a dashboard card can deep-link to it and Back works.
  const [searchParams, setSearchParams] = useSearchParams();
  const view = resolveMyLeadsView(searchParams.get('view'));
  const [pageIndex, setPageIndex] = useState(0);
  const [historyLead, setHistoryLead] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reassignLead, setReassignLead] = useState(null);
  useEffect(() => { setPageIndex(0); }, [view]);
  const { data, isPending, isError, error, refetch } = useMyColdCallingLeadsQuery({ page: pageIndex + 1, limit: PAGE_SIZE, view });
  const { data: summaryData } = useMyColdCallingSummaryQuery();
  return (
    <>
    <ColdCallingMyLeadsView
      rows={data?.data ?? []}
      loading={isPending}
      error={isError ? error?.response?.data?.message || error?.message || 'Something went wrong.' : null}
      onRetry={() => refetch()}
      pagination={data?.pagination}
      pageIndex={pageIndex}
      pageSize={PAGE_SIZE}
      onPageChange={setPageIndex}
      view={view}
      counts={buildCallingSummary(summaryData)}
      onViewChange={(next) => setSearchParams(next === 'all' ? {} : { view: next })}
      onReassign={(row) => setReassignLead(row.lead)}
      onOpenHistory={(row) => {
        setHistoryLead(row.lead);
        setHistoryOpen(true);
      }}
    />
    <ColdCallHistoryModal open={historyOpen} lead={historyLead} onClose={() => setHistoryOpen(false)} />
    <ReassignLeadModal open={Boolean(reassignLead)} lead={reassignLead} onClose={() => setReassignLead(null)} />
    </>
  );
}
