import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSidebar } from '../../context/SidebarContext';
import { listPayments } from '../../services/paymentApi';
import { MONTHLY_TARGET } from '../payments/constants';
import { formatINRCompact } from '../payments/paymentUtils';
import { cn } from '../../lib/utils';

function computeCollected(payments = []) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return payments
    .filter((p) => {
      const d = new Date(p.paidAt || p.createdAt);
      return d >= monthStart && Number(p.paidAmount) > 0;
    })
    .reduce((s, p) => s + (Number(p.paidAmount) || 0), 0);
}

export default function SidebarCollectionTarget() {
  const { collapsed, setMobileOpen } = useSidebar();
  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => listPayments(),
    staleTime: 60_000,
  });

  if (collapsed) return null;

  const collected = computeCollected(payments);
  const pct = Math.min(100, Math.round((collected / MONTHLY_TARGET) * 10000) / 100);

  return (
    <div className="px-2 pb-3">
      <div
        className={cn(
          'rounded-2xl border border-white/[0.1] p-3.5',
          'bg-gradient-to-br from-violet-900/70 via-indigo-950/80 to-slate-950/90',
          'shadow-lg shadow-black/20'
        )}
      >
        <div className="flex items-start gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/25 border border-violet-400/20 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-violet-300" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-white">Collection Target</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Monthly goal · {formatINRCompact(MONTHLY_TARGET)}
            </p>
          </div>
        </div>

        <div className="flex items-end justify-between gap-2 mb-2">
          <p className="text-lg font-bold text-white metric-tabular leading-none">
            {formatINRCompact(collected)}
          </p>
          <p className="text-[11px] font-semibold text-violet-300 metric-tabular">{pct}%</p>
        </div>

        <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>

        <Link
          to="/payments"
          onClick={() => {
            window.setTimeout(() => setMobileOpen(false), 0);
          }}
          className="flex items-center justify-center h-8 rounded-xl text-[11px] font-semibold text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
