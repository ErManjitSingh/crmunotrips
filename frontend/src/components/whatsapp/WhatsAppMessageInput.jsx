import { useState, useRef } from 'react';
import { Smile, Paperclip, Send, X, FileText, Image as ImageIcon, Film, Music } from 'lucide-react';
import { cn } from '../../lib/utils';
import { detectWhatsAppMediaType, fileToDataUrl } from './whatsappUtils';

const ATTACH_OPTIONS = [
  { accept: 'image/*', label: 'Photo', icon: ImageIcon, kind: 'image' },
  { accept: 'video/*', label: 'Video', icon: Film, kind: 'video' },
  { accept: 'audio/*', label: 'Audio', icon: Music, kind: 'audio' },
  { accept: '.pdf,.doc,.docx,.xls,.xlsx,application/pdf', label: 'Document', icon: FileText, kind: 'document' },
];

const MAX_BYTES = 12 * 1024 * 1024;

export default function WhatsAppMessageInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const acceptRef = useRef('image/*');

  const clearPending = () => {
    if (pendingFile?.previewUrl) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  };

  const openPicker = (accept) => {
    acceptRef.current = accept;
    setShowAttach(false);
    if (fileRef.current) {
      fileRef.current.accept = accept;
      fileRef.current.value = '';
      fileRef.current.click();
    }
  };

  const onFilePicked = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      window.alert('File too large. Max 12 MB.');
      return;
    }
    const type = detectWhatsAppMediaType(file);
    const previewUrl = type === 'image' || type === 'video' ? URL.createObjectURL(file) : null;
    setPendingFile({ file, type, previewUrl });
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (disabled || uploading) return;
    if (!pendingFile && !trimmed) return;

    if (!pendingFile) {
      onSend({ text: trimmed, type: 'text' });
      setText('');
      inputRef.current?.focus();
      return;
    }

    setUploading(true);
    try {
      const dataUrl = await fileToDataUrl(pendingFile.file);
      await onSend({
        text: trimmed,
        type: pendingFile.type,
        mediaBase64: dataUrl,
        mediaMimeType: pendingFile.file.type || 'application/octet-stream',
        mediaFileName: pendingFile.file.name,
        attachment: {
          name: pendingFile.file.name,
          mimeType: pendingFile.file.type,
          previewUrl: pendingFile.previewUrl,
        },
      });
      setText('');
      clearPending();
    } finally {
      setUploading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = Boolean(text.trim() || pendingFile) && !disabled && !uploading;

  return (
    <div className="shrink-0 px-4 py-3 bg-white border-t border-slate-200/80">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept={acceptRef.current}
        onChange={onFilePicked}
      />

      {showAttach && (
        <div className="flex gap-3 mb-3 px-1">
          {ATTACH_OPTIONS.map(({ accept, label, icon: Icon }) => (
            <button
              key={label}
              type="button"
              onClick={() => openPicker(accept)}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className="w-11 h-11 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:bg-violet-50 group-hover:border-violet-200 transition-colors">
                <Icon className="w-5 h-5 text-slate-500 group-hover:text-violet-600" />
              </div>
              <span className="text-[10px] text-slate-400">{label}</span>
            </button>
          ))}
        </div>
      )}

      {pendingFile && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          {pendingFile.type === 'image' && pendingFile.previewUrl ? (
            <img
              src={pendingFile.previewUrl}
              alt="Preview"
              className="w-12 h-12 rounded-lg object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{pendingFile.file.name}</p>
            <p className="text-[10px] text-slate-400 capitalize">{pendingFile.type} ready to send</p>
          </div>
          <button
            type="button"
            onClick={clearPending}
            className="p-1.5 rounded-full hover:bg-white text-slate-400"
            aria-label="Remove attachment"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="p-2 rounded-full hover:bg-slate-50 text-slate-400 shrink-0"
          aria-label="Emoji"
        >
          <Smile className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setShowAttach((s) => !s)}
          className={cn(
            'p-2 rounded-full hover:bg-slate-50 shrink-0 transition-colors',
            showAttach ? 'text-violet-600' : 'text-slate-400'
          )}
          aria-label="Attach"
        >
          {showAttach ? <X className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
        </button>

        <div className="flex-1">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || uploading}
            placeholder={pendingFile ? 'Add a caption...' : 'Type a message...'}
            className="w-full rounded-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="shrink-0 w-11 h-11 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 disabled:opacity-40 transition-colors"
          aria-label="Send"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </div>
    </div>
  );
}
