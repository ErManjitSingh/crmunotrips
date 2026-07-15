import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, Hotel, Route, Sparkles } from 'lucide-react';

const STAGES = [
  { key: 'fetch', label: 'Fetching package details', icon: Sparkles },
  { key: 'itinerary', label: 'Building day-wise itinerary', icon: Route },
  { key: 'hotels', label: 'Loading hotel & cab options', icon: Hotel },
  { key: 'ready', label: 'Preparing your builder', icon: MapPin },
];

function formatElapsed(ms) {
  const seconds = Math.max(0, ms) / 1000;
  return seconds.toFixed(1);
}

/**
 * Full-page cinematic loader shown while a package detail is fetched
 * and the quotation builder workspace is prepared.
 */
export default function PackageBuilderOpeningOverlay({
  open,
  packageName = '',
  destination = '',
}) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setElapsedMs(0);
      setStageIndex(0);
      return undefined;
    }

    const started = performance.now();
    const tick = window.setInterval(() => {
      setElapsedMs(performance.now() - started);
    }, 80);

    const stageTimer = window.setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
    }, 900);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearInterval(tick);
      window.clearInterval(stageTimer);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  const stage = STAGES[stageIndex] || STAGES[0];
  const StageIcon = stage.icon;
  const progress = Math.min(92, 18 + stageIndex * 22 + (elapsedMs % 900) / 40);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[220] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
        >
          {/* Atmospheric backdrop */}
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" />
          <motion.div
            className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-orange-500/30 blur-3xl"
            animate={{ x: [0, 40, 0], y: [0, 24, 0], scale: [1, 1.12, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute -bottom-28 -right-16 h-96 w-96 rounded-full bg-sky-500/25 blur-3xl"
            animate={{ x: [0, -30, 0], y: [0, -20, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 60%, #fff 1px, transparent 1px)',
              backgroundSize: '42px 42px, 56px 56px',
            }}
            animate={{ backgroundPosition: ['0px 0px, 0px 0px', '42px 28px, -28px 42px'] }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          />

          <motion.div
            className="relative mx-4 w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 p-7 sm:p-9 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)]"
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          >
            {/* Orbit animation */}
            <div className="relative mx-auto mb-7 flex h-36 w-36 items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full border border-dashed border-orange-400/35"
                animate={{ rotate: 360 }}
                transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-3 rounded-full border border-sky-400/25"
                animate={{ rotate: -360 }}
                transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
              />
              <motion.div
                className="absolute inset-0"
                animate={{ rotate: 360 }}
                transition={{ duration: 3.6, repeat: Infinity, ease: 'linear' }}
              >
                <span className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.9)]" />
              </motion.div>
              <motion.div
                className="absolute inset-0"
                animate={{ rotate: -360 }}
                transition={{ duration: 5.2, repeat: Infinity, ease: 'linear' }}
              >
                <span className="absolute bottom-2 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.85)]" />
              </motion.div>
              <motion.div
                className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              >
                <StageIcon className="h-8 w-8" strokeWidth={2.2} />
              </motion.div>
            </div>

            <div className="text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-300/90">
                Opening package builder
              </p>
              <h2 className="mt-2 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                {packageName || 'Your package'}
              </h2>
              {destination ? (
                <p className="mt-1.5 text-sm font-medium text-slate-300">
                  {destination}
                </p>
              ) : null}
            </div>

            {/* Stage status */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={stage.key}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/20 text-orange-300">
                    <StageIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-semibold text-white">{stage.label}</p>
                    <p className="text-[11px] text-slate-400">
                      Step {stageIndex + 1} of {STAGES.length}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-sky-400"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Waiting clock */}
            <div className="mt-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  Waiting time
                </p>
                <p className="mt-0.5 font-mono text-3xl font-black tabular-nums text-white">
                  {formatElapsed(elapsedMs)}
                  <span className="ml-1 text-base font-semibold text-slate-400">sec</span>
                </p>
              </div>
              <div className="flex gap-1.5 pb-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-2 w-2 rounded-full bg-orange-400"
                    animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                  />
                ))}
              </div>
            </div>

            <p className="mt-5 text-center text-[11px] text-slate-400">
              Please wait while we load hotels, cab options and itinerary…
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
