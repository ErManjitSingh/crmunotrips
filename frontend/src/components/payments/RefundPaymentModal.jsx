import { useEffect, useState } from 'react';
import AppModal from '../ui/AppModal';
import { formatINR, pendingAmount } from './paymentUtils';

export default function RefundPaymentModal({ open, payment, onClose, onSubmit, loading }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open || !payment) return;
    setAmount(String(Math.min(Number(payment.paidAmount) || 0, Number(payment.paidAmount) || 0)));
    setReason('');
  }, [open, payment]);

  if (!payment) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ amount: Number(amount), reason });
  };

  return (
    <AppModal open={open} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">Refund Module</p>
          <h3 className="text-xl font-bold text-content-primary mt-1">Process Refund</h3>
          <p className="text-sm text-content-secondary mt-1">
            {payment.customerName} · Paid {formatINR(payment.paidAmount)} · Pending {formatINR(pendingAmount(payment))}
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-content-muted">Refund Amount</span>
          <input
            required
            type="number"
            min="1"
            max={Number(payment.paidAmount) || undefined}
            className="input-premium"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-content-muted">Reason</span>
          <textarea
            className="input-premium min-h-[96px] resize-none"
            placeholder="Cancellation, date change, partial unused services..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost border border-subtle" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary bg-violet-600 hover:bg-violet-500" disabled={loading}>
            {loading ? 'Processing…' : 'Confirm Refund'}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
