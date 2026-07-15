import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { WIZARD_STEPS } from './constants';

export default function WizardStepProgress({ currentStep, onStepClick, maxReachable }) {
  const progress = ((currentStep - 1) / Math.max(WIZARD_STEPS.length - 1, 1)) * 100;

  return (
    <div className="rounded-2xl border border-subtle bg-gradient-to-br from-surface via-surface to-brand-500/[0.04] backdrop-blur-sm p-3.5 sm:p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-content-muted">Add Lead</p>
          <p className="text-sm font-semibold text-content-primary mt-0.5">
            Step {currentStep} of {WIZARD_STEPS.length} — {WIZARD_STEPS[currentStep - 1]?.title}
          </p>
        </div>
        <span className="text-[11px] font-bold text-brand-600 bg-brand-500/10 px-2.5 py-1 rounded-full">
          {Math.round(progress)}%
        </span>
      </div>

      <div className="relative h-1.5 rounded-full bg-surface-elevated overflow-hidden mb-3.5">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-600 via-teal-500 to-amber-400"
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {WIZARD_STEPS.map((step) => {
          const Icon = step.icon;
          const done = step.id < currentStep;
          const active = step.id === currentStep;
          const reachable = step.id <= maxReachable;
          return (
            <button
              key={step.id}
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onStepClick?.(step.id)}
              className={cn(
                'flex items-center gap-2.5 p-2.5 rounded-xl transition-all text-left border',
                reachable && 'cursor-pointer hover:bg-surface-elevated/60',
                !reachable && 'opacity-40 cursor-not-allowed',
                active && 'border-brand-500/35 bg-brand-500/8 shadow-sm shadow-brand-600/10',
                !active && 'border-transparent'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center border transition-all shrink-0',
                  done && 'bg-brand-600 border-brand-600 text-white',
                  active && !done && 'bg-brand-500/10 border-brand-500/40 text-brand-600 ring-2 ring-brand-500/15',
                  !done && !active && 'bg-surface-elevated border-subtle text-content-muted'
                )}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              </div>
              <div className="min-w-0">
                <span className={cn('block text-xs font-semibold leading-tight', active ? 'text-brand-700 dark:text-brand-300' : 'text-content-primary')}>
                  {step.title}
                </span>
                <span className="block text-[10px] text-content-muted mt-0.5 truncate">{step.subtitle}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
