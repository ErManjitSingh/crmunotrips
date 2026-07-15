import { useMemo } from 'react';
import { X, Wallet, RotateCcw, FileText, MapPin, Phone, Mail, Building2 } from 'lucide-react';
import AppDrawer from '../ui/AppDrawer';
import {
  buildTimeline,
  formatDate,
  formatINR,
  getAvatarColor,
  getInitials,
  getMethodMeta,
  getStatusMeta,
  pendingAmount,
  totalRefunded,
} from './paymentUtils';
import { cn } from '../../lib/utils';

function MoneyRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-subtle last:border-0">
      <span className="text-sm text-content-muted">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold metric-tabular',
          tone === 'success' && 'text-emerald-600',
          tone === 'warn' && 'text-amber-600',
          tone === 'danger' && 'text-red-600',
          !tone && 'text-content-primary'
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function PaymentDetailDrawer({
  open,
  payment,
  onClose,
  onCollect,
  onRefund,
}) {
  const timeline = useMemo(() => (payment ? buildTimeline(payment) : []), [payment]);
  if (!payment) return null;

  const status = getStatusMeta(payment.status);
  const method = getMethodMeta(payment.method);

  return (
    <AppDrawer open={open} onClose={onClose} className="max-w-lg">
      <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Payment Details</p>
          <h2 className="text-lg font-bold text-content-primary font-mono">{payment.invoiceNumber}</h2>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-content-muted">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-md',
              getAvatarColor(payment.customerName)
            )}
          >
            {getInitials(payment.customerName)}
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-content-primary truncate">{payment.customerName}</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', status.soft)}>
                {status.label}
              </span>
              <span className="text-[11px] font-medium text-content-muted">{method.label}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-subtle bg-slate-50/70 p-4 space-y-1">
          <MoneyRow label="Package Cost" value={formatINR(payment.amount)} />
          <MoneyRow label="Received" value={formatINR(payment.paidAmount)} tone="success" />
          <MoneyRow label="Pending" value={formatINR(pendingAmount(payment))} tone="warn" />
          <MoneyRow label="Refunded" value={formatINR(totalRefunded(payment))} tone="danger" />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-subtle p-3">
            <p className="text-[11px] text-content-muted mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Destination</p>
            <p className="font-semibold">{payment.lead?.destination || '—'}</p>
          </div>
          <div className="rounded-xl border border-subtle p-3">
            <p className="text-[11px] text-content-muted mb-1 flex items-center gap-1"><Building2 className="w-3 h-3" /> Booking</p>
            <p className="font-semibold font-mono text-sm">{payment.booking?.bookingNumber || '—'}</p>
          </div>
          <div className="rounded-xl border border-subtle p-3">
            <p className="text-[11px] text-content-muted mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</p>
            <p className="font-semibold">{payment.lead?.phone || '—'}</p>
          </div>
          <div className="rounded-xl border border-subtle p-3">
            <p className="text-[11px] text-content-muted mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</p>
            <p className="font-semibold truncate">{payment.lead?.email || '—'}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-content-primary mb-3">Payment Timeline</p>
          <ol className="relative space-y-4 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
            {timeline.map((event) => (
              <li key={event.key} className="relative pl-7">
                <span
                  className={cn(
                    'absolute left-0 top-1 w-[18px] h-[18px] rounded-full border-2',
                    event.done ? 'bg-emerald-500 border-emerald-500' : 'bg-surface border-slate-300'
                  )}
                />
                <p className={cn('text-sm font-medium', event.done ? 'text-content-primary' : 'text-content-muted')}>
                  {event.label}
                </p>
                <p className="text-[11px] text-content-muted">{event.at ? formatDate(event.at) : 'Pending'}</p>
              </li>
            ))}
          </ol>
        </div>

        {(payment.refunds || []).length > 0 && (
          <div>
            <p className="text-sm font-semibold text-content-primary mb-2">Refund History</p>
            <div className="space-y-2">
              {payment.refunds.map((r, i) => (
                <div key={i} className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-violet-700">{formatINR(r.amount)}</span>
                    <span className="text-xs text-content-muted">{formatDate(r.date)}</span>
                  </div>
                  <p className="text-xs text-content-secondary mt-0.5">{r.reason || 'No reason provided'}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-subtle p-4 flex gap-2">
        <button type="button" className="btn-primary flex-1 gap-1.5" onClick={() => onCollect(payment)}>
          <Wallet className="w-4 h-4" />
          Collect
        </button>
        <button type="button" className="btn-secondary flex-1 gap-1.5" onClick={() => onRefund(payment)}>
          <RotateCcw className="w-4 h-4" />
          Refund
        </button>
        <button type="button" className="btn-ghost border border-subtle px-3" onClick={onClose}>
          <FileText className="w-4 h-4" />
        </button>
      </div>
    </AppDrawer>
  );
}
