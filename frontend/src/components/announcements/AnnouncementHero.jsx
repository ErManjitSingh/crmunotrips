import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Eye, Rocket, X } from 'lucide-react';
import { getAnnouncementTheme, getRemainingTime } from './announcementThemes';
import { cn } from '../../lib/utils';

function CountdownBox({ label, value }) {
  return (
    <div className="flex min-w-[46px] flex-col items-center rounded-xl border border-white/30 bg-white/15 px-2 py-1.5 shadow-inner backdrop-blur-md sm:min-w-[52px]">
      <span className="text-sm font-bold tabular-nums leading-none tracking-tight text-white sm:text-base">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-white/75">
        {label}
      </span>
    </div>
  );
}

function FloatingArt() {
  return (
    <div className="relative mx-auto hidden h-[132px] w-full max-w-[200px] lg:block">
      <motion.div
        className="absolute inset-4 rounded-[28px] border border-white/25 bg-white/10 shadow-2xl backdrop-blur-md"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-2 top-5 text-[34px] drop-shadow-[0_8px_16px_rgba(0,0,0,0.25)]"
        animate={{ y: [0, -8, 0], rotate: [-10, -4, -10] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        ✈️
      </motion.div>
      <motion.div
        className="absolute right-3 top-1 text-[34px] drop-shadow-[0_8px_16px_rgba(0,0,0,0.25)]"
        animate={{ y: [0, 10, 0], rotate: [8, 0, 8] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
      >
        🎁
      </motion.div>
      <motion.div
        className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[44px] drop-shadow-[0_12px_20px_rgba(0,0,0,0.28)]"
        animate={{ y: [0, -6, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.1 }}
      >
        🏆
      </motion.div>
      <motion.div
        className="absolute inset-8 rounded-full bg-fuchsia-200/40 blur-2xl"
        animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.95, 1.1, 0.95] }}
        transition={{ duration: 3.4, repeat: Infinity }}
      />
    </div>
  );
}

function SparkleDust() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-white/70"
          style={{ left: `${(i * 23 + 8) % 96}%`, top: `${(i * 31 + 5) % 90}%` }}
          animate={{ opacity: [0.1, 0.9, 0.1], y: [0, -10, 0], scale: [0.6, 1.2, 0.6] }}
          transition={{ duration: 2.4 + (i % 4) * 0.35, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
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
      initial={{ opacity: 0, y: 12, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={cn('relative w-full overflow-hidden rounded-[22px]', theme.glow)}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br', theme.gradient)} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.28),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(255,255,255,0.12),transparent_50%)]" />
      <motion.div
        className="absolute -left-12 -top-8 h-40 w-40 rounded-full bg-white/25 blur-3xl"
        animate={{ x: [0, 18, 0], opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 7, repeat: Infinity }}
      />
      <motion.div
        className="absolute -bottom-10 -right-8 h-36 w-36 rounded-full bg-pink-300/35 blur-3xl"
        animate={{ x: [0, -14, 0], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 6, repeat: Infinity }}
      />

      <div className="relative overflow-hidden rounded-[22px] border border-white/25 bg-white/[0.08] p-3.5 backdrop-blur-xl sm:p-4 lg:p-5">
        <SparkleDust />

        <button
          type="button"
          onClick={() => onDismiss?.(announcement)}
          className="absolute right-3 top-3 z-20 rounded-full border border-white/20 bg-black/10 p-1.5 text-white/85 backdrop-blur transition hover:bg-black/20"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="relative z-10 grid gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(180px,0.65fr)] lg:items-center lg:gap-4">
          <div className="min-w-0 pr-7 text-white sm:pr-8">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-1 text-[10px] font-semibold shadow-sm backdrop-blur sm:text-[11px]">
              <Sparkles className="h-3 w-3 text-amber-200" />
              {announcement.badge || theme.label}
            </div>

            <h2 className="text-lg font-bold tracking-tight sm:text-xl lg:text-[22px] lg:leading-snug">
              {announcement.title}
              <span className="ml-1 inline-block">✨</span>
            </h2>
            <p className="mt-1.5 line-clamp-2 max-w-xl text-xs leading-relaxed text-white/90 sm:text-[13px]">
              {announcement.description}
            </p>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              {remaining && !remaining.ended && (
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">
                    Offer Ends In
                  </p>
                  <div className="flex gap-1.5">
                    <CountdownBox label="Days" value={remaining.days} />
                    <CountdownBox label="Hours" value={remaining.hours} />
                    <CountdownBox label="Mins" value={remaining.mins} />
                    <CountdownBox label="Secs" value={remaining.secs} />
                  </div>
                </div>
              )}

              {progress != null && (
                <div className="w-full min-w-[140px] max-w-[220px] flex-1">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-white/90">
                    <span>{announcement.progressLabel || 'Campaign Progress'}</span>
                    <span className="tabular-nums font-bold">{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/20 ring-1 ring-white/20">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(progress, 100)}%` }}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-200 via-white to-fuchsia-100 shadow-[0_0_12px_rgba(255,255,255,0.55)]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3.5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onView?.(announcement)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/40 bg-white/15 px-3.5 py-2 text-xs font-semibold text-white shadow-sm backdrop-blur transition hover:bg-white/25 sm:w-auto"
              >
                <Eye className="h-3.5 w-3.5" />
                {announcement.ctaText || 'View Details'}
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                animate={{
                  boxShadow: [
                    '0 0 0 0 rgba(251,191,36,0.45)',
                    '0 0 0 8px rgba(251,191,36,0)',
                    '0 0 0 0 rgba(251,191,36,0.45)',
                  ],
                }}
                transition={{ duration: 2.1, repeat: Infinity }}
                onClick={() => onParticipate?.(announcement)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-300 px-3.5 py-2 text-xs font-bold text-slate-900 shadow-lg shadow-amber-400/30 sm:w-auto"
              >
                <Rocket className="h-3.5 w-3.5" />
                {announcement.secondaryCtaText || 'Participate Now'}
              </motion.button>
            </div>
          </div>

          <FloatingArt />
        </div>
      </div>
    </motion.section>
  );
}
