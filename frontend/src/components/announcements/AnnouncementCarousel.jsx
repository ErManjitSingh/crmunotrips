import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Megaphone, ArrowRight } from 'lucide-react';
import { getAnnouncementTheme } from './announcementThemes';
import { cn } from '../../lib/utils';

const TYPE_EMOJI = {
  target: '🎯',
  policy: '📋',
  holiday: '🏖️',
  update: '📢',
  maintenance: '🛠️',
  contest: '🏆',
  festival: '🎊',
  offer: '💎',
  promotion: '🎁',
  incentive: '💰',
  emergency: '🚨',
};

const TYPE_ICON_BG = {
  offer: 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300',
  promotion: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/20 dark:text-fuchsia-300',
  contest: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300',
  target: 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300',
  policy: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300',
  holiday: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
  festival: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  update: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300',
  incentive: 'bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300',
  emergency: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300',
  maintenance: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-500/20 dark:text-zinc-300',
};

export default function AnnouncementCarousel({ items = [], onReadMore }) {
  const scroller = useRef(null);
  if (!items.length) return null;

  const scrollBy = (dir) => {
    scroller.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-content-primary">
            Important Announcements
          </h3>
          <p className="text-[11px] text-content-muted">Latest offers, targets & updates</p>
        </div>
        <div className="hidden gap-1.5 sm:flex">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="rounded-xl border border-subtle bg-surface p-1.5 text-content-secondary shadow-sm transition hover:bg-surface-elevated hover:text-content-primary"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="rounded-xl border border-subtle bg-surface p-1.5 text-content-secondary shadow-sm transition hover:bg-surface-elevated hover:text-content-primary"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="-mx-0.5 flex gap-2.5 overflow-x-auto px-0.5 pb-1.5 scrollbar-thin snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((item, i) => {
          const theme = getAnnouncementTheme(item.type);
          return (
            <motion.article
              key={item._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -3 }}
              className={cn(
                'group relative w-[min(74vw,210px)] shrink-0 snap-start overflow-hidden rounded-2xl border border-subtle',
                'bg-white/90 p-3 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md',
                'dark:bg-slate-900/90 sm:w-[200px]'
              )}
            >
              <div className={cn('pointer-events-none absolute inset-0 opacity-60 bg-gradient-to-br', theme.soft)} />
              {!item.isRead && (
                <span className="absolute right-2.5 top-2.5 z-10 h-2 w-2 rounded-full bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.2)]" />
              )}

              <div className="relative z-10">
                <div className="mb-2.5 flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base shadow-sm ring-1 ring-black/5',
                      TYPE_ICON_BG[item.type] || TYPE_ICON_BG.update
                    )}
                  >
                    {TYPE_EMOJI[item.type] || <Megaphone className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className={cn('text-[10px] font-bold uppercase tracking-[0.08em]', theme.accent)}>
                      {theme.label || item.type}
                    </p>
                    <p className="text-[10px] text-content-muted">
                      {new Date(item.publishAt || item.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <h4 className="line-clamp-2 text-[13px] font-semibold leading-snug text-content-primary">
                  {item.title}
                </h4>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-content-secondary">
                  {item.description}
                </p>

                <button
                  type="button"
                  onClick={() => onReadMore?.(item)}
                  className={cn(
                    'mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold transition group-hover:gap-1.5',
                    theme.accent
                  )}
                >
                  Read More
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
