import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { canManageFollowUps } from '../lib/followupPermissions';
import { usePermissions } from '../hooks/usePermissions';
import AdminAssignLeadModal from '../components/leads/AdminAssignLeadModal';
import { assignAllowedRoles, canAssignLeads } from '../lib/canAssignLeads';
import { Button } from '../components/ui/button';
import { useLeadAssign } from '../hooks/useLeadAssign';
import { useDataRefresh } from '../hooks/useDataRefresh';
import {
  LeadDetailLayout,
  LeadTransferHistory,
  LeadAuditPanel,
  ReactivationActionsModal,
} from '../components/lead-detail';
import { useLeadQuery } from '../features/leads/hooks/useLeadDetailQuery';
import { useLeadActivities } from '../features/leads/hooks/useLeadActivities';
import { invalidateLeadDetail } from '../lib/queryInvalidation';
import CallNoteModal from '../components/leads/CallNoteModal';
import MergeLeadModal from '../components/leads/MergeLeadModal';
import { checkLeadDuplicate } from '../services/leadEnterpriseApi';
import LeadEmailHistory from '../components/email/LeadEmailHistory';
import AddFollowUpModal from '../components/followups/AddFollowUpModal';
import { createExecutiveFollowUp, buildFollowUpPayload } from '../components/followups/followupApi';
import MobileLeadDetailSummary from '../components/lead-detail/MobileLeadDetailSummary';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { can } = usePermissions();
  const isAdmin = user?.role === 'admin';
  const userCanAssignLeads = canAssignLeads(user?.role);
  const canCreateFollowUp = canManageFollowUps(user);
  const canEditLead = can('leads', 'edit');

  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [reactivationMode, setReactivationMode] = useState('');
  const [reactivationExecs, setReactivationExecs] = useState([]);
  const [callNoteOpen, setCallNoteOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [hasDuplicates, setHasDuplicates] = useState(false);
  const leadQuery = useLeadQuery(id);

  const refreshLead = () => invalidateLeadDetail(queryClient, id);

  useEffect(() => {
    if (!['admin', 'sales_manager', 'team_leader'].includes(user?.role)) return;
    API.get('/leads/assignees', { skipSuccessToast: true, skipErrorToast: true })
      .then((res) => setReactivationExecs(res.data?.salesExecutives || []))
      .catch(() => setReactivationExecs([]));
  }, [user?.role]);

  useDataRefresh([`lead:${id}`, 'leads'], refreshLead);

  useEffect(() => {
    const currentLead = leadQuery.data;
    if (!currentLead || !['admin', 'sales_manager'].includes(user?.role)) {
      setHasDuplicates(false);
      return;
    }
    checkLeadDuplicate({
      phone: currentLead.phone,
      alternatePhone: currentLead.alternatePhone,
      excludeId: currentLead._id,
    })
      .then((res) => setHasDuplicates((res.matches || []).length > 0))
      .catch(() => setHasDuplicates(false));
  }, [leadQuery.data, user?.role]);

  const {
    assignees,
    assigneesLoading,
    assignModal,
    openAssign,
    closeAssign,
    handleAssign,
    assignConfirmDialog,
  } = useLeadAssign({
    onAssigned: refreshLead,
  });

  const lead = leadQuery.data;
  const loading = leadQuery.isLoading && !lead;
  const showFullProfile = searchParams.get('view') === 'full';
  const { activities, timelineLoading } = useLeadActivities(lead, id);

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
        <p className="text-content-muted">Lead not found</p>
        <Link to="/leads" className="text-violet-600 text-sm mt-2 inline-block hover:underline">
          ← Back to leads
        </Link>
      </div>
    );
  }

  const handleReactivationAction = async (payload) => {
    if (!reactivationMode) return;
    const endpoint =
      reactivationMode === 'reactivate'
        ? `/leads/${id}/reactivate`
        : reactivationMode === 'reassign'
          ? `/leads/${id}/reassign-reactivated`
          : `/leads/${id}/reactivation-stage`;
    const method = reactivationMode === 'stage' ? 'patch' : 'post';
    await API[method](endpoint, payload);
    setReactivationMode('');
    await refreshLead();
  };

  const reactivationBlock = ['admin', 'sales_manager', 'team_leader'].includes(user?.role) ? (
    <div className="mb-4 space-y-2">
      {['lost', 'booked_from_another_company'].includes(lead.status) && (
        <Button type="button" variant="teal" className="w-full rounded-xl" onClick={() => setReactivationMode('reactivate')}>
          Reactivate Lead
        </Button>
      )}
      {lead.status === 'reactivated' && (
        <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => setReactivationMode('reassign')}>
          Reassign Reactivated Lead
        </Button>
      )}
      {lead?.reactivation?.isReactivated && (
        <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => setReactivationMode('stage')}>
          Update Reactivation Stage
        </Button>
      )}
      {hasDuplicates && (isAdmin || user?.role === 'sales_manager') && (
        <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => setMergeOpen(true)}>
          Merge Duplicate Lead
        </Button>
      )}
    </div>
  ) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pb-8">
      {!showFullProfile && (
        <MobileLeadDetailSummary
          lead={lead}
          editHref={canEditLead ? `/leads/${id}/edit` : undefined}
        />
      )}

      <div className={showFullProfile ? 'block px-4 pt-4 lg:px-0 lg:pt-0' : 'hidden lg:block'}>
        <LeadDetailLayout
        lead={lead}
        leadId={id}
        activities={activities}
        timelineLoading={timelineLoading}
        backHref="/leads"
        backLabel="Back to Leads"
        contactEndpoint="/leads"
        onCreateQuote={
          can('quotations', 'create')
            ? () => navigate(`/quotations/new?leadId=${id}`)
            : undefined
        }
        onScheduleFollowUp={canCreateFollowUp ? () => setFollowUpModalOpen(true) : undefined}
        onContactLogged={refreshLead}
        onEmailSent={refreshLead}
        onLogCallNote={() => setCallNoteOpen(true)}
        onAssign={userCanAssignLeads ? () => openAssign(lead) : undefined}
        canCreateFollowUp={canCreateFollowUp}
        canEditLead={canEditLead}
        editHref={canEditLead ? `/leads/${id}/edit` : undefined}
        sidebarExtra={reactivationBlock}
        bottomExtra={(
          <div className="mt-5 space-y-5">
            <LeadEmailHistory leadId={id} emailEndpoint="/leads" refreshKey={lead?.lastContactedAt || lead?.updatedAt} />
            <LeadTransferHistory leadId={id} />
            <LeadAuditPanel leadId={id} canView={isAdmin || user?.role === 'sales_manager'} />
          </div>
        )}
        />
      </div>

      {userCanAssignLeads && (
        <AdminAssignLeadModal
          open={!!assignModal}
          lead={assignModal}
          assignees={assignees}
          loading={assigneesLoading}
          onClose={closeAssign}
          onAssign={handleAssign}
          allowedRoles={assignAllowedRoles(user?.role)}
        />
      )}
      {assignConfirmDialog}

      {canCreateFollowUp && (
        <AddFollowUpModal
          open={followUpModalOpen}
          onClose={() => setFollowUpModalOpen(false)}
          fixedLeadId={lead._id}
          fixedLeadName={lead.name}
          onSubmit={async (data) => {
            await createExecutiveFollowUp(buildFollowUpPayload({ ...data, lead: lead._id }));
            setFollowUpModalOpen(false);
            refreshLead();
          }}
        />
      )}

      <CallNoteModal
        open={callNoteOpen}
        onClose={() => setCallNoteOpen(false)}
        leadId={id}
        onSaved={refreshLead}
      />

      <MergeLeadModal
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        targetLead={lead}
        onMerged={refreshLead}
      />

      <ReactivationActionsModal
        open={!!reactivationMode}
        mode={reactivationMode || 'reactivate'}
        lead={lead}
        executives={reactivationExecs}
        onClose={() => setReactivationMode('')}
        onSubmit={handleReactivationAction}
      />
    </motion.div>
  );
}
