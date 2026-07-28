import { memo } from 'react';
import { FileText, File, Download } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MESSAGE_STATUS_ICON } from './constants';
import { formatMessageTime } from './whatsappUtils';

function AttachmentPreview({ type, text, attachment }) {
  if (type === 'image' && attachment?.url) {
    return (
      <div className="rounded-lg overflow-hidden mb-1 max-w-[280px]">
        <img src={attachment.url} alt={text || 'Image'} className="w-full h-auto object-cover" loading="lazy" />
        {text && <p className="text-xs mt-1 opacity-80">{text}</p>}
      </div>
    );
  }

  const Icon = type === 'pdf' ? FileText : File;
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-black/5 dark:bg-white/5 mb-1 min-w-[200px]">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', type === 'pdf' ? 'bg-red-500/15 text-red-500' : 'bg-blue-500/15 text-blue-500')}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment?.name || text}</p>
        <p className="text-[10px] opacity-60">{attachment?.size || 'Document'}</p>
      </div>
      <Download className="w-4 h-4 opacity-50 shrink-0" />
    </div>
  );
}

function WhatsAppMessageBubble({ message }) {
  const isOutgoing = message.direction === 'outgoing';

  return (
    <div className={cn('flex', isOutgoing ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'relative max-w-[75%] sm:max-w-[65%] px-3 py-1.5 rounded-lg shadow-sm',
          isOutgoing
            ? 'bg-wa-bubble-out text-wa-bubble-out-text rounded-tr-none'
            : 'bg-wa-bubble-in text-wa-bubble-in-text rounded-tl-none'
        )}
      >
        {message.type !== 'text' ? (
          <AttachmentPreview type={message.type} text={message.text} attachment={message.attachment} />
        ) : (
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
        )}

        <div className={cn('flex items-center gap-1 justify-end mt-0.5 -mb-0.5', isOutgoing ? 'text-emerald-100/70' : 'text-wa-text-muted')}>
          <span className="text-[10px]">{formatMessageTime(message.timestamp)}</span>
          {isOutgoing && (
            <span className={cn('text-[11px]', message.status === 'read' ? 'text-sky-300' : '')}>
              {MESSAGE_STATUS_ICON[message.status] || '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(WhatsAppMessageBubble);
