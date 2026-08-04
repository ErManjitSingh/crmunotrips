import { useCallback, useEffect, useState } from 'react';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../api/axios';
import { Button } from '../ui/button';
import { LeadDetailLayout } from '../lead-detail';
import AddFollowUpModal from '../followups/AddFollowUpModal';
import { createExecutiveFollowUp, buildFollowUpPayload } from '../followups/followupApi';
import { useLeadActivities } from '../../features/leads/hooks/useLeadActivities';
import { isLeadStatusLocked } from '../../utils/leadUtils';
import PostConvertCommercialModal from '../leads/PostConvertCommercialModal';
import LeadFollowUpOutcomeModal from './LeadFollowUpOutcomeModal';

export default function ExecutiveLeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [flashMessage, setFlashMessage] = useState(location.state?.message || '');
  const [highlightQuotationId] = useState(location.state?.quotationId || null);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [markingCallDone, setMarkingCallDone] = useState(false);
  const [commercialOpen, setCommercialOpen] = useState(false);

  const loadLead = useCallback(({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    return API.get(`/sales-executive/leads/${id}`, {
      params: { includeRelated: 1 },
      skipSuccessToast: true,
    })
      .then((res) => setLead(res.data))
      .catch(() => setLead(null))
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    document.body.style.overflow = '';
    document.body.style.pointerEvents = '';
    const main = document.querySelector('[data-workspace-main]');
    main?.scrollTo({ top: 0, left: 0 });
    loadLead();
  }, [loadLead]);

  useEffect(() => {
    if (!location.state?.message && !location.state?.focusTimeline) return undefined;
    setFlashMessage(location.state.message || '');
    if (location.state.focusTimeline) {
      const t = setTimeout(() => {
        document.getElementById('lead-activity-timeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
      navigate(location.pathname, { replace: true, state: {} });
      return () => clearTimeout(t);
    }
    navigate(location.pathname, { replace: true, state: {} });
    return undefined;
  }, [location.state, location.pathname, navigate]);

  useDataRefresh(['leads'], loadLead);

  const { activities, timelineLoading } = useLeadActivities(
    lead
      ? {
          ...lead,
          followUps: lead.followups || [],
          quotations: lead.quotations || [],
        }
      : null,
    id
  );

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 rounded-2xl bg-slate-100" />
        <div className="h-20 rounded-2xl bg-slate-100" />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-3 h-[500px] rounded-2xl bg-slate-100" />
          <div className="xl:col-span-6 h-[500px] rounded-2xl bg-slate-100" />
          <div className="xl:col-span-3 h-[400px] rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="rounded-2xl border border-subtle bg-white p-12 text-center shadow-sm">
        <p className="text-content-muted">Lead not found or not assigned to you</p>
        <Link to="/sales-executive/leads/all" className="text-violet-600 text-sm mt-2 inline-block hover:underline">
          ← Back to My Leads
        </Link>
      </div>
    );
  }

  const handleFollowUpOutcome = async (payload, meta = {}) => {
    await API.put(`/sales-executive/leads/${id}`, payload);
    if (meta.comment && ['lost', 'booked_from_another_company'].includes(payload.status)) {
      await API.post(`/sales-executive/leads/${id}/notes`, { text: meta.comment }).catch(() => {});
    }
    const becameConverted = payload.status === 'converted';
    setStatusModalOpen(false);
    await loadLead();
    if (becameConverted) setCommercialOpen(true);
  };

  const handleColdCallDone = async () => {
    if (!id || markingCallDone) return;
    setMarkingCallDone(true);
    try {
      await API.put(`/sales-executive/leads/${id}`, {
        coldCallDone: true,
        coldCallNotes: 'Cold call done',
      });
      await loadLead({ silent: true });
    } finally {
      setMarkingCallDone(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pb-8">
      {lead.coldCallPending && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-red-700">Next cold call is due</p>
            <p className="text-xs text-red-600/80">
              {lead.coldReason ? `Reason: ${String(lead.coldReason).replace(/_/g, ' ')} · ` : ''}
              Reminder stays until you mark call done
            </p>
          </div>
          <Button
            type="button"
            onClick={handleColdCallDone}
            disabled={markingCallDone}
            className="bg-red-600 hover:bg-red-500 text-white"
          >
            {markingCallDone ? 'Saving…' : 'Call Done'}
          </Button>
        </div>
      )}

      <LeadDetailLayout
        lead={lead}
        leadId={id}
        activities={activities}
        timelineLoading={timelineLoading}
        relatedBasePath="/sales-executive/leads"
        backHref="/sales-executive/leads/all"
        backLabel="Back to Leads"
        contactEndpoint="/sales-executive/leads"
        flashMessage={flashMessage}
        highlightQuotationId={highlightQuotationId}
        onCreateQuote={() => navigate(`/sales-executive/quotations/new?leadId=${id}`)}
        onScheduleFollowUp={() => setFollowUpModalOpen(true)}
        onContactLogged={loadLead}
        onEmailSent={loadLead}
        onChangeStatus={!isLeadStatusLocked(lead.status) ? () => setStatusModalOpen(true) : undefined}
        canChangeStatus={!isLeadStatusLocked(lead.status)}
        canEditLead
        editHref={`/sales-executive/leads/${id}/edit`}
      />

      <AddFollowUpModal
        open={followUpModalOpen}
        onClose={() => setFollowUpModalOpen(false)}
        fixedLeadId={lead._id}
        fixedLeadName={lead.name}
        onSubmit={async (data) => {
          await createExecutiveFollowUp(buildFollowUpPayload({ ...data, lead: lead._id }));
          setFollowUpModalOpen(false);
          await loadLead();
        }}
      />

      <LeadFollowUpOutcomeModal
        open={statusModalOpen}
        lead={lead}
        onClose={() => setStatusModalOpen(false)}
        onSubmit={handleFollowUpOutcome}
      />

      <PostConvertCommercialModal
        open={commercialOpen}
        leadId={id}
        onClose={() => setCommercialOpen(false)}
      />
    </motion.div>
  );
}
