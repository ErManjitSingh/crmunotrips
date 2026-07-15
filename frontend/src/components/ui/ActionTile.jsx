import { cn } from '../../lib/utils';

/**
 * Shared quick-action card used on lead detail and package builder.
 */
export default function ActionTile({
  icon: Icon,
  label,
  description,
  onClick,
  href,
  disabled = false,
  tone = 'slate',
  className = '',
  title,
}) {
  const tones = {
    emerald: {
      wrap: 'border-emerald-100 bg-emerald-50/70 hover:bg-emerald-50 hover:border-emerald-200',
      icon: 'bg-emerald-100 text-emerald-700',
      label: 'text-emerald-900',
    },
    green: {
      wrap: 'border-green-100 bg-green-50/80 hover:bg-green-50 hover:border-green-200',
      icon: 'bg-green-100 text-green-700',
      label: 'text-green-900',
    },
    sky: {
      wrap: 'border-sky-100 bg-sky-50/80 hover:bg-sky-50 hover:border-sky-200',
      icon: 'bg-sky-100 text-sky-700',
      label: 'text-sky-900',
    },
    violet: {
      wrap: 'border-violet-100 bg-violet-50/80 hover:bg-violet-50 hover:border-violet-200',
      icon: 'bg-violet-100 text-violet-700',
      label: 'text-violet-900',
    },
    amber: {
      wrap: 'border-amber-100 bg-amber-50/80 hover:bg-amber-50 hover:border-amber-200',
      icon: 'bg-amber-100 text-amber-700',
      label: 'text-amber-900',
    },
    slate: {
      wrap: 'border-slate-200 bg-slate-50/80 hover:bg-slate-50 hover:border-slate-300',
      icon: 'bg-slate-200/80 text-slate-600',
      label: 'text-slate-800',
    },
  };

  const t = tones[tone] || tones.slate;
  const classes = cn(
    'group flex flex-col items-start gap-2 rounded-2xl border px-4 py-3.5 text-left transition-all',
    'shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30',
    t.wrap,
    disabled && 'opacity-45 pointer-events-none cursor-not-allowed',
    className
  );

  const body = (
    <>
      <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', t.icon)}>
        {Icon ? <Icon className="h-4 w-4" /> : null}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-sm font-bold leading-tight', t.label)}>{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{description}</span>
        ) : null}
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes} title={title || label} aria-disabled={disabled}>
        {body}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={classes} title={title || label}>
      {body}
    </button>
  );
}
