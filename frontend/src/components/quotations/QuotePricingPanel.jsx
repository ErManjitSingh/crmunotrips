import { calculatePricing, formatINR, getDisplayedCostBreakdown } from './quotationUtils';
import { resolvePartyOccupancy } from './partyCosting';

const COST_FIELDS = [
  { key: 'hotelCost', label: 'Package Cost', color: 'border-amber-400/30 bg-amber-500/5' },
  { key: 'transportCost', label: 'Cab Upgrade', color: 'border-emerald-400/30 bg-emerald-500/5' },
  { key: 'flightCost', label: 'Flight Cost', color: 'border-cyan-400/30 bg-cyan-500/5' },
  { key: 'activityCost', label: 'Activities Cost', color: 'border-indigo-400/30 bg-indigo-500/5' },
];

export default function QuotePricingPanel({ pricing, onChange, readOnly = false, lead = null }) {
  const breakdown = getDisplayedCostBreakdown(pricing || {});
  const party = pricing?.party || resolvePartyOccupancy(lead || {});
  const adults = Math.max(1, Number(party.adults) || 1);

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
      {(party.rooms || party.cabCount || adults > 1) && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-slate-600">
          <p className="font-semibold text-violet-800">Party costing</p>
          <p className="mt-0.5">
            {adults} adult{adults === 1 ? '' : 's'}
            {party.children ? ` · ${party.children} child` : ''}
            {' · '}{party.rooms || 1} room{party.mattresses ? ` + ${party.mattresses} mattress` : ''}
            {' · '}{party.cabCount || 1} cab
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {COST_FIELDS.map(({ key, label, color }) => {
          const amount = breakdown[key];
          if ((key === 'activityCost' || key === 'flightCost') && Number(amount || 0) === 0) {
            return null;
          }
          return (
            <div key={key} className={`p-3 rounded-xl border ${color}`}>
              <label className="text-[10px] uppercase font-semibold text-content-muted">{label}</label>
              <p className="text-lg font-bold text-content-primary metric-tabular mt-1">
                {formatINR(amount, { zeroLabel: 'Not included' })}
              </p>
            </div>
          );
        })}

        <div className="p-3 rounded-xl border border-green-400/30 bg-green-500/5">
          <label className="text-[10px] uppercase font-semibold text-content-muted">Your margin %</label>
          {readOnly ? (
            <p className="text-lg font-bold text-content-primary metric-tabular mt-1">
              {Number(pricing?.markupPercent || 0)}%
            </p>
          ) : (
            <input
              type="number"
              min={0}
              step={0.1}
              value={pricing?.markupPercent || ''}
              onChange={(e) => apply({ markupPercent: Number(e.target.value) || 0 })}
              className="input-premium w-full h-10 rounded-lg text-sm font-bold metric-tabular mt-1"
            />
          )}
        </div>

        {!readOnly && (
          <div className="p-3 rounded-xl border border-red-400/30 bg-red-500/5">
            <label className="text-[10px] uppercase font-semibold text-content-muted">Discount</label>
            <input
              type="number"
              min={0}
              value={pricing?.discount || ''}
              onChange={(e) => apply({ discount: Number(e.target.value) || 0 })}
              className="input-premium w-full h-10 rounded-lg text-sm font-bold metric-tabular mt-1"
            />
          </div>
        )}

        {readOnly && (
          <div className="p-3 rounded-xl border border-red-400/30 bg-red-500/5">
            <label className="text-[10px] uppercase font-semibold text-content-muted">Discount</label>
            <p className="text-lg font-bold text-content-primary metric-tabular mt-1">
              {formatINR(breakdown.discount, { zeroLabel: '—' })}
            </p>
          </div>
        )}

        <div className="p-3 rounded-xl border border-violet-400/30 bg-violet-500/5 col-span-2 sm:col-span-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <label className="text-[10px] uppercase font-semibold text-content-muted">GST (5%)</label>
              <p className="text-[10px] text-content-muted mt-0.5">On full package cost</p>
            </div>
            {!readOnly && (
              <input
                type="checkbox"
                checked={Boolean(pricing?.gstEnabled)}
                onChange={(e) => apply({ gstEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-violet-300 text-violet-600"
                title="Add 5% GST"
              />
            )}
          </div>
          <p className="text-lg font-bold text-content-primary metric-tabular mt-1">
            {formatINR(breakdown.taxes, { zeroLabel: 'Not included' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-brand-400/30 bg-gradient-to-br from-brand-500/15 to-indigo-500/10">
          <p className="text-xs font-semibold uppercase text-brand-600">Final Total Package Cost</p>
          <p className="text-3xl font-black text-brand-700 dark:text-brand-300 metric-tabular mt-1">
            {formatINR(breakdown.finalTotal)}
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10">
          <p className="text-xs font-semibold uppercase text-violet-600">Profit Margin</p>
          <p className="text-3xl font-black text-violet-700 dark:text-violet-300 metric-tabular mt-1">
            {calculatePricing(pricing || {}).profitMargin}%
          </p>
        </div>
      </div>
    </div>
  );
}
