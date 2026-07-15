import { Trophy } from 'lucide-react';

export default function LeadConvertedBanner({ status }) {
  if (status !== 'converted') return null;

  return (
    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800/40 px-5 py-4 flex items-center gap-3">
      <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0">
        <Trophy className="w-4 h-4" />
      </div>
      <div>
        <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Converted! Booking started for this lead.</p>
        <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
          Advance / balance details and payment voucher are below — customer gets the voucher by email.
        </p>
      </div>
    </div>
  );
}
