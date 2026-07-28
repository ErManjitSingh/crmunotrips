import { StickyNote } from 'lucide-react';
import { formatFullDateTime, getInitials } from './whatsappUtils';

export default function WhatsAppNotesTimeline({ notes, onAddNote }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-violet-600/80 flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5" />
          Notes
        </h4>
        <button
          type="button"
          onClick={onAddNote}
          className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 transition-colors"
        >
          + Add note
        </button>
      </div>

      {!notes?.length ? (
        <p className="text-xs text-slate-400 italic py-2">No notes yet</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {notes.map((note) => (
            <div key={note._id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                {getInitials(note.user?.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="rounded-xl rounded-tl-sm px-3 py-2 bg-slate-50 border border-slate-100">
                  <p className="text-xs text-slate-700 leading-relaxed">{note.text}</p>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 px-1">
                  {note.user?.name} · {formatFullDateTime(note.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
