import { useMemo } from 'react';
import {
  Share2,
  Mail,
  MessageCircle,
  Printer,
  Save,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { calculatePricing, formatINR } from './quotationUtils';

export default function PackageBuilderPriceSidebar({
  lead,
  pkg,
  pricing,
  onPricingChange,
  nights,
  daysCount,
  onSaveDraft,
  onSubmit,
  onPreview,
  saving,
  draftLabel = 'Save as Draft',
  submitLabel = 'Review & Continue',
}) {
  const computed = useMemo(() => calculatePricing(pricing || {}), [pricing]);

  const update = (key, val) => {
    const next = { ...pricing, [key]: Number(val) || 0 };
    const calc = calculatePricing(next);
    onPricingChange?.({ ...next, total: calc.total, profitMargin: calc.profitMargin });
  };

  const subtotalBeforeDiscount =
    Number(pricing?.baseCost || 0) +
    Number(pricing?.hotelCost || 0) +
    Number(pricing?.cabCost || 0) +
    Number(pricing?.flightCost || 0) +
    Number(pricing?.activityCost || 0) +
    Number(pricing?.taxes || 0) +
    Number(pricing?.markup || 0);

  const discount = Number(pricing?.discount || 0);
  const savePct =
    subtotalBeforeDiscount > 0 && discount > 0
      ? Math.round((discount / subtotalBeforeDiscount) * 100)
      : 0;

  const rows = [
    { key: 'baseCost', label: 'Basic Package Cost' },
    { key: 'cabCost', label: 'Transport Cost' },
    { key: 'hotelCost', label: 'Hotel Cost' },
    { key: 'activityCost', label: 'Activity Cost' },
    { key: 'taxes', label: 'Taxes & Fees' },
    { key: 'discount', label: 'Discount', negative: true },
    { key: 'markup', label: 'Markup' },
  ];

  return (
    <aside className="xl:sticky xl:top-4 space-y-3">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Package Summary</p>
          <div className="flex items-end gap-2 mt-2 flex-wrap">
            <motion.p
              key={computed.total}
              initial={{ opacity: 0.5, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-black text-slate-900 metric-tabular leading-none"
            >
              {formatINR(computed.total)}
            </motion.p>
            {savePct > 0 && (
              <span className="mb-0.5 inline-flex text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                {savePct}% OFF
              </span>
            )}
          </div>
          {discount > 0 && (
            <p className="text-sm text-slate-400 line-through metric-tabular mt-1">
              {formatINR(subtotalBeforeDiscount)}
            </p>
          )}
          <p className="text-[11px] text-slate-500 mt-2">
            {nights != null ? `${nights} Nights` : '—'} / {daysCount || '—'} Days
            {pkg?.destination ? ` · ${pkg.destination}` : ''}
          </p>
          {lead && (
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              For {lead.name} · {lead.adults || 0}A/{lead.children || 0}C
            </p>
          )}
        </div>

        <div className="px-5 py-4 space-y-2.5">
          {rows.map(({ key, label, negative }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">{label}</span>
              <input
                type="number"
                min={0}
                value={pricing?.[key] || ''}
                onChange={(e) => update(key, e.target.value)}
                className={`w-[108px] h-8 rounded-lg border border-slate-200 px-2 text-right text-sm font-semibold metric-tabular focus:outline-none focus:ring-2 focus:ring-violet-500/20 ${
                  negative ? 'text-emerald-600' : 'text-slate-800'
                }`}
              />
            </div>
          ))}
        </div>

        <div className="px-5 pb-4">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2.5 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">You Save</p>
              <p className="text-sm font-bold text-emerald-700 metric-tabular">
                {formatINR(discount)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total Margin</p>
              <p className="text-sm font-bold text-slate-800">{computed.profitMargin}%</p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-2">
          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold shadow-md shadow-violet-600/25 transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : submitLabel || 'Review & Continue'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSaveDraft}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {draftLabel}
          </button>

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[
              { icon: Share2, label: 'Share', onClick: onPreview },
              { icon: Mail, label: 'Mail', onClick: onPreview },
              { icon: MessageCircle, label: 'WhatsApp', onClick: onPreview },
              { icon: Printer, label: 'Print', onClick: () => window.print() },
            ].map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                title={a.label}
                className="flex flex-col items-center gap-1 rounded-xl border border-slate-100 py-2 text-[9px] font-medium text-slate-500 hover:border-violet-200 hover:text-violet-600"
              >
                <a.icon className="w-4 h-4" />
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 text-center px-2 leading-relaxed">
        Live pricing — hotel, cab and activity costs update as you customize.
      </p>
    </aside>
  );
}
