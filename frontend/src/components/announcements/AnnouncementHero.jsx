import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Eye, Rocket, X } from 'lucide-react';
import { getAnnouncementTheme, getRemainingTime } from './announcementThemes';
import { cn } from '../../lib/utils';

function ConfettiDots() {
  const dots = Array.from({ length: 22 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]">
      {dots.map((i) => (
        <motion.span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-white/55"
          style={{ left: `${(i * 19 + 7) % 100}%`, top: `${(i * 27 + 11) % 100}%` }}
          animate={{ y: [0, -14, 0], opacity: [0.15, 0.95, 0.15], scale: [0.7, 1.25, 0.7] }}
          transition={{ duration: 2.2 + (i % 5) * 0.3, repeat: Infinity, delay: i * 0.07 }}
        />
      ))}
    </div>
  );
}

function CountdownBox({ label, value }) {
  return (
    <div className="min-w-[52px] rounded-xl border border-white/25 bg-black/20 px-2 py-1.5 text-center backdrop-blur-md sm:min-w-[58px]">
      <p className="text-base font-bold tabular-nums leading-none sm:text-lg">
        {String(value).padStart(2, '0')}
      </p>
      <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">{label}</p>
    </div>
  );
}

function FloatingArt() {
  return (
    <div className="relative mx-auto hidden h-[180px] w-full max-w-[260px] lg:block">
      <motion.div
        className="absolute left-2 top-6 text-5xl drop-shadow-xl"
        animate={{ y: [0, -10, 0], rotate: [-8, -2, -8] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        ✈️
      </motion.div>
      <motion.div
        className="absolute right-4 top-2 text-5xl drop-shadow-xl"
        animate={{ y: [0, 12, 0], rotate: [6, -4, 6] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
      >
        🎁
      </motion.div>
      <motion.div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 text-6xl drop-shadow-2xl"
        animate={{ y: [0, -8, 0], scale: [1, 1.06, 1] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
      >
        🏆
      </motion.div>
      <motion.div
        className="absolute inset-8 rounded-full bg-white/20 blur-3xl"
        animate={{ opacity: [0.25, 0.55, 0.25], scale: [0.9, 1.15, 0.9] }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />
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
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45 }}
      className={cn('relative w-full overflow-hidden rounded-[24px]', theme.glow)}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br', theme.gradient)} />
      <motion.div
        className="absolute -left-16 top-0 h-56 w-56 rounded-full bg-white/20 blur-3xl"
        animate={{ x: [0, 30, 0], opacity: [0.25, 0.5, 0.25] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute -right-10 bottom-0 h-48 w-48 rounded-full bg-fuchsia-300/30 blur-3xl"
        animate={{ x: [0, -20, 0], opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 7, repeat: Infinity }}
      />

      <div className="relative min-h-[180px] overflow-hidden rounded-[24px] border border-white/20 bg-white/10 p-4 backdrop-blur-xl sm:min-h-[200px] sm:p-5 lg:p-6">
        <ConfettiDots />

        <button
          type="button"
          onClick={() => onDismiss?.(announcement)}
          className="absolute right-3 top-3 z-20 rounded-full bg-black/15 p-1.5 text-white/80 backdrop-blur hover:bg-black/25 sm:right-4 sm:top-4"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative z-10 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(200px,0.7fr)] lg:items-center lg:gap-6">
          <div className="min-w-0 pr-6 text-white sm:pr-8">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur sm:mb-3 sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              {announcement.badge || theme.label}
            </div>

            <h2 className="text-xl font-bold tracking-tight sm:text-2xl lg:text-[30px] lg:leading-tight">
              {announcement.title}
              <span className="ml-1">✨</span>
            </h2>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-white/90 sm:mt-2 sm:text-sm lg:text-[15px]">
              {announcement.description}
            </p>

            {remaining && !remaining.ended && (
              <div className="mt-3 sm:mt-4">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/75">
                  Offer Ends In
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <CountdownBox label="Days" value={remaining.days} />
                  <CountdownBox label="Hours" value={remaining.hours} />
                  <CountdownBox label="Mins" value={remaining.mins} />
                  <CountdownBox label="Secs" value={remaining.secs} />
                </div>
              </div>
            )}

            {progress != null && (
              <div className="mt-3 max-w-md sm:mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-white/85 sm:text-xs">
                  <span>{announcement.progressLabel || 'Campaign Progress'}</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progress, 100)}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    className="h-full rounded-full bg-gradient-to-r from-white to-amber-200"
                  />
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:flex-wrap">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onView?.(announcement)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 sm:w-auto"
              >
                <Eye className="h-4 w-4" />
                {announcement.ctaText || 'View Details'}
              </motion.button>
              <motion.button
                type="button"
                animate={{
                  boxShadow: [
                    '0 0 0 0 rgba(250,204,21,0.45)',
                    '0 0 0 10px rgba(250,204,21,0)',
                    '0 0 0 0 rgba(250,204,21,0.45)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onParticipate?.(announcement)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-400/30 hover:bg-amber-200 sm:w-auto"
              >
                <Rocket className="h-4 w-4" />
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
