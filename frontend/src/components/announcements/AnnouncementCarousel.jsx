import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Megaphone } from 'lucide-react';
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

export default function AnnouncementCarousel({ items = [], onReadMore }) {
  const scroller = useRef(null);
  if (!items.length) return null;

  const scrollBy = (dir) => {
    const width = scroller.current?.clientWidth || 300;
    scroller.current?.scrollBy({ left: dir * Math.min(width * 0.85, 300), behavior: 'smooth' });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-content-primary sm:text-[15px]">
            Important Announcements
          </h3>
          <p className="text-xs text-content-muted">Offers, targets, policies & updates</p>
        </div>
        <div className="hidden gap-1.5 sm:flex">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="rounded-xl border border-subtle bg-surface p-2 hover:bg-surface-elevated"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="rounded-xl border border-subtle bg-surface p-2 hover:bg-surface-elevated"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-thin snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((item, i) => {
          const theme = getAnnouncementTheme(item.type);
          return (
            <motion.article
              key={item._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ y: -4 }}
              className={cn(
                'relative w-[min(78vw,260px)] shrink-0 snap-start overflow-hidden rounded-[20px] border bg-gradient-to-br p-4 shadow-sm sm:w-[240px]',
                theme.soft,
                theme.border
              )}
            >
              {!item.isRead && (
                <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.25)]" />
              )}

              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-lg shadow-sm dark:bg-slate-900/60">
                  {TYPE_EMOJI[item.type] || <Megaphone className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className={cn('text-[11px] font-bold uppercase tracking-wide', theme.accent)}>
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

              <h4 className="line-clamp-2 text-sm font-semibold text-content-primary">{item.title}</h4>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-content-secondary">
                {item.description}
              </p>
              <button
                type="button"
                onClick={() => onReadMore?.(item)}
                className={cn('mt-3 text-xs font-semibold hover:underline', theme.accent)}
              >
                Read More →
              </button>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
