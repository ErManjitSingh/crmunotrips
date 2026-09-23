import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ColdCallingDashboardView } from '../components/cold-calling/ColdCallingViews';
import { useMyColdCallingLeadsQuery } from '../features/leads/hooks/useExecutiveLeadStatusQuery';
import { buildCallingSummary } from '../lib/coldCallingWorkspace';

export default function ColdCallingDashboard() {
  const { user } = useAuth();
  // limit 1: only the total is needed here; the list itself lives on My Leads.
  const { data } = useMyColdCallingLeadsQuery({ page: 1, limit: 1 });
  const total = data?.pagination?.total;
  const summary = useMemo(() => buildCallingSummary(total), [total]);
  return <ColdCallingDashboardView user={user} summary={summary} />;
}
