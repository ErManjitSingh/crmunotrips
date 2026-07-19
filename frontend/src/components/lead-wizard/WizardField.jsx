import { cn } from '../../lib/utils';

export default function WizardField({ label, required, error, hint, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="block text-[12px] font-semibold text-slate-700">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[11px] text-slate-400 leading-tight">{hint}</p>}
      {error && <p className="text-[11px] text-rose-500 font-medium">{error}</p>}
    </div>
  );
}

export function WizardInput({ className, error, readOnly, disabled, ...props }) {
  return (
    <input
      className={cn(
        'w-full h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400',
        'focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/25 focus:border-[#5D5FEF]/50 transition-shadow',
        error && 'border-rose-300 focus:ring-rose-200 focus:border-rose-400',
        (readOnly || disabled) && 'bg-slate-100 text-slate-500 cursor-not-allowed',
        className
      )}
      readOnly={readOnly}
      disabled={disabled}
      {...props}
    />
  );
}

export function WizardSelect({ className, error, children, ...props }) {
  return (
    <select
      className={cn(
        'w-full h-11 rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800',
        'focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/25 focus:border-[#5D5FEF]/50 transition-shadow',
        error && 'border-rose-300 focus:ring-rose-200 focus:border-rose-400',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function WizardTextarea({ className, error, ...props }) {
  return (
    <textarea
      className={cn(
        'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 resize-none min-h-[88px]',
        'focus:outline-none focus:ring-2 focus:ring-[#5D5FEF]/25 focus:border-[#5D5FEF]/50 transition-shadow',
        error && 'border-rose-300 focus:ring-rose-200 focus:border-rose-400',
        className
      )}
      {...props}
    />
  );
}

/** Input with leading icon — matches Add Lead mockup fields */
export function IconInput({
  icon: Icon,
  className,
  error,
  readOnly,
  disabled,
  prefix,
  suffix,
  ...props
}) {
  return (
    <div
      className={cn(
        'flex items-center h-11 rounded-xl border border-slate-200 bg-white overflow-hidden',
        'focus-within:ring-2 focus-within:ring-[#5D5FEF]/25 focus-within:border-[#5D5FEF]/50 transition-shadow',
        error && 'border-rose-300 focus-within:ring-rose-200',
        (readOnly || disabled) && 'bg-slate-100'
      )}
    >
      {prefix || (
        Icon ? (
          <span className="pl-3 pr-1.5 text-slate-400 shrink-0">
            <Icon className="w-4 h-4" />
          </span>
        ) : null
      )}
      <input
        className={cn(
          'flex-1 min-w-0 h-full bg-transparent px-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none',
          !Icon && !prefix && 'pl-3.5',
          (readOnly || disabled) && 'text-slate-500 cursor-not-allowed',
          className
        )}
        readOnly={readOnly}
        disabled={disabled}
        {...props}
      />
      {suffix}
    </div>
  );
}

export function IconSelect({ icon: Icon, className, error, children, ...props }) {
  return (
    <div
      className={cn(
        'flex items-center h-11 rounded-xl border border-slate-200 bg-white overflow-hidden',
        'focus-within:ring-2 focus-within:ring-[#5D5FEF]/25 focus-within:border-[#5D5FEF]/50 transition-shadow',
        error && 'border-rose-300 focus-within:ring-rose-200'
      )}
    >
      {Icon && (
        <span className="pl-3 pr-1.5 text-slate-400 shrink-0">
          <Icon className="w-4 h-4" />
        </span>
      )}
      <select
        className={cn(
          'flex-1 min-w-0 h-full bg-transparent pr-3 text-sm text-slate-800 focus:outline-none appearance-none',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
