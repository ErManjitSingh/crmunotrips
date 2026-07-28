import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from '../../context/ToastContext';
import API from '../../api/axios';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import WhatsAppInboxLayout from './WhatsAppInboxLayout';
import WhatsAppLeadList from './WhatsAppLeadList';
import WhatsAppConversation from './WhatsAppConversation';
import WhatsAppLeadInfoPanel from './WhatsAppLeadInfoPanel';
import AddNoteModal from './modals/AddNoteModal';
import ChangeStatusModal from './modals/ChangeStatusModal';
import AssignLeadModal from './modals/AssignLeadModal';
import CreateFollowUpModal from './modals/CreateFollowUpModal';
import { createExecutiveFollowUp, buildFollowUpPayload } from '../followups/followupApi';

export default function WhatsAppLeadsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mobileView, setMobileView] = useState('list');
  const [modals, setModals] = useState({ note: false, status: false, assign: false, followup: false });
  const [creatingLead, setCreatingLead] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

  const conversationsQuery = useQuery({
    queryKey: ['whatsapp', 'conversations', { statusFilter, search: debouncedSearch }],
    queryFn: async () => {
      const params = { page: 1, limit: 50 };
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await API.get('/whatsapp/conversations', { params, skipSuccessToast: true });
      return res.data?.data || [];
    },
    staleTime: 15_000,
    refetchInterval: 20_000,
    placeholderData: (prev) => prev,
  });

  const executivesQuery = useQuery({
    queryKey: ['whatsapp', 'executives'],
    queryFn: async () => {
      const res = await API.get('/whatsapp/executives', { skipSuccessToast: true });
      return res.data || [];
    },
    enabled: modals.assign,
    staleTime: 5 * 60_000,
  });

  const detailsKey = selected?.conversationId || selected?.leadId || null;

  const detailsQuery = useQuery({
    queryKey: ['whatsapp', 'details', detailsKey],
    queryFn: async () => {
      const conversationId = selected.conversationId;
      const leadId = selected.leadId;

      const messagePromise = conversationId
        ? API.get(`/whatsapp/messages/conversation/${conversationId}`, { skipSuccessToast: true })
        : leadId
          ? API.get(`/whatsapp/messages/${leadId}`, { skipSuccessToast: true })
          : Promise.resolve({ data: [] });

      const notePromise = leadId
        ? API.get(`/whatsapp/notes/${leadId}`, { skipSuccessToast: true })
        : Promise.resolve({ data: [] });
      const fuPromise = leadId
        ? API.get(`/whatsapp/followups/${leadId}`, { skipSuccessToast: true })
        : Promise.resolve({ data: [] });

      const [msgRes, noteRes, fuRes] = await Promise.all([
        messagePromise,
        notePromise,
        fuPromise,
      ]);

      return {
        messages: msgRes.data || [],
        notes: noteRes.data || [],
        followups: fuRes.data || [],
      };
    },
    enabled: !!detailsKey,
    staleTime: 10_000,
  });

  const conversations = conversationsQuery.data ?? [];
  const messages = detailsQuery.data?.messages ?? [];
  const notes = detailsQuery.data?.notes ?? [];
  const followups = detailsQuery.data?.followups ?? [];
  const executives = executivesQuery.data ?? [];
  const loading = conversationsQuery.isLoading && !conversationsQuery.data;
  const messagesLoading = detailsQuery.isLoading && !!detailsKey;

  const refreshConversations = () => {
    queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
  };

  useDataRefresh(['whatsapp', 'leads'], () => {
    refreshConversations();
    if (detailsKey) {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'details', detailsKey] });
    }
  });

  const handleSelect = (conv) => {
    setSelected(conv);
    setMobileView('chat');
    if (conv.unreadCount > 0 || conv.unread) {
      API.put(`/whatsapp/read/${conv.leadId || 'none'}`, {}, {
        params: conv.conversationId ? { conversationId: conv.conversationId } : undefined,
        skipSuccessToast: true,
      }).then(refreshConversations).catch(() => {});
    }
  };

  const handleSend = async (payload) => {
    if (!selected) return;
    await API.post('/whatsapp/messages', {
      leadId: selected.leadId || undefined,
      conversationId: selected.conversationId || undefined,
      ...payload,
    });
    queryClient.invalidateQueries({ queryKey: ['whatsapp', 'details', detailsKey] });
    refreshConversations();
  };

  const handleCreateLead = async () => {
    if (!selected?.conversationId) {
      toast.error('Conversation not linked yet');
      return;
    }
    setCreatingLead(true);
    try {
      const res = await API.post(
        '/whatsapp/create-lead',
        {
          conversationId: selected.conversationId,
          name: selected.profileName || undefined,
          destination: 'Not specified',
        },
        { skipSuccessToast: true }
      );
      const lead = res.data?.data;
      toast.success(res.data?.duplicate ? 'Lead already linked' : 'Lead created from WhatsApp');
      refreshConversations();
      if (lead?.id || lead?._id) {
        const leadId = lead.id || lead._id;
        setSelected((prev) => ({
          ...prev,
          leadId,
          hasLead: true,
          lead: {
            _id: leadId,
            leadId: lead.leadId,
            name: lead.name,
            phone: lead.phone,
            destination: lead.destination,
            source: lead.source,
            sourceLabel: lead.sourceLabel,
            status: lead.status || 'new',
          },
        }));
        queryClient.invalidateQueries({ queryKey: ['whatsapp', 'details'] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not create lead');
    } finally {
      setCreatingLead(false);
    }
  };

  const handleUpdateLead = async (updates) => {
    if (!selected?.leadId) return;
    const res = await API.put(`/whatsapp/leads/${selected.leadId}`, updates);
    setSelected((prev) => ({ ...prev, lead: res.data }));
    refreshConversations();
  };

  const handleAddNote = async (text) => {
    if (!selected?.leadId) return;
    await API.post('/whatsapp/notes', { leadId: selected.leadId, text });
    queryClient.invalidateQueries({ queryKey: ['whatsapp', 'details', detailsKey] });
  };

  const handleCreateFollowUp = async (data) => {
    if (!selected?.leadId) throw new Error('No lead selected');
    await createExecutiveFollowUp(
      buildFollowUpPayload({
        ...data,
        lead: selected.leadId,
        remarks: data.notes,
        category: data.category || 'warm',
      })
    );
    queryClient.invalidateQueries({ queryKey: ['whatsapp', 'details', detailsKey] });
    await handleUpdateLead({ nextFollowUp: data.scheduledAt });
  };

  const handleAction = (key) => {
    if (!selected?.lead) return;
    const lead = selected.lead;
    switch (key) {
      case 'call':
        window.open(`tel:${lead.phone}`, '_self');
        break;
      case 'followup':
        setModals((m) => ({ ...m, followup: true }));
        break;
      case 'note':
        setModals((m) => ({ ...m, note: true }));
        break;
      case 'quotation':
        navigate(`/quotations/new?leadId=${lead._id}`);
        break;
      case 'status':
        setModals((m) => ({ ...m, status: true }));
        break;
      case 'assign':
        setModals((m) => ({ ...m, assign: true }));
        break;
      default:
        break;
    }
  };

  const selectedKey = selected?.conversationId || selected?.leadId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-2 mb-0"
    >
      <WhatsAppInboxLayout
        mobileView={mobileView}
        className="h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-6rem)]"
        listPanel={
          <WhatsAppLeadList
            conversations={conversations}
            selectedId={selectedKey}
            onSelect={handleSelect}
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            loading={loading}
          />
        }
        chatPanel={
          <WhatsAppConversation
            lead={selected?.lead}
            contact={
              selected
                ? {
                    phone: selected.phone,
                    waId: selected.waId,
                    profileName: selected.profileName,
                  }
                : null
            }
            messages={messages}
            loading={messagesLoading}
            onSend={handleSend}
            onBack={() => {
              setMobileView('list');
              setSelected(null);
            }}
            onToggleInfo={() => setMobileView('info')}
            showInfoToggle={Boolean(selected?.lead)}
            onCreateLead={!selected?.lead && selected?.conversationId ? handleCreateLead : undefined}
            creatingLead={creatingLead}
          />
        }
        infoPanel={
          <WhatsAppLeadInfoPanel
            lead={selected?.lead}
            notes={notes}
            followups={followups}
            onClose={() => setMobileView('chat')}
            onAction={handleAction}
            onCreateLead={!selected?.lead && selected?.conversationId ? handleCreateLead : undefined}
            creatingLead={creatingLead}
            contact={
              selected
                ? {
                    phone: selected.phone,
                    waId: selected.waId,
                    profileName: selected.profileName,
                  }
                : null
            }
          />
        }
      />

      <AddNoteModal
        open={modals.note}
        onClose={() => setModals((m) => ({ ...m, note: false }))}
        onSubmit={handleAddNote}
        leadName={selected?.lead?.name}
      />
      <ChangeStatusModal
        open={modals.status}
        onClose={() => setModals((m) => ({ ...m, status: false }))}
        currentStatus={selected?.lead?.status}
        onSubmit={(status) => handleUpdateLead({ status })}
      />
      <AssignLeadModal
        open={modals.assign}
        onClose={() => setModals((m) => ({ ...m, assign: false }))}
        executives={executives}
        currentAssignee={selected?.lead?.assignedTo}
        onSubmit={(assignedTo) => handleUpdateLead({ assignedTo })}
      />
      <CreateFollowUpModal
        open={modals.followup}
        onClose={() => setModals((m) => ({ ...m, followup: false }))}
        onSubmit={handleCreateFollowUp}
        leadName={selected?.lead?.name}
      />
    </motion.div>
  );
}
