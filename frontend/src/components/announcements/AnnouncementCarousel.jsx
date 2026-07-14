import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
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
    scroller.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });
  };

  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-content-primary">Important Announcements</h3>
        <div className="hidden gap-1 sm:flex">
          <button type="button" onClick={() => scrollBy(-1)} className="rounded-md border border-subtle p-1 hover:bg-surface-elevated" aria-label="Prev">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => scrollBy(1)} className="rounded-md border border-subtle p-1 hover:bg-surface-elevated" aria-label="Next">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((item, i) => {
          const theme = getAnnouncementTheme(item.type);
          return (
            <motion.button
              key={item._id}
              type="button"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => onReadMore?.(item)}
              className={cn(
                'group relative flex w-[min(68vw,168px)] shrink-0 snap-start items-start gap-2 rounded-xl border border-subtle bg-surface p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:w-[160px]'
              )}
            >
              {!item.isRead && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-violet-500" />
              )}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-elevated text-sm">
                {TYPE_EMOJI[item.type] || '📢'}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-[9px] font-bold uppercase tracking-wide', theme.accent)}>
                  {theme.label}
                </span>
                <span className="mt-0.5 block line-clamp-1 text-[11px] font-semibold text-content-primary">
                  {item.title}
                </span>
                <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-content-muted group-hover:text-content-secondary">
                  More <ArrowRight className="h-2.5 w-2.5" />
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
