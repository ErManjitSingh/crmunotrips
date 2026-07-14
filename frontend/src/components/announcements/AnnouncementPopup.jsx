import { memo } from 'react';
import { X, Sparkles, Eye } from 'lucide-react';
import { getAnnouncementTheme } from './announcementThemes';
import { cn } from '../../lib/utils';

function AnnouncementPopup({ announcement, open, onClose, onView }) {
  if (!announcement || !open) return null;
  const theme = getAnnouncementTheme(announcement.type);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/55" onClick={onClose} aria-label="Close overlay" />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-[360px] overflow-hidden rounded-2xl border shadow-xl',
          theme.border
        )}
      >
        <div className={cn('relative overflow-hidden bg-gradient-to-br p-4 text-white', theme.gradient)}>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2.5 top-2.5 z-10 rounded-full bg-black/15 p-1.5 hover:bg-black/25"
          >
            <X className="h-3.5 w-3.5" />
          </button>

          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold">
            <Sparkles className="h-3 w-3 text-amber-200" />
            {announcement.badge || 'New Announcement'}
          </div>
          <div className="mb-1.5 text-3xl" aria-hidden>
            {announcement.type === 'contest' ? '🏆' : announcement.type === 'offer' ? '💎' : '🎉'}
          </div>
          <h2 className="text-lg font-bold tracking-tight">{announcement.title}</h2>
          <p className="mt-1 line-clamp-3 text-xs text-white/90">{announcement.description}</p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => onView?.(announcement)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-900"
            >
              <Eye className="h-3.5 w-3.5" />
              View Details
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-xs font-semibold text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(AnnouncementPopup);
