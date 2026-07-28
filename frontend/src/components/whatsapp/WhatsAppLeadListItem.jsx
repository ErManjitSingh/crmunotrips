import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import LeadStatusBadge from '../leads/LeadStatusBadge';
import { formatMessageTime, formatWhatsAppPhone, resolveWhatsAppDisplayName } from './whatsappUtils';

export default function WhatsAppLeadListItem({ conversation, active, onClick }) {
  const lead = conversation.lead;
  const name = resolveWhatsAppDisplayName(
    { profileName: conversation.profileName, phone: conversation.phone, waId: conversation.waId },
    lead
  );
  const phoneLabel = formatWhatsAppPhone(conversation.waId || conversation.phone);
  const lastMessage = conversation.lastMessage;
  const unreadCount = conversation.unreadCount || 0;
  const preview =
    lastMessage?.direction === 'outgoing' ? `You: ${lastMessage.text}` : lastMessage?.text;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 text-left transition-colors border-b border-wa-divider/50',
        active ? 'bg-wa-list-active' : 'hover:bg-wa-list-hover'
      )}
    >
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
          {name?.charAt(0)?.toUpperCase() || 'W'}
        </div>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span
            className={cn(
              'font-semibold truncate text-sm',
              unreadCount > 0 ? 'text-wa-text-primary' : 'text-wa-text-primary/90'
            )}
          >
            {name}
          </span>
          <span
            className={cn(
              'text-[11px] shrink-0',
              unreadCount > 0 ? 'text-emerald-500 font-medium' : 'text-wa-text-muted'
            )}
          >
            {formatMessageTime(lastMessage?.timestamp || conversation.updatedAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              'text-xs truncate',
              unreadCount > 0 ? 'text-wa-text-primary font-medium' : 'text-wa-text-secondary'
            )}
          >
            {preview || 'No messages yet'}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-wa-text-muted tabular-nums shrink-0">{phoneLabel}</span>
          {lead ? (
            <>
              <LeadStatusBadge status={lead.status} size="sm" />
              <span className="text-[10px] text-wa-text-muted truncate">{lead.destination}</span>
            </>
          ) : (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
              New chat · Create lead
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}
