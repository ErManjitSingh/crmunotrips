import { memo, useState } from 'react';
import { FileText, File, Download, Play, ImageOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MESSAGE_STATUS_ICON } from './constants';
import { formatMessageTime, resolveWhatsAppMediaUrl } from './whatsappUtils';

function isImageType(type, attachment) {
  if (type === 'image') return true;
  const mime = String(attachment?.mimeType || attachment?.mime_type || '').toLowerCase();
  return mime.startsWith('image/');
}

function isVideoType(type, attachment) {
  if (type === 'video') return true;
  const mime = String(attachment?.mimeType || attachment?.mime_type || '').toLowerCase();
  return mime.startsWith('video/');
}

function isAudioType(type, attachment) {
  if (type === 'audio') return true;
  const mime = String(attachment?.mimeType || attachment?.mime_type || '').toLowerCase();
  return mime.startsWith('audio/');
}

function AttachmentPreview({ type, text, attachment }) {
  const [broken, setBroken] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const url = resolveWhatsAppMediaUrl(attachment?.url);
  const caption = (attachment?.caption || text || '').replace(/^\[(Image|Document|Audio|Video|Sticker)\]$/i, '');
  const fileName = attachment?.name || attachment?.filename || 'File';
  const fileSize = attachment?.size || '';

  if (isImageType(type, attachment)) {
    if (!url || broken) {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2.5 min-w-[180px] mb-1">
          <ImageOff className="w-4 h-4 opacity-50" />
          <span className="text-xs opacity-70">Photo unavailable</span>
        </div>
      );
    }
    return (
      <>
        <button
          type="button"
          onClick={() => setLightbox(true)}
          className="block rounded-lg overflow-hidden mb-1 max-w-[280px] focus:outline-none"
        >
          <img
            src={url}
            alt={caption || 'Photo'}
            className="w-full max-h-[320px] object-cover bg-slate-100"
            loading="lazy"
            onError={() => setBroken(true)}
          />
        </button>
        {caption && !/^📷|^Photo$/i.test(caption) && (
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words mb-0.5">{caption}</p>
        )}
        {lightbox && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setLightbox(false)}
            role="presentation"
          >
            <img
              src={url}
              alt={caption || 'Photo'}
              className="max-w-full max-h-full rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </>
    );
  }

  if (isVideoType(type, attachment) && url) {
    return (
      <div className="mb-1 max-w-[280px]">
        <video
          src={url}
          controls
          className="w-full rounded-lg bg-black max-h-[320px]"
          preload="metadata"
        />
        {caption && (
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words mt-1">{caption}</p>
        )}
      </div>
    );
  }

  if (isAudioType(type, attachment) && url) {
    return (
      <div className="mb-1 min-w-[220px] max-w-[280px]">
        <div className="flex items-center gap-2 mb-1.5 text-xs opacity-70">
          <Play className="w-3.5 h-3.5" />
          Audio
        </div>
        <audio src={url} controls className="w-full h-9" preload="metadata" />
      </div>
    );
  }

  const isPdf =
    type === 'pdf' ||
    /\.pdf$/i.test(fileName) ||
    String(attachment?.mimeType || attachment?.mime_type || '').includes('pdf');
  const Icon = isPdf ? FileText : File;

  return (
    <a
      href={url || undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-3 p-2.5 rounded-lg bg-black/5 mb-1 min-w-[200px] max-w-[280px]',
        url ? 'hover:bg-black/10' : 'pointer-events-none opacity-70'
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
          isPdf ? 'bg-red-500/15 text-red-500' : 'bg-blue-500/15 text-blue-500'
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileName}</p>
        <p className="text-[10px] opacity-60">{fileSize || (isPdf ? 'PDF' : 'Document')}</p>
      </div>
      {url && <Download className="w-4 h-4 opacity-50 shrink-0" />}
    </a>
  );
}

function WhatsAppMessageBubble({ message }) {
  const isOutgoing = message.direction === 'outgoing';
  const hasMedia = Boolean(message.attachment) && message.type && message.type !== 'text';

  return (
    <div className={cn('flex', isOutgoing ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'relative max-w-[75%] sm:max-w-[65%] px-3 py-2 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
          isOutgoing
            ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-md'
            : 'bg-white text-slate-900 rounded-tl-md border border-white/80'
        )}
      >
        {hasMedia ? (
          <AttachmentPreview type={message.type} text={message.text} attachment={message.attachment} />
        ) : (
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
        )}

        <div
          className={cn(
            'flex items-center gap-1 justify-end mt-1',
            isOutgoing ? 'text-emerald-700/50' : 'text-slate-400'
          )}
        >
          <span className="text-[10px]">{formatMessageTime(message.timestamp)}</span>
          {isOutgoing && (
            <span className={cn('text-[11px] leading-none', message.status === 'read' ? 'text-sky-500' : '')}>
              {MESSAGE_STATUS_ICON[message.status] || '✓'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(WhatsAppMessageBubble);
