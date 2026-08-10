import { cn } from '../../lib/utils';

export default function DashboardPanel({
  title,
  subtitle,
  action,
  children,
  className = '',
  noPadding = false,
  variant = 'default',
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-100 overflow-hidden',
        variant === 'default' && 'bg-white shadow-sm',
        variant === 'muted' && 'bg-surface-elevated/40',
        variant === 'hero' &&
          'bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 border-slate-800 text-white shadow-xl shadow-slate-900/20',
        className
      )}
    >
      {(title || action) && (
        <div
          className={cn(
            'flex items-start justify-between gap-4 px-5 pt-5 pb-0',
            variant === 'hero' && 'px-6 pt-6'
          )}
        >
          <div>
            {title && (
              <h2
                className={cn(
                  'text-[15px] font-semibold tracking-tight text-slate-900',
                  variant === 'hero' && 'text-white'
                )}
              >
                {title}
              </h2>
            )}
            {subtitle && (
              <p
                className={cn(
                  'mt-0.5 text-xs text-slate-400',
                  variant === 'hero' && 'text-slate-400'
                )}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      <div
        className={cn(
          !noPadding && 'p-5',
          variant === 'hero' && !noPadding && 'p-6 pt-4'
        )}
      >
        {children}
      </div>
    </div>
  );
}
