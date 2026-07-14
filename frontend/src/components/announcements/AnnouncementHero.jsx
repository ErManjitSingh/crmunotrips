import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Eye, Rocket, X } from 'lucide-react';
import { getAnnouncementTheme, getRemainingTime } from './announcementThemes';
import { cn } from '../../lib/utils';

function Tick({ value, label }) {
  return (
    <div className="inline-flex items-baseline gap-0.5 rounded-md bg-black/20 px-1.5 py-0.5 backdrop-blur">
      <span className="text-[11px] font-bold tabular-nums text-white sm:text-xs">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[8px] font-medium uppercase text-white/65">{label}</span>
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('relative w-full overflow-hidden rounded-2xl shadow-lg', theme.glow)}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-r', theme.gradient)} />
      <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(255,255,255,0.18)_0%,transparent_45%)]" />

      <div className="relative flex flex-col gap-2.5 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-3.5">
        <button
          type="button"
          onClick={() => onDismiss?.(announcement)}
          className="absolute right-2 top-2 z-10 rounded-full bg-black/15 p-1 text-white/80 hover:bg-black/25 sm:right-2.5 sm:top-2.5"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="hidden shrink-0 text-3xl sm:block lg:text-4xl" aria-hidden>
          {announcement.type === 'contest' ? '🏆' : announcement.type === 'holiday' ? '🎉' : '🚀'}
        </div>

        <div className="min-w-0 flex-1 pr-6 text-white">
          <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
            <Sparkles className="h-3 w-3 text-amber-200" />
            {announcement.badge || theme.label}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="text-sm font-bold tracking-tight sm:text-[15px] lg:text-base">
              {announcement.title}
            </h2>
            {remaining && !remaining.ended && (
              <div className="flex flex-wrap gap-1">
                <Tick value={remaining.days} label="d" />
                <Tick value={remaining.hours} label="h" />
                <Tick value={remaining.mins} label="m" />
                <Tick value={remaining.secs} label="s" />
              </div>
            )}
          </div>

          <p className="mt-0.5 line-clamp-1 text-[11px] text-white/85 sm:text-xs">
            {announcement.description}
          </p>

          {progress != null && (
            <div className="mt-1.5 flex max-w-xs items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  className="h-full rounded-full bg-white/90"
                />
              </div>
              <span className="text-[10px] font-semibold tabular-nums text-white/90">{progress}%</span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-1.5 sm:flex-col lg:flex-row">
          <button
            type="button"
            onClick={() => onView?.(announcement)}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-white/35 bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/25 sm:flex-none"
          >
            <Eye className="h-3 w-3" />
            Details
          </button>
          <button
            type="button"
            onClick={() => onParticipate?.(announcement)}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-300 px-2.5 py-1.5 text-[11px] font-bold text-slate-900 shadow-sm hover:bg-amber-200 sm:flex-none"
          >
            <Rocket className="h-3 w-3" />
            Join
          </button>
        </div>
      </div>
    </motion.section>
  );
}
