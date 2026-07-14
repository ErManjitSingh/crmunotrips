import { motion } from 'framer-motion';
import { Gift, Trophy, Flame, PartyPopper, Megaphone, Target } from 'lucide-react';
import { getAnnouncementTheme } from './announcementThemes';
import { cn } from '../../lib/utils';

const SECTIONS = [
  { key: 'activeIncentive', title: 'Active Incentive', icon: Gift, emoji: '🎯' },
  { key: 'runningContest', title: 'Running Contest', icon: Flame, emoji: '🔥' },
  { key: 'target', title: 'Target Focus', icon: Target, emoji: '🏆' },
  { key: 'holiday', title: 'Upcoming Holiday', icon: PartyPopper, emoji: '🎉' },
  { key: 'latestAnnouncement', title: 'Latest Announcement', icon: Megaphone, emoji: '📢' },
];

export default function AnnouncementSidebar({ highlights = {}, onOpen }) {
  const cards = SECTIONS.map((s) => ({ ...s, data: highlights?.[s.key] })).filter((s) => s.data);

  if (!cards.length) {
    return (
      <aside className="rounded-2xl border border-subtle bg-surface p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-content-primary">Today&apos;s Highlights</h3>
        <p className="mt-2 text-xs text-content-muted">No active promotions yet.</p>
      </aside>
    );
  }

  return (
    <aside className="sticky top-20 space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Trophy className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-content-primary">Today&apos;s Highlights</h3>
      </div>
      {cards.map((card, i) => {
        const theme = getAnnouncementTheme(card.data.type);
        const Icon = card.icon;
        return (
          <motion.button
            key={card.key}
            type="button"
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -2 }}
            onClick={() => onOpen?.(card.data)}
            className={cn(
              'w-full rounded-2xl border bg-gradient-to-br p-3.5 text-left shadow-sm transition-shadow hover:shadow-md',
              theme.soft,
              theme.border
            )}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-base">{card.emoji}</span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-content-muted">{card.title}</p>
              <Icon className={cn('ml-auto h-3.5 w-3.5', theme.accent)} />
            </div>
            <p className="line-clamp-2 text-sm font-semibold text-content-primary">{card.data.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-content-secondary">{card.data.description}</p>
          </motion.button>
        );
      })}
    </aside>
  );
}
