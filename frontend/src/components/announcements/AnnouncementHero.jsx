import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Eye, Rocket, X } from 'lucide-react';
import { getAnnouncementTheme, getRemainingTime } from './announcementThemes';
import { cn } from '../../lib/utils';

function CountdownBox({ label, value }) {
  return (
    <div className="min-w-[40px] rounded-lg border border-white/25 bg-black/20 px-1.5 py-1 text-center backdrop-blur-md sm:min-w-[44px]">
      <p className="text-sm font-bold tabular-nums leading-none">{String(value).padStart(2, '0')}</p>
      <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide text-white/70">{label}</p>
    </div>
  );
}

function FloatingArt() {
  return (
    <div className="relative mx-auto hidden h-[110px] w-full max-w-[160px] lg:block">
      <motion.div
        className="absolute left-1 top-3 text-3xl drop-shadow-lg"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        ✈️
      </motion.div>
      <motion.div
        className="absolute right-1 top-0 text-3xl drop-shadow-lg"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
      >
        🎁
      </motion.div>
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 text-4xl drop-shadow-xl"
        animate={{ y: [0, -5, 0], scale: [1, 1.04, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        🏆
      </motion.div>
    </div>
  );
}

export default function AnnouncementHero({ announcement, onView, onParticipate, onDismiss }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!announcement?.expiresAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [announcement?.expiresAt]);

  if (!announcement) return null;
  const theme = getAnnouncementTheme(announcement.type);
  const remaining = getRemainingTime(announcement.expiresAt, now);
  const progress = announcement.progressPercent ?? null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn('relative w-full overflow-hidden rounded-2xl', theme.glow)}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br', theme.gradient)} />
      <div className="absolute -left-10 top-0 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
      <div className="absolute -right-8 bottom-0 h-24 w-24 rounded-full bg-fuchsia-300/25 blur-2xl" />

      <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur-xl sm:p-3.5">
        <button
          type="button"
          onClick={() => onDismiss?.(announcement)}
          className="absolute right-2 top-2 z-20 rounded-full bg-black/15 p-1 text-white/80 hover:bg-black/25"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="relative z-10 grid gap-2.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(140px,0.55fr)] lg:items-center lg:gap-3">
          <div className="min-w-0 pr-5 text-white">
            <div className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
              <Sparkles className="h-3 w-3" />
              {announcement.badge || theme.label}
            </div>

            <h2 className="text-base font-bold tracking-tight sm:text-lg lg:text-xl">
              {announcement.title} <span>✨</span>
            </h2>
            <p className="mt-1 line-clamp-2 max-w-2xl text-[11px] leading-relaxed text-white/90 sm:text-xs">
              {announcement.description}
            </p>

            <div className="mt-2.5 flex flex-wrap items-end gap-3">
              {remaining && !remaining.ended && (
                <div>
                  <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/70">
                    Ends In
                  </p>
                  <div className="flex gap-1">
                    <CountdownBox label="D" value={remaining.days} />
                    <CountdownBox label="H" value={remaining.hours} />
                    <CountdownBox label="M" value={remaining.mins} />
                    <CountdownBox label="S" value={remaining.secs} />
                  </div>
                </div>
              )}

              {progress != null && (
                <div className="min-w-[120px] flex-1 max-w-[200px]">
                  <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-white/85">
                    <span>Progress</span>
                    <span className="tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(progress, 100)}%` }}
                      transition={{ duration: 0.8 }}
                      className="h-full rounded-full bg-gradient-to-r from-white to-amber-200"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2.5 flex gap-1.5">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => onView?.(announcement)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20 sm:flex-none"
              >
                <Eye className="h-3.5 w-3.5" />
                {announcement.ctaText || 'View Details'}
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => onParticipate?.(announcement)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-300 px-3 py-1.5 text-[11px] font-bold text-slate-900 shadow-sm hover:bg-amber-200 sm:flex-none"
              >
                <Rocket className="h-3.5 w-3.5" />
                {announcement.secondaryCtaText || 'Participate'}
              </motion.button>
            </div>
          </div>

          <FloatingArt />
        </div>
      </div>
    </motion.section>
  );
}
