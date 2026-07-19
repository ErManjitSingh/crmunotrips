import { calculatePricing, formatINR } from './quotationUtils';

const FIELDS = [
  { key: 'hotelCost', label: 'Hotel Cost', color: 'border-amber-400/30 bg-amber-500/5', readOnly: true },
  { key: 'cabCost', label: 'Transport Cost', color: 'border-emerald-400/30 bg-emerald-500/5', readOnly: true },
  { key: 'activityCost', label: 'Activities', color: 'border-indigo-400/30 bg-indigo-500/5', readOnly: true },
  { key: 'taxes', label: 'GST (5%)', color: 'border-violet-400/30 bg-violet-500/5', readOnly: true },
  { key: 'markup', label: 'Markup', color: 'border-green-400/30 bg-green-500/5', readOnly: true },
  { key: 'discount', label: 'Discount', color: 'border-red-400/30 bg-red-500/5' },
];

export default function QuotePricingPanel({ pricing, onChange, readOnly = false }) {
  const computed = calculatePricing(pricing || {});

  const apply = (partial) => {
    const next = { ...pricing, ...partial };
    const calc = calculatePricing(next);
    onChange?.({
      ...next,
      taxes: calc.taxes,
      markup: calc.markup,
      total: calc.total,
      profitMargin: calc.profitMargin,
    });
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <label className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 cursor-pointer">
          <div>
            <p className="text-sm font-semibold text-slate-800">Add 5% GST</p>
            <p className="text-xs text-slate-500">Optional — sales executive choice</p>
          </div>
          <input
            type="checkbox"
            checked={Boolean(pricing?.gstEnabled)}
            onChange={(e) => apply({ gstEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-violet-300 text-violet-600"
          />
        </label>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {FIELDS.map(({ key, label, color, readOnly: fieldReadOnly }) => (
          <div key={key} className={`p-3 rounded-xl border ${color}`}>
            <label className="text-[10px] uppercase font-semibold text-content-muted">{label}</label>
            {readOnly || fieldReadOnly ? (
              <p className="text-lg font-bold text-content-primary metric-tabular mt-1">
                {formatINR(key === 'taxes' ? computed.taxes : key === 'markup' ? computed.markup : pricing?.[key])}
              </p>
            ) : (
              <input
                type="number"
                min={0}
                value={pricing?.[key] || ''}
                onChange={(e) => apply({ [key]: Number(e.target.value) || 0 })}
                className="input-premium w-full h-10 rounded-lg text-sm font-bold metric-tabular mt-1"
              />
            )}
          </div>
        ))}

        {!readOnly && (
          <div className="p-3 rounded-xl border border-green-400/30 bg-green-500/5">
            <label className="text-[10px] uppercase font-semibold text-content-muted">Markup %</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={pricing?.markupPercent || ''}
              onChange={(e) => apply({ markupPercent: Number(e.target.value) || 0 })}
              className="input-premium w-full h-10 rounded-lg text-sm font-bold metric-tabular mt-1"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 to-teal-500/10">
          <p className="text-xs font-semibold uppercase text-emerald-600">You Save</p>
          <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300 metric-tabular mt-1">
            {formatINR(computed.youSave || pricing?.discount || 0)}
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-brand-400/30 bg-gradient-to-br from-brand-500/15 to-indigo-500/10">
          <p className="text-xs font-semibold uppercase text-brand-600">Total Quote Amount</p>
          <p className="text-3xl font-black text-brand-700 dark:text-brand-300 metric-tabular mt-1">{formatINR(computed.total)}</p>
        </div>
        <div className="p-5 rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10">
          <p className="text-xs font-semibold uppercase text-violet-600">Profit Margin</p>
          <p className="text-3xl font-black text-violet-700 dark:text-violet-300 metric-tabular mt-1">{computed.profitMargin}%</p>
        </div>
      </div>
    </div>
  );
}
