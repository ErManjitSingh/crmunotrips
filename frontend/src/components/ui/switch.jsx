import { cn } from '../../lib/utils';

const SIZES = {
  sm: {
    track: 'h-5 w-9',
    thumb: 'h-3.5 w-3.5',
    on: 'translate-x-4',
    off: 'translate-x-0',
  },
  md: {
    track: 'h-6 w-11',
    thumb: 'h-5 w-5',
    on: 'translate-x-5',
    off: 'translate-x-0',
  },
  lg: {
    track: 'h-7 w-12',
    thumb: 'h-5 w-5',
    on: 'translate-x-6',
    off: 'translate-x-0',
  },
};

const TONES = {
  brand: {
    on: 'bg-gradient-to-r from-brand-600 to-indigo-600',
    off: 'bg-slate-300 dark:bg-slate-600',
    ring: 'focus-visible:ring-brand-500/40',
  },
  violet: {
    on: 'bg-violet-600',
    off: 'bg-slate-300 dark:bg-slate-600',
    ring: 'focus-visible:ring-violet-500/40',
  },
  emerald: {
    on: 'bg-emerald-500',
    off: 'bg-slate-300 dark:bg-slate-600',
    ring: 'focus-visible:ring-emerald-500/40',
  },
  amber: {
    on: 'bg-emerald-600',
    off: 'bg-slate-300 dark:bg-slate-600',
    ring: 'focus-visible:ring-amber-500/40',
  },
};

/**
 * Accessible ON/OFF switch used across the CRM.
 * Uses border + flex alignment so the thumb never clips or sticks to the top.
 */
export function Switch({
  checked = false,
  onCheckedChange,
  disabled = false,
  loading = false,
  size = 'md',
  tone = 'brand',
  className,
  title,
  'aria-label': ariaLabel,
}) {
  const s = SIZES[size] || SIZES.md;
  const t = TONES[tone] || TONES.brand;
  const isOn = Boolean(checked);
  const isDisabled = disabled || loading;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={ariaLabel}
      title={title}
      disabled={isDisabled}
      onClick={() => {
        if (isDisabled) return;
        onCheckedChange?.(!isOn);
      }}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        s.track,
        t.ring,
        isOn ? t.on : t.off,
        isDisabled && 'cursor-not-allowed opacity-50',
        loading && 'cursor-wait',
        className
      )}
    >
      <span
        className={cn(
          'pointer-events-none block rounded-full bg-white shadow-md ring-0 transition-transform duration-200',
          s.thumb,
          isOn ? s.on : s.off,
          loading && 'opacity-80'
        )}
      />
      {loading && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        </span>
      )}
    </button>
  );
}

export default Switch;
