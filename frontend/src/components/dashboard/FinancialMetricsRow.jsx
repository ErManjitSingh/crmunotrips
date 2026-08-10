import {
  IndianRupee,
  Megaphone,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { cn } from '../../lib/utils';

function formatCurrency(n) {
  const amount = Number(n || 0);
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2).replace(/\.00$/, '')}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatRoi(n) {
  return `${Number(n || 0).toFixed(2)}x`;
}

const CARDS = [
  {
    key: 'marketingSpend',
    label: 'Marketing Spend',
    sub: 'Today',
    format: formatCurrency,
    compare: 'vs Yesterday',
    icon: Megaphone,
    iconBg: 'bg-violet-100 text-violet-600',
  },
  {
    key: 'sales',
    label: 'Sales',
    sub: 'Today',
    format: formatCurrency,
    compare: 'vs Yesterday',
    icon: IndianRupee,
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
  {
    key: 'grossMargin',
    label: 'Gross Margin',
    sub: 'Today',
    format: formatCurrency,
    compare: 'vs Yesterday',
    icon: PiggyBank,
    iconBg: 'bg-amber-100 text-amber-600',
  },
  {
    key: 'roi',
    label: 'ROI',
    sub: 'This Month',
    format: formatRoi,
    compare: 'vs Last Month',
    icon: Activity,
    iconBg: 'bg-violet-100 text-violet-600',
  },
];

export default function FinancialMetricsRow({ financials }) {
  const data = financials || {};

  return (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {CARDS.map((card) => {
        const meta = data[card.key] || { value: 0, change: 0, changeType: 'neutral' };
        const isUp = meta.changeType === 'up';
        const isDown = meta.changeType === 'down';
        const changeDisplay =
          card.key === 'roi'
            ? `${isUp || isDown ? (isUp ? '+' : '-') : ''}${Math.abs(Number(meta.change || 0) / 100).toFixed(2)}x`
            : `${isUp ? '+' : isDown ? '-' : ''}${Math.abs(meta.change || 0)}%`;
        const Icon = card.icon;

        return (
          <div
            key={card.key}
            className="flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm"
          >
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                card.iconBg
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={2.1} />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-slate-500">
                {card.label}{' '}
                <span className="text-slate-400">({card.sub})</span>
              </p>
              <p className="mt-1 text-[20px] font-bold leading-none text-slate-900 metric-tabular">
                {card.format(meta.value)}
              </p>
              <p
                className={cn(
                  'mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold',
                  isUp && 'text-emerald-600',
                  isDown && 'text-red-500',
                  !isUp && !isDown && 'text-slate-400'
                )}
              >
                {isUp && <TrendingUp className="h-3 w-3" />}
                {isDown && <TrendingDown className="h-3 w-3" />}
                {changeDisplay} {card.compare}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
