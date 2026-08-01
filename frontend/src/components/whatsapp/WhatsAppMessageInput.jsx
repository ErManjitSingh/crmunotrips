import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Smile,
  Paperclip,
  Send,
  X,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  LayoutTemplate,
  Search,
  Check,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { detectWhatsAppMediaType, fileToDataUrl } from './whatsappUtils';
import { fetchWhatsAppTemplates } from '../../services/whatsappTemplatesApi';
import { renderWhatsAppTemplate } from '../../lib/whatsappContact';

const ATTACH_OPTIONS = [
  { accept: 'image/*', label: 'Photo', icon: ImageIcon, kind: 'image' },
  { accept: 'video/*', label: 'Video', icon: Film, kind: 'video' },
  { accept: 'audio/*', label: 'Audio', icon: Music, kind: 'audio' },
  { accept: '.pdf,.doc,.docx,.xls,.xlsx,application/pdf', label: 'Document', icon: FileText, kind: 'document' },
];

const MAX_BYTES = 12 * 1024 * 1024;

export default function WhatsAppMessageInput({ onSend, disabled, lead, user }) {
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const acceptRef = useRef('image/*');

  useEffect(() => {
    if (!showTemplates) return;
    let cancelled = false;
    setTemplatesLoading(true);
    fetchWhatsAppTemplates()
      .then((rows) => {
        if (cancelled) return;
        setTemplates((rows || []).filter((t) => t.enabled !== false));
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showTemplates]);

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const hay = `${t.name || ''} ${t.body || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [templates, templateSearch]);

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

  const applyTemplate = (template) => {
    const rendered = renderWhatsAppTemplate(template.body, lead || {}, user || {});
    setText(rendered);
    setShowTemplates(false);
    setTemplateSearch('');
    requestAnimationFrame(() => inputRef.current?.focus());
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

  const toggleTemplates = () => {
    setShowAttach(false);
    setShowTemplates((s) => !s);
  };

  const toggleAttach = () => {
    setShowTemplates(false);
    setShowAttach((s) => !s);
  };

  return (
    <div className="shrink-0 px-3 sm:px-4 py-3 bg-white border-t border-slate-200/80">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept={acceptRef.current}
        onChange={onFilePicked}
      />

      {showTemplates && (
        <div className="mb-3 overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/80 to-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-emerald-100 px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#25D366]/15 text-[#128C7E]">
                <LayoutTemplate className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">Select template</p>
                <p className="text-[10px] text-slate-500 truncate">
                  Fills name & destination automatically
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowTemplates(false);
                setTemplateSearch('');
              }}
              className="rounded-full p-1.5 text-slate-400 hover:bg-white hover:text-slate-600"
              aria-label="Close templates"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative px-3 py-2">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              placeholder="Search templates..."
              className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            />
          </div>

          <div className="max-h-52 overflow-y-auto px-2 pb-2">
            {templatesLoading && (
              <p className="px-2 py-6 text-center text-xs text-slate-400">Loading templates…</p>
            )}
            {!templatesLoading && filteredTemplates.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-slate-400">
                No templates found. Add some in Settings → WhatsApp Templates.
              </p>
            )}
            {!templatesLoading &&
              filteredTemplates.map((template) => {
                const preview = renderWhatsAppTemplate(template.body, lead || {}, user || {});
                return (
                  <button
                    key={template._id}
                    type="button"
                    onClick={() => applyTemplate(template)}
                    className="group mb-1.5 flex w-full flex-col gap-1 rounded-xl border border-transparent bg-white px-3 py-2.5 text-left shadow-sm ring-1 ring-slate-100 transition hover:border-emerald-200 hover:ring-emerald-200/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">{template.name}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 opacity-0 transition group-hover:opacity-100">
                        <Check className="h-3 w-3" />
                        Use
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-500 whitespace-pre-line">
                      {preview}
                    </p>
                  </button>
                );
              })}
          </div>
        </div>
      )}

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

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          className="p-2 rounded-full hover:bg-slate-50 text-slate-400 shrink-0"
          aria-label="Emoji"
        >
          <Smile className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={toggleTemplates}
          className={cn(
            'p-2 rounded-full hover:bg-emerald-50 shrink-0 transition-colors',
            showTemplates ? 'text-[#128C7E] bg-emerald-50' : 'text-slate-400'
          )}
          aria-label="Select template"
          title="Select template"
        >
          <LayoutTemplate className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={toggleAttach}
          className={cn(
            'p-2 rounded-full hover:bg-slate-50 shrink-0 transition-colors',
            showAttach ? 'text-violet-600' : 'text-slate-400'
          )}
          aria-label="Attach"
        >
          {showAttach ? <X className="w-5 h-5" /> : <Paperclip className="w-5 h-5" />}
        </button>

        <div className="flex-1 min-w-0">
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

      {!showTemplates && (
        <button
          type="button"
          onClick={toggleTemplates}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-3 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Select template
        </button>
      )}
    </div>
  );
}
