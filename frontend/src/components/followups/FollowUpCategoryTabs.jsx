import { motion } from 'framer-motion';
import { FOLLOWUP_CATEGORY_OPTIONS } from './constants';

const TABS = [{ id: '', label: 'All' }, ...FOLLOWUP_CATEGORY_OPTIONS.map((c) => ({ id: c.value, label: c.label }))];

export default function FollowUpCategoryTabs({ value, onChange, layoutId = 'fu-cat-tab' }) {
  return (
    <div className="flex flex-wrap gap-2 p-1 rounded-xl bg-surface-elevated/50 border border-subtle w-fit">
      {TABS.map(({ id, label }) => (
        <button
          key={id || 'all'}
          type="button"
          onClick={() => onChange(id)}
          className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            value === id ? 'text-violet-600' : 'text-content-muted hover:text-content-primary'
          }`}
        >
          {value === id && (
            <motion.div layoutId={layoutId} className="absolute inset-0 bg-surface rounded-lg shadow-sm border border-subtle" />
          )}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}
