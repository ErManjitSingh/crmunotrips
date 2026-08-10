import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

function formatCurrency(n) {
  const amount = Number(n || 0);
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2).replace(/\.00$/, '')}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function formatRoi(n) {
  const v = Number(n || 0);
  return `${v.toFixed(2)}x`;
}

const CARDS = [
  {
    key: 'marketingSpend',
    label: 'Marketing Spend',
    sub: 'Today',
    format: formatCurrency,
    compare: 'vs yesterday',
  },
  {
    key: 'sales',
    label: 'Sales',
    sub: 'Today',
    format: formatCurrency,
    compare: 'vs yesterday',
  },
  {
    key: 'grossMargin',
    label: 'Gross Margin',
    sub: 'Today',
    format: formatCurrency,
    compare: 'vs yesterday',
  },
  {
    key: 'roi',
    label: 'ROI',
    sub: 'This Month',
    format: formatRoi,
    compare: 'vs last month',
    changeSuffix: 'x',
  },
];

export default function FinancialMetricsRow({ financials }) {
  const data = financials || {};

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {CARDS.map((card) => {
        const meta = data[card.key] || { value: 0, change: 0, changeType: 'neutral' };
        const isUp = meta.changeType === 'up';
        const isDown = meta.changeType === 'down';
        const changeDisplay =
          card.key === 'roi'
            ? `${isUp || isDown ? (isUp ? '+' : '-') : ''}${Math.abs(Number(meta.change || 0) / 100).toFixed(2)}x`
            : `${isUp ? '+' : isDown ? '-' : ''}${Math.abs(meta.change || 0)}%`;

        return (
          <div
            key={card.key}
            className="rounded-2xl border border-subtle bg-surface px-4 py-3.5 shadow-sm"
          >
            <p className="text-[11px] font-medium text-content-muted">
              {card.label}{' '}
              <span className="text-content-muted/70">({card.sub})</span>
            </p>
            <p className="mt-1.5 text-xl font-bold text-content-primary metric-tabular">
              {card.format(meta.value)}
            </p>
            <p
              className={cn(
                'mt-1 inline-flex items-center gap-1 text-[11px] font-semibold',
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
        );
      })}
    </div>
  );
}
