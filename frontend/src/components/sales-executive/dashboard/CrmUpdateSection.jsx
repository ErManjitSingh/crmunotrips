import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarDays,
  Gift,
  IndianRupee,
  Package,
  PartyPopper,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { formatCurrency } from '../executiveUtils';

const FALLBACK_WHATS_NEW = [
  { id: '1', title: 'Team Outing', type: 'outing', icon: Users },
  { id: '2', title: 'Independence Day Holiday', type: 'holiday', icon: PartyPopper },
  { id: '3', title: 'New Incentive Scheme', type: 'incentive', icon: Gift },
  { id: '4', title: 'Product Update', type: 'product', icon: Rocket },
];

function iconForType(type = '') {
  const t = String(type).toLowerCase();
  if (t.includes('holiday')) return PartyPopper;
  if (t.includes('contest') || t.includes('outing') || t.includes('event')) return Users;
  if (t.includes('promo') || t.includes('incentive') || t.includes('offer')) return Gift;
  if (t.includes('product') || t.includes('feature') || t.includes('update')) return Rocket;
  return Sparkles;
}

function monthLabel(date = new Date()) {
  return date.toLocaleDateString('en-IN', { month: 'long' });
}

function monthEndLabel(date = new Date()) {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return end.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function TargetChip({ icon: Icon, label, value, tone = 'violet' }) {
  const tones = {
    violet: 'border-violet-100 bg-violet-50/80 text-violet-800',
    amber: 'border-amber-100 bg-amber-50/80 text-amber-800',
    emerald: 'border-emerald-100 bg-emerald-50/80 text-emerald-800',
    rose: 'border-rose-100 bg-rose-50/80 text-rose-800',
  };
  return (
    <div className={`rounded-xl border px-2.5 py-2 ${tones[tone] || tones.violet}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0 opacity-80" />
        <span className="truncate text-[9px] font-bold uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-bold tabular-nums tracking-tight">{formatCurrency(value)}</p>
    </div>
  );
}

/**
 * Full-width CRM Update block — Important Announcement (target) + What's New.
 */
export default function CrmUpdateSection({
  target,
  announcements = [],
  now = new Date(),
  viewAllTo = '/sales-executive/follow-ups',
}) {
  const progress = Math.min(100, Number(target?.progress || 0));
  const monthlyTarget = Number(target?.monthlyTarget || target?.totalSalesTarget || target?.revenueTarget || 0);
  const revenueAchieved = Number(target?.revenueAchieved || 0);
  const revenueTarget = Number(target?.revenueTarget || monthlyTarget || 0);
  const packageTarget = Number(target?.packageTarget || 0);
  const totalSalesTarget = Number(target?.totalSalesTarget || monthlyTarget || 0);
  const profitTarget = Number(target?.profitTarget || 0);
  const month = monthLabel(now);
  const setBy = target?.setByName ? `Set by ${target.setByName}` : 'Assigned by your manager';

  const whatsNew = (announcements.length ? announcements : FALLBACK_WHATS_NEW)
    .slice(0, 4)
    .map((item, index) => ({
      id: item._id || item.id || String(index),
      title: item.title || 'Update',
      type: item.type || 'update',
      icon: item.icon || iconForType(item.type || item.title),
    }));

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-violet-200/70 bg-white shadow-md shadow-violet-500/10"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 bg-gradient-to-r from-[#4c1d95] via-[#6d28d9] to-[#7c3aed] px-4 py-3.5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Sparkles className="h-4 w-4 text-amber-200" />
            </span>
            <h2 className="truncate text-base font-bold tracking-wide sm:text-lg">CRM UPDATE</h2>
          </div>
          <p className="mt-1 truncate text-xs text-violet-100/90 sm:text-[13px]">
            Stay informed. Stay ahead. Achieve more. 🚀
          </p>
        </div>
        <Link
          to={viewAllTo}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-xl border border-white/30 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 sm:self-auto"
        >
          View All Updates
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Body */}
      <div className="grid gap-3 bg-[#f6f3ff] p-3 sm:p-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)]">
        {/* Important announcement */}
        <div className="min-w-0 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-600">
            Important Announcement
          </p>
          <h3 className="mt-1.5 text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            {month} Sales Targets are Live! 🎯
          </h3>
          <p className="mt-1 truncate text-xs text-slate-500">
            Hit your goals and unlock executive incentives. · {setBy}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <TargetChip icon={IndianRupee} label="Revenue" value={revenueTarget} tone="violet" />
            <TargetChip icon={Package} label="Package" value={packageTarget} tone="amber" />
            <TargetChip icon={TrendingUp} label="Total Sales" value={totalSalesTarget} tone="emerald" />
            <TargetChip icon={Target} label="Profit" value={profitTarget} tone="rose" />
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-xl border border-violet-100 bg-gradient-to-br from-white to-fuchsia-50/60 p-3">
            <div
              className="relative flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#7c3aed ${progress * 3.6}deg, #ede9fe 0deg)`,
              }}
            >
              <div className="flex h-[48px] w-[48px] flex-col items-center justify-center rounded-full bg-white shadow-inner">
                <span className="text-sm font-bold leading-none text-violet-700">{progress}%</span>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Target Progress
              </p>
              <p className="mt-1 truncate text-sm font-bold tabular-nums text-slate-900">
                {formatCurrency(revenueAchieved)}
                <span className="font-medium text-slate-400"> / {formatCurrency(monthlyTarget)}</span>
              </p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500">
                <CalendarDays className="h-3 w-3 shrink-0" />
                Ends {monthEndLabel(now)} · {target?.leadsConverted || 0} converted
              </p>
            </div>
          </div>
        </div>

        {/* What's new */}
        <div className="min-w-0 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
              What&apos;s New
            </p>
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
              New
            </span>
          </div>

          <ul className="space-y-1.5">
            {whatsNew.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id} className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-violet-50/80">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[12px] font-semibold text-slate-800">
                      {item.title}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </motion.section>
  );
}
