import { useState, useRef } from 'react';
import { Smile, Paperclip, Send, X, FileText, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

const ATTACH_OPTIONS = [
  { type: 'image', label: 'Photo', icon: ImageIcon },
  { type: 'pdf', label: 'PDF', icon: FileText },
  { type: 'document', label: 'Document', icon: FileText },
];

export default function WhatsAppMessageInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const inputRef = useRef(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend({ text: trimmed, type: 'text' });
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttach = (type) => {
    setShowAttach(false);
    onSend({
      text: type === 'pdf' ? 'Shared document' : type === 'image' ? 'Shared photo' : 'Shared file',
      type,
      attachment: {
        name: type === 'pdf' ? 'Itinerary.pdf' : type === 'image' ? 'photo.jpg' : 'document.docx',
        size: '1.2 MB',
        url: type === 'image' ? 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&h=300&fit=crop' : '#',
      },
    });
  };

  return (
    <div className="shrink-0 px-4 py-3 bg-white border-t border-slate-200/80">
      {showAttach && (
        <div className="flex gap-3 mb-3 px-1">
          {ATTACH_OPTIONS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleAttach(type)}
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
            disabled={disabled}
            placeholder="Type a message..."
            className="w-full rounded-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="shrink-0 w-11 h-11 rounded-full bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 disabled:opacity-40 transition-colors"
          aria-label="Send"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </div>
    </div>
  );
}
