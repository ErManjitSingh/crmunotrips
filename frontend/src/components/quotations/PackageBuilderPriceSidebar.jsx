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
import ActionTile from '../ui/ActionTile';

const READONLY_COST_KEYS = new Set(['hotelCost', 'cabCost', 'activityCost', 'flightCost', 'baseCost']);

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
}) {
  const computed = useMemo(() => calculatePricing(pricing || {}), [pricing]);
  const youSave = Number(computed.youSave ?? pricing?.discount ?? 0) || 0;

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

  const subtotalBeforeDiscount = Number(computed.subtotal || 0);
  const savePct =
    subtotalBeforeDiscount > 0 && youSave > 0
      ? Math.round((youSave / subtotalBeforeDiscount) * 100)
      : 0;

  const rows = [
    { key: 'hotelCost', label: 'Hotel Cost', readOnly: true },
    { key: 'cabCost', label: 'Transport Cost', readOnly: true },
    { key: 'activityCost', label: 'Activities', readOnly: true },
    { key: 'taxes', label: 'GST (5%)', readOnly: true },
    { key: 'markup', label: 'Markup', readOnly: true },
  ];

  const actions = [
    { icon: Share2, label: 'Share', description: 'Share quotation', onClick: onShare, tone: 'sky' },
    { icon: Mail, label: 'Mail', description: 'Email customer', onClick: onMail, tone: 'violet' },
    { icon: MessageCircle, label: 'WhatsApp', description: 'Send WhatsApp', onClick: onWhatsApp, tone: 'green' },
    { icon: Printer, label: 'Print', description: 'Print / PDF', onClick: onPrint, tone: 'amber' },
  ];

  return (
    <aside className="xl:sticky xl:top-4 space-y-3">
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50 via-white to-fuchsia-50 shadow-[0_8px_30px_rgba(109,40,217,0.12)] overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-amber-400" />
        <div className="px-5 pt-5 pb-4 border-b border-violet-100 bg-gradient-to-br from-violet-600 to-indigo-700 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">Package Summary</p>
          <div className="flex items-end gap-2 mt-2 flex-wrap">
            <motion.p
              key={computed.total}
              initial={{ opacity: 0.5, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-black text-white metric-tabular leading-none"
            >
              {formatINR(computed.total)}
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
          <p className="text-[11px] text-violet-100 mt-2">
            {nights != null ? `${nights} Nights` : '—'} / {daysCount || '—'} Days
            {pkg?.destination ? ` · ${pkg.destination}` : ''}
          </p>
          {lead && (
            <p className="text-[11px] text-violet-100/80 mt-0.5 truncate">
              For {lead.name} · {lead.adults || 0}A/{lead.children || 0}C
            </p>
          )}
        </div>

        <div className="px-5 py-4 space-y-2.5 bg-white/60">
          <label className="flex items-center justify-between gap-3 rounded-lg bg-violet-50 border border-violet-100 px-2.5 py-2 cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-slate-700">Add 5% GST</p>
              <p className="text-[10px] text-slate-500">Optional — sales executive choice</p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(pricing?.gstEnabled)}
              onChange={(e) => applyPricing({ gstEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-violet-300 text-violet-600 focus:ring-violet-500"
            />
          </label>

          {rows.map(({ key, label, readOnly }) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50/80 border border-slate-100 px-2 py-1.5">
              <span className="text-xs font-semibold text-slate-600">{label}</span>
              {readOnly || READONLY_COST_KEYS.has(key) || key === 'taxes' || key === 'markup' ? (
                <span className="w-[108px] h-8 inline-flex items-center justify-end px-2 text-sm font-semibold metric-tabular text-slate-800">
                  {formatINR(key === 'taxes' ? computed.taxes : key === 'markup' ? computed.markup : pricing?.[key] || 0)}
                </span>
              ) : (
                <input
                  type="number"
                  min={0}
                  value={pricing?.[key] || ''}
                  onChange={(e) => updateNumber(key, e.target.value)}
                  className="w-[108px] h-8 rounded-lg border border-violet-200 bg-white px-2 text-right text-sm font-semibold metric-tabular focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-800"
                />
              )}
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50/80 border border-slate-100 px-2 py-1.5">
            <span className="text-xs font-semibold text-slate-600">Markup %</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={pricing?.markupPercent || ''}
              onChange={(e) => updateNumber('markupPercent', e.target.value)}
              className="w-[108px] h-8 rounded-lg border border-violet-200 bg-white px-2 text-right text-sm font-semibold metric-tabular focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-800"
              placeholder="0"
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-violet-50 border border-violet-100 px-2 py-2">
            <span className="text-xs font-bold text-violet-800">Total Cost</span>
            <span className="text-sm font-black text-violet-900 metric-tabular">{formatINR(computed.total + youSave)}</span>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50/80 border border-emerald-100 px-2 py-1.5">
            <span className="text-xs font-semibold text-emerald-700">Discount</span>
            <input
              type="number"
              min={0}
              value={pricing?.discount || ''}
              onChange={(e) => updateNumber('discount', e.target.value)}
              className="w-[108px] h-8 rounded-lg border border-emerald-200 bg-white px-2 text-right text-sm font-semibold metric-tabular text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
        </div>

        <div className="px-5 pb-4">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">You Save</p>
              <p className="text-sm font-bold text-emerald-700 metric-tabular">
                {formatINR(youSave)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">Final Total</p>
              <p className="text-sm font-bold text-violet-800 metric-tabular">{formatINR(computed.total)}</p>
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
            className="w-full h-10 rounded-xl border border-violet-200 bg-violet-50 text-sm font-semibold text-violet-700 hover:bg-violet-100 inline-flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {draftLabel}
          </button>
        </div>
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
