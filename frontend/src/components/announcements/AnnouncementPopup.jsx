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
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className={cn(
              'relative w-full max-w-[380px] overflow-hidden rounded-[22px] border shadow-2xl',
              theme.border,
              theme.glow
            )}
          >
            <div className={cn('relative overflow-hidden bg-gradient-to-br p-5 text-white', theme.gradient)}>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.25),transparent_60%)]" />
              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 z-10 rounded-full border border-white/20 bg-black/10 p-1.5 hover:bg-black/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="relative z-10">
                <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[10px] font-semibold">
                  <Sparkles className="h-3 w-3 text-amber-200" />
                  {announcement.badge || 'New Announcement'}
                </div>
                <div className="mb-2 text-4xl drop-shadow-lg">
                  {announcement.type === 'contest' ? '🏆' : announcement.type === 'offer' ? '💎' : '🎉'}
                </div>
                <h2 className="text-xl font-bold tracking-tight">{announcement.title}</h2>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-white/90">
                  {announcement.description}
                </p>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => onView?.(announcement)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 shadow-lg"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Details
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-3 py-2.5 text-xs font-semibold text-white backdrop-blur"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
