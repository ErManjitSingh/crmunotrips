import { memo } from 'react';
import { Phone, UserRound } from 'lucide-react';
import { cn } from '../../lib/utils';
import LeadStatusBadge from '../leads/LeadStatusBadge';
import { formatMessageTime, formatWhatsAppPhone, resolveWhatsAppDisplayName } from './whatsappUtils';

const AVATAR_TONES = [
  'from-violet-500 to-purple-600',
  'from-fuchsia-400 to-pink-500',
  'from-sky-400 to-blue-500',
  'from-rose-400 to-pink-500',
  'from-amber-400 to-orange-500',
  'from-cyan-400 to-teal-500',
];

function toneFor(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * (i + 1)) % AVATAR_TONES.length;
  return AVATAR_TONES[hash];
}

function WhatsAppLeadListItem({ conversation, active, onClick }) {
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
  const initials = (name || 'W')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const assigneeName = lead?.assignedTo?.name?.trim() || '';
  const assigneeLabel = assigneeName || 'Not assigned yet';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-3 py-3 text-left rounded-xl transition-all border',
        active
          ? 'bg-violet-50 border-violet-200 shadow-sm'
          : 'bg-transparent border-transparent hover:bg-slate-50'
      )}
    >
      <div className="relative shrink-0 mt-0.5">
        <div
          className={cn(
            'w-11 h-11 rounded-full bg-gradient-to-br flex items-center justify-center text-white font-semibold text-sm shadow-sm',
            toneFor(name + (conversation.phone || ''))
          )}
        >
          {initials}
        </div>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unreadCount}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn('font-semibold truncate text-[13px] text-slate-900', unreadCount > 0 && 'font-bold')}>
            {name}
          </span>
          <span
            className={cn(
              'text-[11px] shrink-0',
              unreadCount > 0 ? 'text-emerald-600 font-semibold' : 'text-slate-400'
            )}
          >
            {formatMessageTime(lastMessage?.timestamp || conversation.updatedAt)}
          </span>
        </div>

        <p
          className={cn(
            'text-[12px] truncate mt-0.5',
            unreadCount > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'
          )}
        >
          {preview || 'No messages yet'}
        </p>

        <p
          className={cn(
            'mt-1 inline-flex items-center gap-1 max-w-full text-[10px] font-semibold truncate',
            assigneeName ? 'text-violet-600' : 'text-slate-400'
          )}
        >
          <UserRound className="w-3 h-3 shrink-0" />
          <span className="truncate">
            {assigneeName ? `Assigned to ${assigneeName}` : assigneeLabel}
          </span>
        </p>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 tabular-nums">
            <Phone className="w-3 h-3" />
            {phoneLabel}
          </span>
          {lead ? (
            <>
              <LeadStatusBadge status={lead.status} size="sm" />
              {lead.destination && lead.destination !== 'Not specified' && (
                <span className="text-[10px] text-slate-400 truncate">{lead.destination}</span>
              )}
            </>
          ) : (
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-full">
              New chat
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default memo(WhatsAppLeadListItem);
