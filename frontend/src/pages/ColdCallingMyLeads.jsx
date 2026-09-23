import { useState } from 'react';
import { ColdCallingMyLeadsView } from '../components/cold-calling/ColdCallingViews';
import ColdCallHistoryModal from '../components/cold-calling/ColdCallHistoryModal';
import { useMyColdCallingLeadsQuery } from '../features/leads/hooks/useExecutiveLeadStatusQuery';

const PAGE_SIZE = 25;

export default function ColdCallingMyLeads() {
  const [pageIndex, setPageIndex] = useState(0);
  const [historyLead, setHistoryLead] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const { data, isPending, isError, error, refetch } = useMyColdCallingLeadsQuery({ page: pageIndex + 1, limit: PAGE_SIZE });
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
      onOpenHistory={(row) => {
        setHistoryLead(row.lead);
        setHistoryOpen(true);
      }}
    />
    <ColdCallHistoryModal open={historyOpen} lead={historyLead} onClose={() => setHistoryOpen(false)} />
    </>
  );
}
