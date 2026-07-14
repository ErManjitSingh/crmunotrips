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
    scroller.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-content-primary">More Announcements</h3>
          <p className="text-xs text-content-muted">Targets, policies, holidays & updates</p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => scrollBy(-1)} className="rounded-lg border border-subtle bg-surface p-1.5 hover:bg-surface-elevated">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => scrollBy(1)} className="rounded-lg border border-subtle bg-surface p-1.5 hover:bg-surface-elevated">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scroller} className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-thin snap-x snap-mandatory">
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
                'relative w-[240px] shrink-0 snap-start overflow-hidden rounded-[20px] border bg-gradient-to-br p-4 shadow-sm',
                theme.soft,
                theme.border
              )}
            >
              {!item.isRead && (
                <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.25)]" />
              )}
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70 text-lg shadow-sm dark:bg-slate-900/50">
                  {TYPE_EMOJI[item.type] || <Megaphone className="h-4 w-4" />}
                </div>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', item.priority === 'urgent' ? 'bg-red-500/15 text-red-600' : 'bg-white/60 text-content-muted dark:bg-slate-900/40')}>
                  {item.priority}
                </span>
              </div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-content-muted">
                {new Date(item.publishAt || item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </p>
              <h4 className="mt-1 line-clamp-2 text-sm font-semibold text-content-primary">{item.title}</h4>
              <p className="mt-1 line-clamp-2 text-xs text-content-secondary">{item.description}</p>
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
