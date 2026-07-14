import { motion } from 'framer-motion';
import { Sparkles, Clock3, Eye, Rocket, X, BellRing } from 'lucide-react';
import { getAnnouncementTheme, getRemainingTime } from './announcementThemes';
import { cn } from '../../lib/utils';

function ConfettiDots() {
  const dots = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]">
      {dots.map((i) => (
        <motion.span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-white/50"
          style={{ left: `${(i * 17) % 100}%`, top: `${(i * 29) % 100}%` }}
          animate={{ y: [0, -12, 0], opacity: [0.2, 0.9, 0.2], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: 2.4 + (i % 5) * 0.25, repeat: Infinity, delay: i * 0.08 }}
        />
      ))}
    </div>
  );
}

export default function AnnouncementHero({ announcement, onView, onParticipate, onDismiss, onRemind }) {
  if (!announcement) return null;
  const theme = getAnnouncementTheme(announcement.type);
  const remaining = getRemainingTime(announcement.expiresAt);
  const progress = announcement.progressPercent ?? null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45 }}
      className={cn(
        'relative overflow-hidden rounded-[24px] border p-[1px]',
        theme.border,
        'shadow-xl',
        theme.glow
      )}
    >
      <motion.div
        className={cn('absolute inset-0 bg-gradient-to-r opacity-90', theme.gradient)}
        animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        style={{ backgroundSize: '200% 200%' }}
      />
      <div className="relative overflow-hidden rounded-[23px] bg-white/10 p-5 backdrop-blur-xl sm:p-6 dark:bg-slate-950/30">
        <ConfettiDots />
        <div className="relative z-10 grid gap-5 lg:grid-cols-[1.4fr_0.8fr] lg:items-center">
          <div className="min-w-0 text-white">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              {announcement.badge || announcement.type}
            </div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{announcement.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-[15px]">
              {announcement.description}
            </p>

            {remaining && !remaining.ended && (
              <div className="mt-4 inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-black/15 px-3 py-2 backdrop-blur">
                <Clock3 className="h-4 w-4 text-white/80" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Offer Ends In</p>
                  <p className="text-sm font-bold">
                    {String(remaining.days).padStart(2, '0')} Days · {String(remaining.hours).padStart(2, '0')} Hours
                  </p>
                </div>
              </div>
            )}

            {progress != null && (
              <div className="mt-4 max-w-md">
                <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-white/80">
                  <span>{announcement.progressLabel || 'Campaign Progress'}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/20">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(progress, 100)}%` }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                    className="h-full rounded-full bg-white"
                  />
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onView?.(announcement)}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-lg"
              >
                <Eye className="h-4 w-4" />
                {announcement.ctaText || 'View Details'}
              </motion.button>
              <motion.button
                type="button"
                animate={{ boxShadow: ['0 0 0 0 rgba(255,255,255,0.35)', '0 0 0 10px rgba(255,255,255,0)', '0 0 0 0 rgba(255,255,255,0.35)'] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                onClick={() => onParticipate?.(announcement)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur"
              >
                <Rocket className="h-4 w-4" />
                {announcement.secondaryCtaText || 'Participate Now'}
              </motion.button>
              <button
                type="button"
                onClick={() => onRemind?.(announcement)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-3 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                <BellRing className="h-4 w-4" />
                Remind Me Later
              </button>
              <button
                type="button"
                onClick={() => onDismiss?.(announcement)}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-white/75 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
                Dismiss
              </button>
            </div>

            {!!announcement.tags?.length && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {announcement.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/90">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="relative mx-auto hidden h-40 w-full max-w-[220px] lg:block">
            <motion.div
              className="absolute inset-4 rounded-[28px] bg-white/15 backdrop-blur-md border border-white/25 shadow-2xl"
              animate={{ y: [0, -8, 0], rotate: [0, 2, -2, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute left-8 top-8 h-24 w-24 rounded-full bg-white/20 blur-2xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-6xl">
              {announcement.type === 'contest' ? '🏆' : announcement.type === 'holiday' ? '🎉' : announcement.type === 'target' ? '🎯' : '🚀'}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
