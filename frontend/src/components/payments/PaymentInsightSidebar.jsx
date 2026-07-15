import {
  Plus,
  FileText,
  Bell,
  RotateCcw,
  BarChart3,
  Upload,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { formatDate, formatINR, formatINRCompact, getAvatarColor, getInitials, pendingAmount } from './paymentUtils';
import { cn } from '../../lib/utils';

function daysLeftLabel(dueDate) {
  if (!dueDate) return null;
  const diff = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, tone: 'bg-rose-50 text-rose-600' };
  if (diff === 0) return { text: 'Due today', tone: 'bg-amber-50 text-amber-700' };
  if (diff === 1) return { text: '1 day left', tone: 'bg-rose-50 text-rose-600' };
  return { text: `${diff} days left`, tone: 'bg-amber-50 text-amber-700' };
}

const QUICK = [
  { key: 'add', label: 'Add Payment', icon: Plus, tone: 'bg-violet-50 text-violet-600' },
  { key: 'invoice', label: 'Generate Invoice', icon: FileText, tone: 'bg-sky-50 text-sky-600' },
  { key: 'remind', label: 'Send Reminder', icon: Bell, tone: 'bg-amber-50 text-amber-600' },
  { key: 'refund', label: 'Add Refund', icon: RotateCcw, tone: 'bg-fuchsia-50 text-fuchsia-600' },
  { key: 'reports', label: 'Reports', icon: BarChart3, tone: 'bg-emerald-50 text-emerald-600' },
  { key: 'export', label: 'Import Payments', icon: Upload, tone: 'bg-slate-100 text-slate-600' },
];

export default function PaymentInsightSidebar({ analytics, onSelect, onAction }) {
  const upcoming = [
    ...(analytics.reminders?.dueToday || []),
    ...(analytics.reminders?.upcoming || []),
    ...(analytics.reminders?.overdue || []),
  ].slice(0, 4);

  const recent = analytics.recent || [];

  return (
    <aside className="space-y-4 xl:sticky xl:top-4">
      {/* Today's Collection — gradient card matching mock */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 text-white p-5 shadow-lg shadow-violet-600/20 min-h-[148px]">
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/75">
            Today&apos;s Collection
          </p>
          <p className="text-[32px] font-bold metric-tabular mt-2 leading-none tracking-tight">
            {formatINR(analytics.todayCollection || 0).replace('₹', '₹')}
          </p>
          <p className="text-xs text-white/70 mt-2">Live collection today</p>
        </div>
        <div className="absolute right-3 bottom-2 opacity-90 pointer-events-none select-none">
          <svg width="108" height="88" viewBox="0 0 108 88" fill="none" aria-hidden>
            <ellipse cx="70" cy="70" rx="34" ry="10" fill="rgba(255,255,255,0.12)" />
            <rect x="38" y="28" width="52" height="36" rx="10" fill="rgba(255,255,255,0.95)" />
            <rect x="44" y="34" width="40" height="8" rx="3" fill="#C4B5FD" />
            <circle cx="28" cy="48" r="14" fill="#FBBF24" />
            <circle cx="28" cy="48" r="9" fill="#F59E0B" />
            <circle cx="88" cy="52" r="10" fill="#FCD34D" />
            <circle cx="88" cy="52" r="6" fill="#F59E0B" />
            <path d="M52 52h24" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Upcoming Due Payments</h3>
          <button type="button" className="text-[11px] font-semibold text-violet-600 hover:text-violet-500">
            View all
          </button>
        </div>
        <div className="space-y-2.5">
          {upcoming.map((p) => {
            const badge = daysLeftLabel(p.dueDate);
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => onSelect(p)}
                className="w-full flex items-center gap-2.5 rounded-2xl border border-slate-100 px-2.5 py-2.5 hover:border-violet-200 hover:bg-violet-50/40 transition-colors text-left"
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0',
                    getAvatarColor(p.customerName)
                  )}
                >
                  {getInitials(p.customerName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">{p.customerName}</p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {p.booking?.bookingNumber || p.invoiceNumber}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-slate-900 metric-tabular">
                    {formatINRCompact(pendingAmount(p) || p.amount)}
                  </p>
                  {badge && (
                    <span className={cn('inline-flex mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md', badge.tone)}>
                      {badge.text}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {!upcoming.length && (
            <p className="text-xs text-slate-400 py-3 text-center">No upcoming dues</p>
          )}
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Recent Transactions</h3>
        </div>
        <div className="space-y-2">
          {recent.slice(0, 5).map((p) => {
            const isRefund = p.status === 'refunded' || (p.refunds || []).length > 0;
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => onSelect(p)}
                className="w-full flex items-center gap-2.5 rounded-xl px-1.5 py-2 hover:bg-slate-50 transition-colors text-left"
              >
                <span
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                    isRefund ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                  )}
                >
                  {isRefund ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">{p.customerName}</p>
                  <p className="text-[10px] text-slate-400 truncate">{p.invoiceNumber}</p>
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      'text-xs font-bold metric-tabular',
                      isRefund ? 'text-rose-500' : 'text-emerald-600'
                    )}
                  >
                    {isRefund ? '-' : '+'}
                    {formatINRCompact(isRefund ? (p.refunds?.[0]?.amount || 0) : p.paidAmount)}
                  </p>
                  <p className="text-[10px] text-slate-400">{formatDate(p.paidAt || p.createdAt)}</p>
                </div>
              </button>
            );
          })}
          {!recent.length && (
            <p className="text-xs text-slate-400 py-3 text-center">No recent activity</p>
          )}
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-3 gap-2">
          {QUICK.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => onAction?.(action.key)}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-slate-100 px-2 py-3 hover:border-violet-200 hover:shadow-sm transition-all"
            >
              <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center', action.tone)}>
                <action.icon className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-medium text-slate-600 text-center leading-tight">
                {action.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
