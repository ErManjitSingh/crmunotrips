import { cn } from '../../lib/utils';
import { LIST_PERIOD_PRESETS, activePeriodPreset } from '../../lib/periodFilters';

/** Per-preset chip colors for Lead filters (and reusable elsewhere). */
const PRESET_COLORS = {
  today: {
    active: 'bg-sky-500 text-white shadow-sm shadow-sky-500/30 ring-1 ring-sky-600/20',
    idle: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100',
  },
  yesterday: {
    active: 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/30 ring-1 ring-indigo-600/20',
    idle: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100',
  },
  month: {
    active: 'bg-fuchsia-500 text-white shadow-sm shadow-fuchsia-500/30 ring-1 ring-fuchsia-600/20',
    idle: 'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200 hover:bg-fuchsia-100',
  },
  all: {
    active: 'bg-slate-700 text-white shadow-sm shadow-slate-700/30 ring-1 ring-slate-800/20',
    idle: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200/80',
  },
};

const FALLBACK = {
  active: 'bg-violet-600 text-white shadow-sm shadow-violet-500/25',
  idle: 'bg-slate-100 text-slate-600 hover:bg-violet-50 hover:text-violet-700',
};

export default function PeriodPresetChips({
  dateFrom = '',
  dateTo = '',
  onSelect,
  className,
  accent = 'sky',
  colorful = false,
}) {
  const active = activePeriodPreset({ dateFrom, dateTo });
  const defaultActive =
    accent === 'violet'
      ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/25'
      : 'bg-sky-600 text-white shadow-sm shadow-sky-500/20';
  const defaultIdle =
    accent === 'violet'
      ? 'bg-slate-100 text-slate-600 hover:bg-violet-50 hover:text-violet-700'
      : 'bg-slate-50 text-slate-600 hover:bg-sky-50 hover:text-sky-700';

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      role="group"
      aria-label="Date period"
    >
      {LIST_PERIOD_PRESETS.map((preset) => {
        const isActive = active === preset.key;
        const palette = colorful ? PRESET_COLORS[preset.key] || FALLBACK : null;
        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => onSelect?.(preset.key)}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition',
              colorful
                ? isActive
                  ? palette.active
                  : palette.idle
                : isActive
                  ? defaultActive
                  : defaultIdle
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
