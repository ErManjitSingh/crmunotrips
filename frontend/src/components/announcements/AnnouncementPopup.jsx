import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Eye } from 'lucide-react';
import { getAnnouncementTheme } from './announcementThemes';
import { cn } from '../../lib/utils';

export default function AnnouncementPopup({ announcement, open, onClose, onView }) {
  if (!announcement) return null;
  const theme = getAnnouncementTheme(announcement.type);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className={cn(
              'relative w-full max-w-sm overflow-hidden rounded-2xl border shadow-2xl',
              theme.border,
              theme.glow
            )}
          >
            <div className={cn('bg-gradient-to-br p-4 text-white sm:p-5', theme.gradient)}>
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 rounded-full bg-white/15 p-1 hover:bg-white/25"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold">
                <Sparkles className="h-3 w-3" />
                {announcement.badge || 'New Announcement'}
              </div>
              <div className="mb-2 text-3xl">
                {announcement.type === 'contest' ? '🏆' : announcement.type === 'offer' ? '💎' : '🎉'}
              </div>
              <h2 className="text-lg font-bold tracking-tight">{announcement.title}</h2>
              <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-white/85">
                {announcement.description}
              </p>

              <div className="mt-4 flex flex-col gap-1.5 sm:flex-row">
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
