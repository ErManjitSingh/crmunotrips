import { cn } from '../../lib/utils';

export default function WizardField({ label, required, error, hint, children, className }) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label className="block text-[11px] font-medium text-content-secondary">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-[10px] text-content-muted leading-tight">{hint}</p>}
      {error && <p className="text-[10px] text-red-500 font-medium">{error}</p>}
    </div>
  );
}

export function WizardInput({ className, error, ...props }) {
  return (
    <input
      className={cn(
        'input-premium w-full h-10 rounded-xl text-sm',
        error && 'border-red-500/50 focus:ring-red-500/30',
        className
      )}
      {...props}
    />
  );
}

export function WizardSelect({ className, error, children, ...props }) {
  return (
    <select
      className={cn(
        'input-premium w-full h-10 rounded-xl text-sm',
        error && 'border-red-500/50 focus:ring-red-500/30',
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
        'input-premium w-full rounded-xl text-sm resize-none min-h-[100px]',
        error && 'border-red-500/50 focus:ring-red-500/30',
        className
      )}
      {...props}
    />
  );
}
