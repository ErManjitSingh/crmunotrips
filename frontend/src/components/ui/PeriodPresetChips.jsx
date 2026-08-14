import { cn } from '../../lib/utils';
import { LIST_PERIOD_PRESETS, activePeriodPreset } from '../../lib/periodFilters';

export default function PeriodPresetChips({
  dateFrom = '',
  dateTo = '',
  onSelect,
  className,
}) {
  const active = activePeriodPreset({ dateFrom, dateTo });

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
              isActive
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/20'
                : 'bg-slate-50 text-slate-600 hover:bg-sky-50 hover:text-sky-700'
            )}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
