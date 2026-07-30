import { useMemo } from 'react';
import {
  Share2,
  Mail,
  MessageCircle,
  Printer,
  Save,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { calculatePricing, formatINR, getDisplayedCostBreakdown } from './quotationUtils';
import { perPersonFromTotal, resolvePartyOccupancy } from './partyCosting';
import ActionTile from '../ui/ActionTile';
import { cn } from '../../lib/utils';

export default function PackageBuilderPriceSidebar({
  lead,
  pkg,
  pricing,
  onPricingChange,
  nights,
  daysCount,
  onSaveDraft,
  onSubmit,
  onShare,
  onMail,
  onWhatsApp,
  onPrint,
  saving,
  draftLabel = 'Save as Draft',
  submitLabel = 'Review & Continue',
  hideActions = false,
  className = '',
}) {
  const breakdown = useMemo(() => getDisplayedCostBreakdown(pricing || {}), [pricing]);
  const youSave = Number(breakdown.youSave ?? pricing?.discount ?? 0) || 0;
  const party = pricing?.party || resolvePartyOccupancy(lead || {});
  const adults = Math.max(1, Number(party.adults) || 1);
  const perPerson = perPersonFromTotal(breakdown.finalTotal, adults);

  const applyPricing = (partial) => {
    const next = { ...pricing, ...partial };
    const calc = calculatePricing(next);
    onPricingChange?.({
      ...next,
      taxes: calc.taxes,
      markup: calc.markup,
      total: calc.total,
      profitMargin: calc.profitMargin,
    });
  };

  const updateNumber = (key, val) => {
    applyPricing({ [key]: Number(val) || 0 });
  };

  const subtotalBeforeDiscount = Number(breakdown.subtotalBeforeDiscount || 0);
  const savePct =
    subtotalBeforeDiscount > 0 && youSave > 0
      ? Math.round((youSave / subtotalBeforeDiscount) * 100)
      : 0;

  const rows = [
    { key: 'hotelCost', label: 'Hotel Cost' },
    { key: 'transportCost', label: 'Transport Cost' },
    { key: 'activityCost', label: 'Activities Cost' },
  ];

  const actions = [
    { icon: Share2, label: 'Share', description: 'Share quotation', onClick: onShare, tone: 'sky' },
    { icon: Mail, label: 'Mail', description: 'Email customer', onClick: onMail, tone: 'violet' },
    { icon: MessageCircle, label: 'WhatsApp', description: 'Send WhatsApp', onClick: onWhatsApp, tone: 'green' },
    { icon: Printer, label: 'Print', description: 'Print / PDF', onClick: onPrint, tone: 'amber' },
  ];

  const occupancyBits = [
    `${adults} Adult${adults === 1 ? '' : 's'}`,
    party.children ? `${party.children} Child${party.children === 1 ? '' : 'ren'}` : null,
    `${party.rooms || 1} Room${(party.rooms || 1) === 1 ? '' : 's'}`,
    party.mattresses ? `${party.mattresses} Mattress` : null,
    `${party.cabCount || 1} Cab${(party.cabCount || 1) === 1 ? '' : 's'}`,
  ].filter(Boolean);

  return (
    <aside className={cn('xl:sticky xl:top-4 space-y-3', className)}>
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50 via-white to-fuchsia-50 shadow-[0_8px_30px_rgba(109,40,217,0.12)] overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-400" />
        <div className="px-5 pt-5 pb-4 border-b border-violet-100 bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">Package Summary</p>
          <div className="flex items-end gap-2 mt-2 flex-wrap">
            <motion.p
              key={breakdown.finalTotal}
              initial={{ opacity: 0.5, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-black text-white metric-tabular leading-none"
            >
              {formatINR(breakdown.finalTotal)}
            </motion.p>
            {savePct > 0 && (
              <span className="mb-0.5 inline-flex text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-400 text-emerald-950">
                {savePct}% OFF
              </span>
            )}
          </div>
          {youSave > 0 && (
            <p className="text-sm text-white/50 line-through metric-tabular mt-1">
              {formatINR(subtotalBeforeDiscount)}
            </p>
          )}
          <div className="mt-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-100/80">
                Per person
              </span>
              <span className="text-lg font-bold metric-tabular text-white">{formatINR(perPerson)}</span>
            </div>
            <p className="mt-1 text-[10px] text-violet-100/75">
              Total for {adults} adult{adults === 1 ? '' : 's'}: {formatINR(breakdown.finalTotal)}
            </p>
          </div>
          <p className="text-[11px] text-violet-100 mt-2">
            {nights != null ? `${nights} Nights` : '—'} / {daysCount || '—'} Days
            {pkg?.destination ? ` · ${pkg.destination}` : ''}
          </p>
          {lead && (
            <p className="text-[11px] text-violet-100/80 mt-0.5 truncate">
              For {lead.name} · {occupancyBits.join(' · ')}
            </p>
          )}
        </div>

        <div className="px-5 py-4 space-y-2.5 bg-white/60">
          <div className="rounded-lg border border-violet-100 bg-violet-50/70 px-2.5 py-2 text-[10px] text-slate-600">
            <p className="font-semibold text-violet-800">Party costing</p>
            <p className="mt-0.5">
              Package @ {formatINR(party.perPersonRate || 0)}/adult · {party.rooms || 1} room
              {party.mattresses ? ` + ${party.mattresses} mattress` : ''} ·{' '}
              {party.cabCount || 1} cab
              {party.cabSeats ? ` (${party.cabSeats}-seater)` : ''}
            </p>
          </div>

          {rows.map(({ key, label }) => {
            const amount = breakdown[key] || 0;
            return (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50/80 border border-slate-100 px-2 py-1.5">
                <span className="text-xs font-semibold text-slate-600">{label}</span>
                <span className={cn(
                  'min-w-[108px] h-8 inline-flex items-center justify-end px-2 text-sm font-semibold metric-tabular',
                  Number(amount) === 0 ? 'text-slate-400' : 'text-slate-800'
                )}>
                  {formatINR(amount, { zeroLabel: 'Not included' })}
                </span>
              </div>
            );
          })}

          <div className="rounded-lg border border-green-100 bg-green-50/70 px-2 py-2 space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-green-800">Markup %</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={pricing?.markupPercent || ''}
                onChange={(e) => updateNumber('markupPercent', e.target.value)}
                className="w-[108px] h-8 rounded-lg border border-green-200 bg-white px-2 text-right text-sm font-semibold metric-tabular focus:outline-none focus:ring-2 focus:ring-green-500/20 text-slate-800"
                placeholder="0"
              />
            </div>
            <div className="flex items-center justify-between gap-3 px-0.5">
              <span className="text-[10px] font-medium text-green-700/80">Markup amount</span>
              <span className={cn(
                'text-sm font-semibold metric-tabular',
                Number(breakdown.markup) === 0 ? 'text-slate-400' : 'text-green-800'
              )}>
                {formatINR(breakdown.markup, { zeroLabel: '—' })}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50/80 border border-emerald-100 px-2 py-1.5">
            <span className="text-xs font-semibold text-emerald-700">Discount</span>
            <input
              type="number"
              min={0}
              value={pricing?.discount || ''}
              onChange={(e) => updateNumber('discount', e.target.value)}
              className="w-[108px] h-8 rounded-lg border border-emerald-200 bg-white px-2 text-right text-sm font-semibold metric-tabular text-emerald-700 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="rounded-lg border border-violet-100 bg-violet-50/80 px-2 py-2 space-y-1.5">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <p className="text-xs font-semibold text-slate-700">Add 5% GST</p>
                <p className="text-[10px] text-slate-500">On full package cost</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(pricing?.gstEnabled)}
                onChange={(e) => applyPricing({ gstEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500"
              />
            </label>
            <div className="flex items-center justify-between gap-3 px-0.5">
              <span className="text-[10px] font-medium text-violet-700/80">GST (5%)</span>
              <span className={cn(
                'text-sm font-semibold metric-tabular',
                Number(breakdown.taxes) === 0 ? 'text-slate-400' : 'text-violet-800'
              )}>
                {formatINR(breakdown.taxes, { zeroLabel: 'Not included' })}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 pb-4">
          <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2.5 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Per Person</p>
              <p className="text-sm font-bold text-emerald-700 metric-tabular">
                {formatINR(perPerson)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">
                Final Total ({adults} pax)
              </p>
              <p className="text-sm font-bold text-violet-800 metric-tabular">{formatINR(breakdown.finalTotal)}</p>
            </div>
          </div>
        </div>

        {!hideActions ? (
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
              className="w-full h-10 rounded-xl border border-violet-200 bg-violet-50 text-sm font-semibold text-violet-700 hover:bg-violet-100 inline-flex items-center justify-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {draftLabel}
            </button>
          </div>
        ) : (
          <div className="pb-2" />
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3.5 space-y-2.5">
        <div>
          <p className="text-sm font-bold text-slate-900">Share Quotation</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Send this package to the customer</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((a) => (
            <ActionTile
              key={a.label}
              icon={a.icon}
              label={a.label}
              description={a.description}
              tone={a.tone}
              onClick={a.onClick}
              disabled={!a.onClick}
              className="!px-3 !py-3"
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
