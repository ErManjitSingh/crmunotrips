import { useMemo } from 'react';
import {
  MapPin,
  Car,
  UtensilsCrossed,
  Hotel,
  Sparkles,
  Clock,
  IndianRupee,
  Percent,
  Save,
  FileText,
  MessageCircle,
  Mail,
  Printer,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
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
  draftLabel = 'Save Draft',
  submitLabel = 'Submit Quotation',
}) {
  const computed = useMemo(() => calculatePricing(pricing || {}), [pricing]);

  const update = (key, val) => {
    const next = { ...pricing, [key]: Number(val) || 0 };
    const calc = calculatePricing(next);
    onPricingChange?.({ ...next, total: calc.total, profitMargin: calc.profitMargin });
  };

  const rows = [
    { key: 'baseCost', label: 'Package Cost', icon: Sparkles },
    { key: 'hotelCost', label: 'Hotel Cost', icon: Hotel },
    { key: 'cabCost', label: 'Cab Cost', icon: Car },
    { key: 'activityCost', label: 'Activities', icon: MapPin },
    { key: 'taxes', label: 'Taxes / GST', icon: Percent },
    { key: 'markup', label: 'Markup', icon: IndianRupee },
    { key: 'discount', label: 'Discount', icon: Percent },
  ];

  return (
    <aside className="xl:sticky xl:top-4 space-y-4">
      <div className="rounded-[24px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)] overflow-hidden">
        <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 px-5 py-4 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">Choose your package</p>
          <h3 className="text-lg font-bold mt-1 leading-snug line-clamp-2">{pkg?.name || 'Package'}</h3>
          <p className="text-xs text-white/75 mt-1.5">
            {nights != null ? `${nights} Nights` : '—'} / {daysCount || '—'} Days
            {pkg?.destination ? ` · ${pkg.destination}` : ''}
          </p>
        </div>

        {lead && (
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/80">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Lead</p>
            <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {[lead.phone, lead.email].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="text-[11px] text-slate-500">
              {lead.adults || 0}A · {lead.children || 0}C · Travel {lead.travelDate ? new Date(lead.travelDate).toLocaleDateString('en-IN') : '—'}
            </p>
          </div>
        )}

        <div className="px-5 py-4 space-y-2.5">
          {rows.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </span>
              <input
                type="number"
                min={0}
                value={pricing?.[key] || ''}
                onChange={(e) => update(key, e.target.value)}
                className="w-[110px] h-8 rounded-lg border border-slate-200 px-2 text-right text-sm font-semibold metric-tabular focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          ))}
        </div>

        <div className="px-5 pb-4">
          <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">Grand Total</p>
            <motion.p
              key={computed.total}
              initial={{ opacity: 0.4, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl font-black text-violet-700 metric-tabular mt-1"
            >
              {formatINR(computed.total)}
            </motion.p>
            <div className="flex justify-between mt-2 text-[11px]">
              <span className="text-slate-500">Margin</span>
              <span className="font-semibold text-emerald-600">{computed.profitMargin}%</span>
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
            {saving ? 'Saving…' : submitLabel}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSaveDraft}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            {draftLabel}
          </button>
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[
              { icon: FileText, label: 'Preview', onClick: onPreview },
              { icon: MessageCircle, label: 'WA', onClick: onPreview },
              { icon: Mail, label: 'Email', onClick: onPreview },
              { icon: Printer, label: 'Print', onClick: () => window.print() },
            ].map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={a.onClick}
                className="flex flex-col items-center gap-1 rounded-xl border border-slate-100 py-2 text-[10px] font-medium text-slate-500 hover:border-violet-200 hover:text-violet-600"
              >
                <a.icon className="w-4 h-4" />
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 space-y-1.5">
        <p className="font-semibold text-slate-700 inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-violet-500" /> Live pricing
        </p>
        <p>Hotel, cab and activity costs update automatically as you customize the package.</p>
      </div>
    </aside>
  );
}
