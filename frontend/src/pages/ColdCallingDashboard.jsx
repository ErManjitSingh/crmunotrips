import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { ColdCallingDashboardView } from '../components/cold-calling/ColdCallingViews';
import { useMyColdCallingSummaryQuery } from '../features/leads/hooks/useExecutiveLeadStatusQuery';
import { buildCallingSummary } from '../lib/coldCallingWorkspace';

export default function ColdCallingDashboard() {
  const { user } = useAuth();
  const { data } = useMyColdCallingSummaryQuery();
  const summary = useMemo(() => buildCallingSummary(data), [data]);
  return <ColdCallingDashboardView user={user} summary={summary} />;
}
