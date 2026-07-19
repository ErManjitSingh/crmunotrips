import { useWizardForm } from '../WizardFormContext';
import { motion } from 'framer-motion';
import { LEAD_SOURCES, PRIORITIES, getLeadSourcesForRole } from '../constants';
import { cn } from '../../../lib/utils';
import { useAuth } from '../../../context/AuthContext';
import { useSelector } from 'react-redux';
import { useMemo } from 'react';

export default function StepLeadInformation() {
  const { register, watch, setValue, formState: { errors } } = useWizardForm();
  const { user } = useAuth();
  const { availableBranches } = useSelector((s) => s.branch);
  const priority = watch('priority');
  const leadSource = watch('leadSource');
  const branchId = watch('branchId');
  const isAdmin = user?.role === 'admin';
  const sourceOptions = useMemo(() => {
    const base = getLeadSourcesForRole(user?.role);
    if (leadSource && !base.some((s) => s.value === leadSource)) {
      const current = LEAD_SOURCES.find((s) => s.value === leadSource);
      return current ? [current, ...base] : base;
    }
    return base;
  }, [user?.role, leadSource]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      className="space-y-6"
    >
      <div>
        <h2 className="text-xl font-bold text-content-primary">Lead Information</h2>
        <p className="text-sm text-content-muted mt-1">How did this lead come in and how urgent is it?</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-content-primary mb-3">
          Lead Source <span className="text-red-500">*</span>
        </label>
        {errors.leadSource && <p className="text-xs text-red-500 mb-2">{errors.leadSource.message}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {sourceOptions.map((src) => (
            <button
              key={src.value}
              type="button"
              onClick={() => setValue('leadSource', src.value)}
              className={cn(
                'p-3 rounded-xl border text-sm font-medium transition-all text-left',
                leadSource === src.value
                  ? 'border-brand-500/40 bg-brand-500/10 text-brand-700 dark:text-brand-400 ring-2 ring-brand-500/20'
                  : 'border-subtle bg-surface hover:bg-surface-elevated text-content-secondary'
              )}
            >
              {src.label}
            </button>
          ))}
        </div>
        <input type="hidden" {...register('leadSource')} />
      </div>

      <div>
        <label className="block text-sm font-medium text-content-primary mb-3">
          Priority <span className="text-red-500">*</span>
        </label>
        {errors.priority && <p className="text-xs text-red-500 mb-2">{errors.priority.message}</p>}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setValue('priority', p.value)}
              className={cn(
                'p-3 rounded-xl border text-sm font-semibold transition-all capitalize',
                priority === p.value ? p.color + ' ring-2 ring-offset-1 ring-current/20' : 'border-subtle bg-surface text-content-muted hover:bg-surface-elevated'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input type="hidden" {...register('priority')} />
      </div>

      {isAdmin && (
        <div>
          <label className="block text-sm font-medium text-content-primary mb-2">
            Lead Branch
          </label>
          <select
            value={branchId || ''}
            onChange={(e) => setValue('branchId', e.target.value)}
            className="input-premium w-full h-11 rounded-xl"
          >
            <option value="">Current selected branch</option>
            {availableBranches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
          <input type="hidden" {...register('branchId')} />
        </div>
      )}
    </motion.div>
  );
}
