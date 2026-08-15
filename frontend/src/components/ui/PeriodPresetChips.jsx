import { cn } from '../../lib/utils';
import { LIST_PERIOD_PRESETS, activePeriodPreset } from '../../lib/periodFilters';

export default function PeriodPresetChips({
  dateFrom = '',
  dateTo = '',
  onSelect,
  className,
  accent = 'sky',
}) {
  const active = activePeriodPreset({ dateFrom, dateTo });
  const activeClass =
    accent === 'violet'
      ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/25'
      : 'bg-sky-600 text-white shadow-sm shadow-sky-500/20';
  const idleClass =
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
        return (
          <button
            key={preset.key}
            type="button"
            onClick={() => onSelect?.(preset.key)}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition',
              isActive ? activeClass : idleClass
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
