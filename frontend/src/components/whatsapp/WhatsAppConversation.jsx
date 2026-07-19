import { useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import WhatsAppConversationHeader from './WhatsAppConversationHeader';
import WhatsAppMessageBubble from './WhatsAppMessageBubble';
import WhatsAppMessageInput from './WhatsAppMessageInput';
import { groupMessagesByDate, formatDateDivider } from './whatsappUtils';

export default function WhatsAppConversation({
  lead,
  contact,
  messages,
  loading,
  onSend,
  onBack,
  onToggleInfo,
  showInfoToggle,
  onCreateLead,
  creatingLead,
}) {
  const bottomRef = useRef(null);
  const groups = groupMessagesByDate(messages);
  const hasThread = Boolean(lead || contact);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!hasThread) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-wa-chat-bg text-center p-8">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-sm">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-wa-panel border-2 border-dashed border-wa-border flex items-center justify-center">
            <MessageCircle className="w-12 h-12 text-emerald-500/50" />
          </div>
          <h3 className="text-xl font-semibold text-wa-text-primary mb-2">WhatsApp Inbox</h3>
          <p className="text-sm text-wa-text-secondary leading-relaxed">
            Customer chats yahan dikhenge. Jis chat se lead banana ho, Create Lead dabao — source WhatsApp set ho jayega.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-wa-chat-bg">
      <WhatsAppConversationHeader
        lead={lead}
        contact={contact}
        onBack={onBack}
        onToggleInfo={onToggleInfo}
        showInfoToggle={showInfoToggle}
        onCreateLead={onCreateLead}
        creatingLead={creatingLead}
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 space-y-2 wa-chat-pattern">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : (
          groups.map((item) =>
            item.type === 'divider' ? (
              <div key={item.key} className="flex justify-center my-3">
                <span className="px-3 py-1 rounded-lg bg-wa-panel/80 backdrop-blur text-[11px] font-medium text-wa-text-muted shadow-sm">
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

      <WhatsAppMessageInput onSend={onSend} />
    </div>
  );
}
