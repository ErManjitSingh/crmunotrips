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
    scroller.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-content-primary sm:text-sm">
          Important Announcements
        </h3>
        <div className="hidden gap-1 sm:flex">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="rounded-lg border border-subtle bg-surface p-1 hover:bg-surface-elevated"
            aria-label="Previous"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="rounded-lg border border-subtle bg-surface p-1 hover:bg-surface-elevated"
            aria-label="Next"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-1 scrollbar-thin snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((item, i) => {
          const theme = getAnnouncementTheme(item.type);
          return (
            <motion.article
              key={item._id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ y: -2 }}
              className={cn(
                'relative w-[min(70vw,190px)] shrink-0 snap-start overflow-hidden rounded-xl border bg-gradient-to-br p-2.5 shadow-sm sm:w-[180px]',
                theme.soft,
                theme.border
              )}
            >
              {!item.isRead && (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-violet-500" />
              )}

              <div className="mb-1.5 flex items-center gap-1.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 text-sm shadow-sm dark:bg-slate-900/60">
                  {TYPE_EMOJI[item.type] || <Megaphone className="h-3 w-3" />}
                </div>
                <div className="min-w-0">
                  <p className={cn('truncate text-[10px] font-bold uppercase tracking-wide', theme.accent)}>
                    {theme.label || item.type}
                  </p>
                  <p className="text-[9px] text-content-muted">
                    {new Date(item.publishAt || item.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
              </div>

              <h4 className="line-clamp-1 text-xs font-semibold text-content-primary">{item.title}</h4>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-content-secondary">
                {item.description}
              </p>
              <button
                type="button"
                onClick={() => onReadMore?.(item)}
                className={cn('mt-1.5 text-[10px] font-semibold hover:underline', theme.accent)}
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
