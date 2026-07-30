import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, FileText, Sparkles, Zap } from 'lucide-react';
import { cn } from '../../../lib/utils';

const FEATURES = [
  { icon: Sparkles, label: 'Executive Incentives*' },
  { icon: Zap, label: 'Instant Quotes' },
  { icon: CheckCircle2, label: '2 Payments Closed — Earn ₹500*' },
];

const MOCK_QUOTE = {
  id: '#QT-2026-0001',
  customer: 'Rahul Sharma',
  destination: 'Manali, Himachal',
  travelDate: '15 Aug 2026',
  amount: '₹28,500',
};

/**
 * CRM Update promo — Quotation Builder dashboard banner.
 * `half` = stacked layout for 50% column next to Destination-wise.
 */
export default function QuotationBuilderPromoBanner({
  to = '/sales-executive/quotations/new',
  compact = false,
  half = false,
}) {
  if (compact) {
    return (
      <Link
        to={to}
        className="relative mt-4 block overflow-hidden rounded-2xl bg-gradient-to-br from-[#5b21b6] via-[#7c3aed] to-[#a855f7] p-4 text-white shadow-lg shadow-violet-500/20"
      >
        <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-violet-100/90">CRM Update</p>
        <h2 className="mt-1 text-base font-bold tracking-tight">Quotation Builder</h2>
        <p className="mt-1 text-[11px] leading-snug text-white/80">
          Create customized quotations in minutes and earn incentives on closed payments.
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-violet-700">
          Explore Quotation Builder
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-violet-100/80 bg-white shadow-md shadow-violet-500/10',
        half && 'flex h-full min-h-[320px] flex-col'
      )}
    >
      <div
        className={cn(
          half ? 'grid flex-1 grid-rows-[auto_1fr]' : 'grid lg:grid-cols-[1.15fr_0.85fr]'
        )}
      >
        {/* Purple promo */}
        <div
          className={cn(
            'relative overflow-hidden bg-gradient-to-br from-[#4c1d95] via-[#6d28d9] to-[#a855f7] text-white',
            half ? 'px-4 py-4' : 'px-5 py-5 sm:px-6 sm:py-6'
          )}
        >
          <div className="pointer-events-none absolute -left-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-fuchsia-400/25 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/10 blur-2xl" />

          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-100">
              <Sparkles className="h-3 w-3 text-amber-200" />
              CRM Update
            </span>

            <h2
              className={cn(
                'mt-2 font-bold tracking-tight',
                half ? 'text-xl' : 'mt-3 text-2xl sm:text-[28px]'
              )}
            >
              Quotation Builder
            </h2>
            <p
              className={cn(
                'mt-1.5 leading-relaxed text-violet-100/90',
                half ? 'text-xs' : 'mt-2 max-w-md text-sm'
              )}
            >
              Create customized quotations in minutes — package, hotels, transport &amp; pricing in one flow.
            </p>

            <div className={cn('mt-3 flex flex-wrap gap-1.5', !half && 'mt-4 gap-2')}>
              {FEATURES.map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/95 backdrop-blur-sm"
                >
                  <Icon className="h-3 w-3 text-amber-200" />
                  {label}
                </span>
              ))}
            </div>

            <Link
              to={to}
              className={cn(
                'mt-4 inline-flex items-center gap-2 rounded-xl bg-white font-bold text-violet-700 shadow-lg shadow-black/10 transition hover:bg-violet-50',
                half ? 'px-3 py-2 text-xs' : 'mt-5 px-4 py-2.5 text-sm'
              )}
            >
              Explore Quotation Builder
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Mock quotation card */}
        <div
          className={cn(
            'relative flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-violet-50/60',
            half ? 'px-4 py-4' : 'px-5 py-6 sm:px-6'
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(139,92,246,0.08),transparent_55%)]" />

          <div
            className={cn(
              'relative w-full rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_40px_-18px_rgba(91,33,182,0.35)]',
              half ? 'max-w-none p-3.5' : 'max-w-[280px] p-4'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Quotation</p>
                  <p className="text-sm font-bold text-slate-900">{MOCK_QUOTE.id}</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                Approved
              </span>
            </div>

            <dl className="mt-3 space-y-2 text-[11px]">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Customer</dt>
                <dd className="font-semibold text-slate-800">{MOCK_QUOTE.customer}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Destination</dt>
                <dd className="font-semibold text-slate-800">{MOCK_QUOTE.destination}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Travel Date</dt>
                <dd className="font-semibold text-slate-800">{MOCK_QUOTE.travelDate}</dd>
              </div>
              <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-2">
                <dt className="text-slate-400">Total Amount</dt>
                <dd className="text-base font-bold tracking-tight text-violet-700">{MOCK_QUOTE.amount}</dd>
              </div>
            </dl>

            <Link
              to={to}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-3 py-2 text-[11px] font-bold text-white shadow-md shadow-violet-500/25 transition hover:from-violet-500 hover:to-fuchsia-400"
            >
              Send to Customer
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
