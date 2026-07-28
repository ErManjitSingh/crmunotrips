import { useState } from 'react';
import { Info, CheckCircle2 } from 'lucide-react';
import API from '../../api/axios';
import { toast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';

/**
 * Master switch for system-wide auto lead assignment.
 * ON  → new leads auto-assign by skill/destination rules
 * OFF → leads stay unassigned until manual assign
 */
export function AutoAssignMasterToggle({ enabled, onChange, canToggle = true }) {
  const [saving, setSaving] = useState(false);
  const isOn = enabled === true;

  const handleToggle = async () => {
    if (!canToggle || saving) return;
    const next = !isOn;
    setSaving(true);
    try {
      const r = await API.put(
        '/assignment/status',
        { leadAutoAssignmentEnabled: next },
        { skipSuccessToast: true }
      );
      const value = r.data?.leadAutoAssignmentEnabled === true;
      onChange?.(value);
      toast.success(
        value
          ? 'Auto lead assignment ON — new leads will assign automatically'
          : 'Auto lead assignment OFF — assign leads manually'
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update auto assignment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm',
        isOn
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100'
      )}
    >
      {isOn ? (
        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
      ) : (
        <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">
            Auto lead assignment is {isOn ? 'ON' : 'OFF'}
          </p>
          {canToggle && (
            <button
              type="button"
              role="switch"
              aria-checked={isOn}
              disabled={saving}
              onClick={handleToggle}
              className={cn(
                'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                isOn ? 'bg-emerald-600 focus-visible:ring-emerald-500' : 'bg-slate-300 focus-visible:ring-amber-500',
                saving && 'opacity-60 cursor-wait'
              )}
            >
              <span
                className={cn(
                  'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                  isOn ? 'translate-x-6' : 'translate-x-1'
                )}
              />
            </button>
          )}
        </div>
        <p
          className={cn(
            'mt-0.5',
            isOn
              ? 'text-emerald-900/80 dark:text-emerald-200/90'
              : 'text-amber-800/90 dark:text-amber-200/90'
          )}
        >
          {isOn
            ? 'New leads are assigned automatically by skill and destination rules when possible. Admin, Sales Manager, and Team Leader can still assign or reassign manually anytime.'
            : 'New leads stay unassigned until Admin, Sales Manager, or Team Leader assigns them manually. Destination and skill settings below are saved for later.'}
        </p>
      </div>
    </div>
  );
}

/** @deprecated Use AutoAssignMasterToggle */
export function AutoAssignOffBanner() {
  return <AutoAssignMasterToggle enabled={false} canToggle={false} />;
}

/** @deprecated Use AutoAssignMasterToggle */
export function AutoAssignOnBanner() {
  return <AutoAssignMasterToggle enabled canToggle={false} />;
}

export default AutoAssignMasterToggle;
