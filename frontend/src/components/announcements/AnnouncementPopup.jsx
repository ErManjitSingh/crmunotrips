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
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className={cn(
              'relative w-full max-w-lg overflow-hidden rounded-3xl border bg-gradient-to-br p-[1px] shadow-2xl',
              theme.border,
              theme.glow
            )}
          >
            <div className={cn('rounded-[23px] bg-gradient-to-br p-6 text-white sm:p-7', theme.gradient)}>
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full bg-white/15 p-1.5 hover:bg-white/25"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5" />
                {announcement.badge || 'New Announcement'}
              </div>
              <div className="mb-3 text-5xl">
                {announcement.type === 'contest' ? '🏆' : announcement.type === 'offer' ? '💎' : '🎉'}
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{announcement.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/85">{announcement.description}</p>

              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onView?.(announcement)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900"
                >
                  <Eye className="h-4 w-4" />
                  View Details
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
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
