import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { WIZARD_STEPS } from './constants';

export default function WizardStepProgress({ currentStep, onStepClick, maxReachable }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              'relative flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all',
              active && 'border-[#5D5FEF]/40 bg-white shadow-md shadow-[#5D5FEF]/10 ring-1 ring-[#5D5FEF]/15',
              !active && done && 'border-emerald-200 bg-emerald-50/60',
              !active && !done && 'border-slate-200 bg-white/70',
              reachable ? 'cursor-pointer hover:border-[#5D5FEF]/30' : 'opacity-50 cursor-not-allowed'
            )}
          >
            <div
              className={cn(
                'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all',
                active && 'bg-[#5D5FEF] text-white shadow-lg shadow-[#5D5FEF]/35',
                done && !active && 'bg-emerald-500 text-white',
                !done && !active && 'bg-slate-100 text-slate-400'
              )}
            >
              {done && !active ? (
                <Check className="w-5 h-5" strokeWidth={2.5} />
              ) : active ? (
                <Icon className="w-5 h-5" />
              ) : (
                <span className="text-sm font-bold">{step.id}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className={cn('text-sm font-bold leading-tight', active ? 'text-[#5D5FEF]' : 'text-slate-800')}>
                {step.title}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{step.subtitle}</p>
            </div>
            {active && (
              <motion.span
                layoutId="wizard-step-dot"
                className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#5D5FEF]"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
