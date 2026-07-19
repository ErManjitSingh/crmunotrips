import { useCallback, useEffect, useState } from 'react';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../api/axios';
import { Button } from '../ui/button';
import { ActionModal } from './LeadActionsMenu';
import { LeadDetailLayout } from '../lead-detail';
import AddFollowUpModal from '../followups/AddFollowUpModal';
import { createExecutiveFollowUp, buildFollowUpPayload } from '../followups/followupApi';
import { useLeadActivities } from '../../features/leads/hooks/useLeadActivities';
import { isLeadStatusLocked } from '../../utils/leadUtils';

const STATUSES = [
  'new',
  'contacted',
  'working_progress',
  'follow_up',
  'quotation_sent',
  'negotiation',
  'converted',
  'lost',
  'booked_from_another_company',
];

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
  const [modalStatus, setModalStatus] = useState('contacted');
  const [modalStatusReason, setModalStatusReason] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');

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

  const handleChangeStatus = async () => {
    if (!id) return;
    const payload = {
      status: modalStatus,
      statusReason: modalStatusReason,
    };
    if (modalStatus === 'converted') {
      const advance = Number(advanceAmount);
      if (!Number.isFinite(advance) || advance < 0) {
        return;
      }
      payload.advanceAmount = advance;
      payload.paymentMethod = paymentMethod;
      payload.sendReceipt = true;
    }
    await API.put(`/sales-executive/leads/${id}`, payload);
    setStatusModalOpen(false);
    setModalStatusReason('');
    setAdvanceAmount('');
    await loadLead();
  };
  const reasonRequired = ['lost', 'booked_from_another_company'].includes(modalStatus);
  const convertAdvanceInvalid =
    modalStatus === 'converted' && (!advanceAmount || Number(advanceAmount) < 0 || Number.isNaN(Number(advanceAmount)));

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pb-8">
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
        onChangeStatus={!isLeadStatusLocked(lead.status) ? () => {
          setModalStatus(lead.status || 'new');
          setModalStatusReason(lead.statusReason || '');
          setStatusModalOpen(true);
        } : undefined}
        canChangeStatus={!isLeadStatusLocked(lead.status)}
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

      <ActionModal open={statusModalOpen} title="Change Status" onClose={() => setStatusModalOpen(false)}>
        <select
          value={modalStatus}
          onChange={(e) => setModalStatus(e.target.value)}
          className="w-full rounded-xl border border-subtle bg-white p-3 text-sm mb-4"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {modalStatus === 'converted' && (
          <div className="mb-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
            <p className="text-xs font-semibold text-emerald-800">
              Enter advance / token received. Customer will get a payment voucher by email.
            </p>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Advance / Token (₹)</label>
              <input
                type="number"
                min={0}
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="e.g. 15000"
                className="mt-1 w-full rounded-xl border border-subtle bg-white p-3 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Payment mode</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 w-full rounded-xl border border-subtle bg-white p-3 text-sm"
              >
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
        )}
        <textarea
          value={modalStatusReason}
          onChange={(e) => setModalStatusReason(e.target.value)}
          rows={3}
          placeholder="Reason for status change"
          className="w-full rounded-xl border border-subtle bg-white p-3 text-sm mb-4"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setStatusModalOpen(false); setModalStatusReason(''); setAdvanceAmount(''); }}>Cancel</Button>
          <Button
            onClick={handleChangeStatus}
            disabled={(reasonRequired && !modalStatusReason.trim()) || convertAdvanceInvalid}
          >
            {modalStatus === 'converted' ? 'Convert & Send Voucher' : 'Update'}
          </Button>
        </div>
      </ActionModal>
    </motion.div>
  );
}
