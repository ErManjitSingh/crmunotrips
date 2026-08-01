import { useEffect, useMemo, useState } from 'react';
import {
  getLeadDetailData,
  mergeLeadActivities,
  enrichQuotationActivities,
} from '../../../components/lead-detail/leadDetailData';
import { fetchLeadTimeline } from '../../../services/leadEnterpriseApi';

export function useLeadActivities(lead, leadId) {
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setTimeline([]);
      return;
    }
    let cancelled = false;
    setTimelineLoading(true);
    fetchLeadTimeline(leadId, { limit: 30 })
      .then((res) => {
        if (!cancelled) setTimeline(res.data || []);
      })
      .catch(() => {
        if (!cancelled) setTimeline([]);
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const detail = useMemo(() => (lead ? getLeadDetailData(lead) : { activities: [] }), [lead]);
  const activities = useMemo(() => {
    const merged = mergeLeadActivities(detail.activities, timeline);
    return enrichQuotationActivities(merged, lead?.quotations || []);
  }, [detail.activities, timeline, lead?.quotations]);

  return { activities, timelineLoading, detail };
}
