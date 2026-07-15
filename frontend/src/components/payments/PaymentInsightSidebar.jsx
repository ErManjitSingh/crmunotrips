import { Bell, Clock3, IndianRupee, AlertTriangle, RotateCcw, Sparkles } from 'lucide-react';
import { formatDate, formatINR, formatINRCompact } from './paymentUtils';
import { cn } from '../../lib/utils';

function SideCard({ title, icon: Icon, children, accent = 'indigo' }) {
  const accents = {
    indigo: 'from-indigo-500/10 to-transparent text-indigo-600',
    emerald: 'from-emerald-500/10 to-transparent text-emerald-600',
    amber: 'from-amber-500/10 to-transparent text-amber-600',
    rose: 'from-rose-500/10 to-transparent text-rose-600',
    violet: 'from-violet-500/10 to-transparent text-violet-600',
  };
  return (
    <div className="rounded-2xl border border-subtle bg-surface overflow-hidden shadow-sm">
      <div className={cn('px-4 py-3 bg-gradient-to-r flex items-center gap-2', accents[accent])}>
        <Icon className="w-4 h-4" />
        <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function EmptyLine({ text }) {
  return <p className="text-xs text-content-muted px-1 py-2">{text}</p>;
}

export default function PaymentInsightSidebar({ analytics, onSelect }) {
  const { reminders, recent, refundRequests, todayCollection } = analytics;

  return (
    <aside className="space-y-4 xl:sticky xl:top-4">
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-5 shadow-lg shadow-indigo-500/20">
        <div className="flex items-center gap-2 text-white/80 text-xs font-semibold uppercase tracking-wide">
          <Sparkles className="w-3.5 h-3.5" />
          Today&apos;s Collection
        </div>
        <p className="text-3xl font-bold metric-tabular mt-2">{formatINRCompact(todayCollection)}</p>
        <p className="text-xs text-white/70 mt-1">Live finance pulse for this workspace</p>
      </div>

      <SideCard title="Pending Dues" icon={AlertTriangle} accent="amber">
        {(reminders.overdue || []).slice(0, 4).map((p) => (
          <button
            key={p._id}
            type="button"
            onClick={() => onSelect(p)}
            className="w-full text-left rounded-xl px-2.5 py-2 hover:bg-amber-50 transition-colors"
          >
            <div className="flex justify-between gap-2">
              <p className="text-xs font-semibold text-content-primary truncate">{p.customerName}</p>
              <p className="text-xs font-bold text-amber-600 metric-tabular">{formatINR(p.amount - (p.paidAmount || 0))}</p>
            </div>
            <p className="text-[10px] text-content-muted mt-0.5">Due {formatDate(p.dueDate)}</p>
          </button>
        ))}
        {!reminders.overdue?.length && <EmptyLine text="No overdue invoices" />}
      </SideCard>

      <SideCard title="Due Today" icon={Clock3} accent="rose">
        {(reminders.dueToday || []).slice(0, 4).map((p) => (
          <button
            key={p._id}
            type="button"
            onClick={() => onSelect(p)}
            className="w-full text-left rounded-xl px-2.5 py-2 hover:bg-rose-50 transition-colors"
          >
            <div className="flex justify-between gap-2">
              <p className="text-xs font-semibold truncate">{p.customerName}</p>
              <p className="text-xs font-bold text-rose-600 metric-tabular">{formatINR(p.amount - (p.paidAmount || 0))}</p>
            </div>
          </button>
        ))}
        {!reminders.dueToday?.length && <EmptyLine text="Nothing due today" />}
      </SideCard>

      <SideCard title="Upcoming Payments" icon={Bell} accent="indigo">
        {(reminders.upcoming || []).slice(0, 4).map((p) => (
          <button
            key={p._id}
            type="button"
            onClick={() => onSelect(p)}
            className="w-full text-left rounded-xl px-2.5 py-2 hover:bg-indigo-50 transition-colors"
          >
            <div className="flex justify-between gap-2">
              <p className="text-xs font-semibold truncate">{p.customerName}</p>
              <p className="text-xs font-bold text-indigo-600 metric-tabular">{formatINR(p.amount - (p.paidAmount || 0))}</p>
            </div>
            <p className="text-[10px] text-content-muted mt-0.5">{formatDate(p.dueDate)}</p>
          </button>
        ))}
        {!reminders.upcoming?.length && <EmptyLine text="No upcoming dues" />}
      </SideCard>

      <SideCard title="Recent Payments" icon={IndianRupee} accent="emerald">
        {(recent || []).slice(0, 5).map((p) => (
          <button
            key={p._id}
            type="button"
            onClick={() => onSelect(p)}
            className="w-full text-left rounded-xl px-2.5 py-2 hover:bg-emerald-50 transition-colors"
          >
            <div className="flex justify-between gap-2">
              <p className="text-xs font-semibold truncate">{p.customerName}</p>
              <p className="text-xs font-bold text-emerald-600 metric-tabular">{formatINR(p.paidAmount)}</p>
            </div>
            <p className="text-[10px] text-content-muted mt-0.5">{p.invoiceNumber}</p>
          </button>
        ))}
        {!recent?.length && <EmptyLine text="No recent activity" />}
      </SideCard>

      <SideCard title="Refund Requests" icon={RotateCcw} accent="violet">
        {(refundRequests || []).slice(0, 4).map((p) => (
          <button
            key={p._id}
            type="button"
            onClick={() => onSelect(p)}
            className="w-full text-left rounded-xl px-2.5 py-2 hover:bg-violet-50 transition-colors"
          >
            <p className="text-xs font-semibold truncate">{p.customerName}</p>
            <p className="text-[10px] text-content-muted mt-0.5">
              {(p.refunds || []).length} refund · {p.status}
            </p>
          </button>
        ))}
        {!refundRequests?.length && <EmptyLine text="No refund activity" />}
      </SideCard>
    </aside>
  );
}
