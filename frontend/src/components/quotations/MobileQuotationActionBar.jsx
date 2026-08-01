import { ChevronUp, Save } from 'lucide-react';
import { formatINR } from './quotationUtils';
import { cn } from '../../lib/utils';

/**
 * Fixed bottom action bar for Create Quotation on mobile.
 * Sits above the home indicator; pair with immersive layout (no bottom nav).
 */
export default function MobileQuotationActionBar({
  total = 0,
  saving = false,
  draftLabel = 'Draft',
  submitLabel = 'Submit',
  onOpenPricing,
  onSaveDraft,
  onSubmit,
  disableSubmit = false,
  needsResubmissionReason = false,
  resubmissionReason = '',
  onResubmissionReasonChange,
  className,
}) {
  const canSubmit = !disableSubmit && (!needsResubmissionReason || Boolean(String(resubmissionReason || '').trim()));

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-violet-100/80 bg-white/95 backdrop-blur-md',
        'px-3 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))]',
        'shadow-[0_-10px_32px_rgba(15,23,42,0.14)] xl:hidden',
        className,
      )}
    >
      {needsResubmissionReason && (
        <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800 mb-1">
            Reason for re-submission
          </p>
          <textarea
            value={resubmissionReason}
            onChange={(e) => onResubmissionReasonChange?.(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Why sending again for approval?"
            className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-400"
          />
        </div>
      )}

      {onOpenPricing ? (
        <button
          type="button"
          onClick={onOpenPricing}
          className="mb-2 flex w-full items-center justify-between gap-3 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-3.5 py-2.5"
        >
          <div className="min-w-0 text-left">
            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">Package Total</p>
            <p className="truncate text-lg font-black leading-tight text-violet-900 metric-tabular">
              {formatINR(total)}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 shadow-sm ring-1 ring-violet-100">
            Pricing
            <ChevronUp className="h-3.5 w-3.5" />
          </span>
        </button>
      ) : null}

      <div className="flex items-center gap-2">
        {onSaveDraft ? (
          <button
            type="button"
            disabled={saving}
            onClick={onSaveDraft}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3.5 text-sm font-semibold text-violet-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span className="max-w-[4.5rem] truncate sm:max-w-none">
              {String(draftLabel || 'Draft').replace(/^Save\s+(as\s+)?/i, '') || 'Draft'}
            </span>
          </button>
        ) : null}
        {canSubmit ? (
          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-violet-600 text-sm font-semibold text-white shadow-md shadow-violet-600/30 disabled:opacity-60"
          >
            {saving ? 'Saving…' : submitLabel}
          </button>
        ) : (
          <div className="flex h-11 flex-1 items-center justify-center rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 text-center text-[11px] font-semibold text-amber-800">
            Enter reason to unlock submit
          </div>
        )}
      </div>
    </div>
  );
}
