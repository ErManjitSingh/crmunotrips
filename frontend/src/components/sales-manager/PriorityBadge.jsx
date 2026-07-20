import { Flame, Clock, Star } from 'lucide-react';
import { cn } from '../../lib/utils';

const configs = {
  urgent: { label: 'Urgent', icon: Clock, className: 'bg-gradient-to-r from-rose-500/25 to-red-500/15 text-rose-700 ring-rose-400/40 shadow-sm shadow-rose-500/10' },
  high: { label: 'High Budget', icon: Flame, className: 'bg-gradient-to-r from-amber-500/25 to-orange-500/15 text-amber-700 ring-amber-400/40 shadow-sm shadow-amber-500/10' },
  repeat: { label: 'Repeated Lead', icon: Star, className: 'bg-gradient-to-r from-violet-500/25 to-purple-500/15 text-violet-700 ring-violet-400/40 shadow-sm shadow-violet-500/10' },
  hot: { label: 'Hot', icon: Flame, className: 'bg-gradient-to-r from-orange-500/25 to-rose-500/15 text-orange-700 ring-orange-400/40 shadow-sm shadow-orange-500/10' },
};

export default function PriorityBadge({ lead, size = 'sm' }) {
  const tags = [];
  if (lead?.priority === 'urgent' || lead?.isUrgent) tags.push('urgent');
  if (lead?.isRepeatCustomer) tags.push('repeat');
  if (lead?.isHighBudget) tags.push('high');
  if (lead?.isHot && !tags.length) tags.push('hot');

  if (!tags.length) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.slice(0, 2).map((tag) => {
        const cfg = configs[tag];
        const Icon = cfg.icon;
        return (
          <span
            key={tag}
            className={cn(
              'inline-flex items-center gap-1 rounded-full font-semibold ring-1 ring-inset',
              size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
              cfg.className
            )}
          >
            <Icon className="w-3 h-3" /> {cfg.label}
          </span>
        );
      })}
    </div>
  );
}
