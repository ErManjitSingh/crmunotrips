import { memo, useEffect, useMemo, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import WhatsAppConversationHeader from './WhatsAppConversationHeader';
import WhatsAppMessageBubble from './WhatsAppMessageBubble';
import WhatsAppMessageInput from './WhatsAppMessageInput';
import { groupMessagesByDate, formatDateDivider, resolveWhatsAppDisplayName } from './whatsappUtils';

function WhatsAppConversation({
  lead,
  contact,
  messages,
  loading,
  onSend,
  onBack,
  onToggleInfo,
  showInfoToggle,
  infoPanelOpen,
  onToggleInfoPanel,
  onCreateLead,
  creatingLead,
  user,
}) {
  const bottomRef = useRef(null);
  const groups = useMemo(() => groupMessagesByDate(messages), [messages]);
  const hasThread = Boolean(lead || contact);
  const lastId = messages.length ? messages[messages.length - 1]?._id : null;

  const templateLead = useMemo(() => {
    if (lead) return lead;
    const name = resolveWhatsAppDisplayName(contact || {}, null);
    const looksLikePhone = /^\+?\d/.test(String(name || ''));
    return {
      name: name && !looksLikePhone && name !== 'WhatsApp' ? name : 'Customer',
      destination: contact?.botAnswers?.destination || '',
    };
  }, [lead, contact]);

  useEffect(() => {
    if (!lastId) return;
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [lastId]);

  if (!hasThread) {
    return (
      <div className="flex flex-col items-center justify-center h-full wa-chat-pattern text-center p-8">
        <div className="max-w-sm">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-white border border-dashed border-violet-200 flex items-center justify-center shadow-sm">
            <MessageCircle className="w-10 h-10 text-violet-500/70" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">WhatsApp Inbox</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            Select a chat from the left to view messages and lead details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#e5ddd5]">
      <WhatsAppConversationHeader
        lead={lead}
        contact={contact}
        onBack={onBack}
        onToggleInfo={onToggleInfo}
        showInfoToggle={showInfoToggle}
        infoPanelOpen={infoPanelOpen}
        onToggleInfoPanel={onToggleInfoPanel}
        onCreateLead={onCreateLead}
        creatingLead={creatingLead}
      />

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-8 py-4 space-y-2 wa-chat-pattern">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
          </div>
        ) : (
          groups.map((item) =>
            item.type === 'divider' ? (
              <div key={item.key} className="flex justify-center my-3">
                <span className="px-3 py-1 rounded-full bg-white/90 border border-slate-200/70 text-[11px] font-medium text-slate-500 shadow-sm">
                  {formatDateDivider(item.date)}
                </span>
              </div>
            ) : (
              <WhatsAppMessageBubble key={item.key} message={item.data} />
            )
          )
        )}
        <div ref={bottomRef} />
      </div>

      <WhatsAppMessageInput onSend={onSend} lead={templateLead} user={user} />
    </div>
  );
}

export default memo(WhatsAppConversation);
