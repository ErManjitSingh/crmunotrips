import { Eye } from 'lucide-react';
import { Button } from '../ui/button';
import { formatDiscountLabel, formatINR } from './quotationUtils';

/**
 * Shows current vs previous quotation discount when a 2nd+ file is under review.
 */
export default function QuotationRevisionCompareBanner({
  quote,
  onViewPrevious,
  viewingPrevious = false,
}) {
  if (!quote?.isRevisionSubmission || !quote?.previousQuotation) return null;

  const current = quote.discountSummary || quote.pricing || {};
  const previous = quote.previousQuotation;
  const currentPct = Number(current.discountPercent ?? 0);
  const prevPct = Number(previous.discountPercent ?? 0);
  const delta = Math.round((currentPct - prevPct) * 10) / 10;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 space-y-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
          File #{quote.submissionIndex || 2} for approval
        </p>
        <p className="mt-1 text-sm text-amber-900/80">
          Compare discount on this file vs the previous quotation on the same lead.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-amber-200/80 bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">This file (now)</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-amber-800">
            {formatDiscountLabel(current)}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {quote.quoteNumber}
            {current.total ? ` · ${formatINR(current.total)}` : ''}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Previous file</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-slate-800">
            {formatDiscountLabel(previous)}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {previous.quoteNumber}
            {previous.total ? ` · ${formatINR(previous.total)}` : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700">
          {delta === 0
            ? 'Same discount % as previous file'
            : delta > 0
              ? `Discount increased by ${delta}% vs previous`
              : `Discount reduced by ${Math.abs(delta)}% vs previous`}
        </p>
        {onViewPrevious && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={viewingPrevious}
            onClick={onViewPrevious}
            className="h-8 gap-1.5 rounded-lg text-xs border-amber-300 text-amber-900 bg-white hover:bg-amber-100"
          >
            <Eye className="w-3.5 h-3.5" />
            {viewingPrevious ? 'Loading…' : 'View previous file'}
          </Button>
        )}
      </div>
    </div>
  );
}
