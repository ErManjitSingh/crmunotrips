import { Info, CheckCircle2 } from 'lucide-react';

/** Shown when system-wide auto assignment is disabled */
export function AutoAssignOffBanner() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
      <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
      <div>
        <p className="font-semibold">Auto lead assignment is OFF</p>
        <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/90">
          New leads will stay unassigned until Admin, Sales Manager, or Team Leader assigns them manually.
          Destination and skill settings below are saved for later — they will not auto-assign until turned on again.
        </p>
      </div>
    </div>
  );
}

/** Shown when system-wide auto assignment is enabled */
export function AutoAssignOnBanner() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-950 dark:text-emerald-100">
      <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
      <div>
        <p className="font-semibold">Auto lead assignment is ON</p>
        <p className="mt-0.5 text-emerald-900/80 dark:text-emerald-200/90">
          New leads are assigned automatically by skill and destination rules when possible.
          Admin, Sales Manager, and Team Leader can still assign or reassign leads manually anytime.
        </p>
      </div>
    </div>
  );
}

export default AutoAssignOffBanner;
