import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
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
import { canAssignLeads } from '../../lib/canAssignLeads';

function contactFromSelected(selected) {
  if (!selected) return null;
  return {
    phone: selected.phone,
    waId: selected.waId,
    profileName: selected.profileName,
    botAnswers: selected.botAnswers,
    botStep: selected.botStep,
  };
}

function WhatsAppLeadsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isExecutive = user?.role === 'sales_executive';
  const canAssign = canAssignLeads(user?.role);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mobileView, setMobileView] = useState('list');
  const [infoPanelOpen, setInfoPanelOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem('wa-info-panel-open');
      if (saved === null) return true;
      return saved === '1';
    } catch {
      return true;
    }
  });
  const [modals, setModals] = useState({ note: false, status: false, assign: false, followup: false });
  const [creatingLead, setCreatingLead] = useState(false);
  const [sending, setSending] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const debouncedSearch = useDebouncedValue(search, 280);
  const deepLinkConversationId = searchParams.get('conversationId') || '';
  const deepLinkLeadId = searchParams.get('leadId') || '';
  const deepLinkHandled = useRef('');

  const conversationsQuery = useQuery({
    queryKey: ['whatsapp', 'conversations', { statusFilter, search: debouncedSearch }],
    queryFn: async () => {
      const params = { page: 1, limit: 100 };
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await API.get('/whatsapp/conversations', { params, skipSuccessToast: true });
      return res.data?.data || [];
    },
    staleTime: 45_000,
    refetchInterval: 45_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const executivesQuery = useQuery({
    queryKey: ['whatsapp', 'executives'],
    queryFn: async () => {
      const res = await API.get('/whatsapp/executives', { skipSuccessToast: true });
      return res.data || [];
    },
    enabled: modals.assign && canAssign,
    staleTime: 10 * 60_000,
  });

  const detailsKey = selected?.conversationId || selected?.leadId || null;

  const threadQuery = useQuery({
    queryKey: ['whatsapp', 'thread', detailsKey],
    queryFn: async () => {
      const params = {};
      if (selected.conversationId) params.conversationId = selected.conversationId;
      if (selected.leadId) params.leadId = selected.leadId;
      const res = await API.get('/whatsapp/thread', { params, skipSuccessToast: true });
      return res.data || { messages: [], notes: [], followups: [] };
    },
    enabled: !!detailsKey,
    staleTime: 20_000,
    refetchInterval: selected ? 30_000 : false,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  });

  const conversations = conversationsQuery.data ?? [];
  const messages = threadQuery.data?.messages ?? [];
  const notes = threadQuery.data?.notes ?? [];
  const followups = threadQuery.data?.followups ?? [];
  const sessionOpen = threadQuery.data?.sessionOpen !== false;
  const executives = executivesQuery.data ?? [];
  const loading = conversationsQuery.isLoading && !conversationsQuery.data;
  const messagesLoading = threadQuery.isLoading && !!detailsKey && !threadQuery.data;

  const activeCount = useMemo(
    () => conversations.filter((c) => (c.unreadCount || 0) > 0 || c.lastDirection === 'incoming').length || conversations.length,
    [conversations]
  );

  const pagedConversations = useMemo(() => {
    const start = (page - 1) * pageSize;
    return conversations.slice(start, start + pageSize);
  }, [conversations, page, pageSize]);

  const handleStatusFilterChange = useCallback((key) => {
    setStatusFilter(key);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  const refreshConversations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['whatsapp', 'conversations'] });
  }, [queryClient]);

  const refreshThread = useCallback(() => {
    if (detailsKey) {
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'thread', detailsKey] });
    }
  }, [queryClient, detailsKey]);

  useDataRefresh(['whatsapp', 'leads'], () => {
    refreshConversations();
    refreshThread();
  });

  const handleSelect = useCallback((conv) => {
    setSelected(conv);
    setMobileView('chat');
    if (conv.unreadCount > 0 || conv.unread) {
      // Optimistic clear — don't wait for network
      setSelected({ ...conv, unreadCount: 0 });
      queryClient.setQueriesData({ queryKey: ['whatsapp', 'conversations'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((c) =>
          (c.conversationId || c._id) === (conv.conversationId || conv._id)
            ? { ...c, unreadCount: 0 }
            : c
        );
      });
      API.put(`/whatsapp/read/${conv.leadId || 'none'}`, {}, {
        params: conv.conversationId ? { conversationId: conv.conversationId } : undefined,
        skipSuccessToast: true,
        skipDataRefresh: true,
      }).catch(() => {});
    }
  }, [queryClient]);

  // Deep-link from lead WhatsApp click → select CRM conversation
  useEffect(() => {
    if (!deepLinkConversationId && !deepLinkLeadId) return;
    const key = `${deepLinkConversationId}|${deepLinkLeadId}`;
    if (deepLinkHandled.current === key) return;

    const fromList = (conversations || []).find((c) => {
      if (deepLinkConversationId) {
        return String(c.conversationId || c._id) === String(deepLinkConversationId);
      }
      return String(c.leadId || c.lead?._id || '') === String(deepLinkLeadId);
    });

    if (fromList) {
      deepLinkHandled.current = key;
      handleSelect(fromList);
      setSearchParams({}, { replace: true });
      return;
    }

    // Wait until list attempt finished loading before creating/opening
    if (conversationsQuery.isLoading) return;
    if (!deepLinkLeadId) {
      deepLinkHandled.current = key;
      setSearchParams({}, { replace: true });
      return;
    }

    let cancelled = false;
    deepLinkHandled.current = key;
    (async () => {
      try {
        const res = await API.post(
          '/whatsapp/open-chat',
          { leadId: deepLinkLeadId },
          { skipSuccessToast: true }
        );
        const row = res.data?.data;
        if (!cancelled && row) {
          handleSelect(row);
          refreshConversations();
        }
      } catch {
        if (!cancelled) toast.error('Could not open WhatsApp chat');
      } finally {
        if (!cancelled) setSearchParams({}, { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    deepLinkConversationId,
    deepLinkLeadId,
    conversations,
    conversationsQuery.isLoading,
    handleSelect,
    setSearchParams,
    refreshConversations,
  ]);

  const handleSend = useCallback(async (payload) => {
    if (!selected || sending) return;
    const text = payload?.text?.trim();
    const hasMedia = Boolean(payload?.mediaBase64 || payload?.attachment?.dataUrl);
    if (!text && !hasMedia && !payload?.attachment) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticType = payload.type || (hasMedia ? 'image' : 'text');
    const optimistic = {
      _id: tempId,
      direction: 'outgoing',
      type: optimisticType,
      text: text || (optimisticType === 'image' ? '📷 Photo' : 'File'),
      attachment: payload.mediaBase64
        ? {
            url: payload.mediaBase64,
            name: payload.mediaFileName,
            mimeType: payload.mediaMimeType,
            previewUrl: payload.attachment?.previewUrl,
          }
        : payload.attachment || null,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };

    queryClient.setQueryData(['whatsapp', 'thread', detailsKey], (old) => ({
      messages: [...(old?.messages || []), optimistic],
      notes: old?.notes || [],
      followups: old?.followups || [],
      botAnswers: old?.botAnswers,
      botStep: old?.botStep,
    }));

    setSending(true);
    try {
      const res = await API.post(
        '/whatsapp/messages',
        {
          leadId: selected.leadId || undefined,
          conversationId: selected.conversationId || undefined,
          text: text || '',
          type: payload.type || 'text',
          mediaBase64: payload.mediaBase64 || undefined,
          mediaMimeType: payload.mediaMimeType || undefined,
          mediaFileName: payload.mediaFileName || undefined,
          attachment: payload.attachment || undefined,
        },
        { skipDataRefresh: true }
      );
      queryClient.setQueryData(['whatsapp', 'thread', detailsKey], (old) => ({
        ...(old || {}),
        messages: (old?.messages || []).map((m) => (m._id === tempId ? res.data : m)),
      }));
      const preview =
        res.data?.text ||
        text ||
        (optimisticType === 'image' ? '📷 Photo' : 'File');
      queryClient.setQueriesData({ queryKey: ['whatsapp', 'conversations'] }, (old) => {
        if (!Array.isArray(old)) return old;
        const key = selected.conversationId || selected._id;
        const updated = old.map((c) =>
          (c.conversationId || c._id) === key
            ? {
                ...c,
                lastMessage: {
                  text: preview,
                  direction: 'outgoing',
                  timestamp: new Date().toISOString(),
                },
                updatedAt: new Date().toISOString(),
              }
            : c
        );
        updated.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
        return updated;
      });
    } catch (err) {
      queryClient.setQueryData(['whatsapp', 'thread', detailsKey], (old) => ({
        ...(old || {}),
        messages: (old?.messages || []).filter((m) => m._id !== tempId),
      }));
      toast.error(err?.response?.data?.message || 'Send failed');
    } finally {
      setSending(false);
    }
  }, [selected, sending, detailsKey, queryClient]);

  const handleCreateLead = useCallback(async () => {
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
            travelDate: lead.travelDate,
            travelers: lead.travelers,
          },
        }));
        queryClient.invalidateQueries({ queryKey: ['whatsapp', 'thread'] });
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not create lead');
    } finally {
      setCreatingLead(false);
    }
  }, [selected, refreshConversations, queryClient]);

  const handleUpdateLead = useCallback(async (updates) => {
    if (!selected?.leadId) return;
    const res = await API.put(`/whatsapp/leads/${selected.leadId}`, updates);
    setSelected((prev) => ({ ...prev, lead: res.data }));
    refreshConversations();
  }, [selected?.leadId, refreshConversations]);

  const handleAddNote = useCallback(async (text) => {
    if (!selected?.leadId) return;
    await API.post('/whatsapp/notes', { leadId: selected.leadId, text });
    refreshThread();
  }, [selected?.leadId, refreshThread]);

  const handleCreateFollowUp = useCallback(async (data) => {
    if (!selected?.leadId) throw new Error('No lead selected');
    await createExecutiveFollowUp(
      buildFollowUpPayload({
        ...data,
        lead: selected.leadId,
        remarks: data.notes,
        category: data.category || 'warm',
      })
    );
    refreshThread();
    await handleUpdateLead({ nextFollowUp: data.scheduledAt });
  }, [selected?.leadId, refreshThread, handleUpdateLead]);

  const handleAction = useCallback((key) => {
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
        navigate(
          isExecutive
            ? `/sales-executive/quotations/new?leadId=${lead._id}`
            : `/quotations/new?leadId=${lead._id}`
        );
        break;
      case 'status':
        setModals((m) => ({ ...m, status: true }));
        break;
      case 'assign':
        if (!canAssign) break;
        setModals((m) => ({ ...m, assign: true }));
        break;
      default:
        break;
    }
  }, [selected?.lead, isExecutive, canAssign, navigate]);

  const toggleInfoPanel = useCallback(() => {
    setInfoPanelOpen((open) => {
      const next = !open;
      try {
        sessionStorage.setItem('wa-info-panel-open', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const selectedKey = selected?.conversationId || selected?.leadId;
  const contact = useMemo(() => contactFromSelected(selected), [selected]);
  const canCreateLead = !isExecutive && !selected?.lead && selected?.conversationId;

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-2 mb-0">
      <WhatsAppInboxLayout
        mobileView={mobileView}
        infoPanelOpen={infoPanelOpen}
        className="h-[calc(100dvh-5.5rem)] lg:h-[calc(100dvh-6rem)]"
        listPanel={
          <WhatsAppLeadList
            conversations={pagedConversations}
            selectedId={selectedKey}
            onSelect={handleSelect}
            search={search}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            loading={loading}
            activeCount={activeCount}
            page={page}
            pageSize={pageSize}
            total={conversations.length}
            onPageChange={setPage}
          />
        }
        chatPanel={
          <WhatsAppConversation
            lead={selected?.lead}
            contact={contact}
            messages={messages}
            loading={messagesLoading}
            onSend={handleSend}
            sessionOpen={sessionOpen}
            user={user}
            onBack={() => {
              setMobileView('list');
              setSelected(null);
            }}
            onToggleInfo={() => setMobileView('info')}
            showInfoToggle={Boolean(selected?.lead || selected?.botAnswers)}
            infoPanelOpen={infoPanelOpen}
            onToggleInfoPanel={toggleInfoPanel}
            onCreateLead={canCreateLead ? handleCreateLead : undefined}
            creatingLead={creatingLead}
          />
        }
        infoPanel={
          <WhatsAppLeadInfoPanel
            lead={selected?.lead}
            notes={notes}
            followups={followups}
            onClose={() => setMobileView('chat')}
            onHidePanel={toggleInfoPanel}
            onAction={handleAction}
            onCreateLead={canCreateLead ? handleCreateLead : undefined}
            creatingLead={creatingLead}
            canAssign={canAssign}
            contact={contact}
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
    </div>
  );
}

export default memo(WhatsAppLeadsPage);
