import { useEffect, useState } from 'react';
import AppModal from '../ui/AppModal';
import { PAYMENT_METHODS } from './constants';
import { formatINR, pendingAmount } from './paymentUtils';

export default function CollectPaymentModal({ open, payment, onClose, onSubmit, loading }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !payment) return;
    const due = pendingAmount(payment);
    setAmount(due > 0 ? String(due) : '');
    setMethod(payment.method || 'upi');
    setReference('');
    setNotes('');
  }, [open, payment]);

  if (!payment) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const nextPaid = (Number(payment.paidAmount) || 0) + (Number(amount) || 0);
    onSubmit({
      paidAmount: nextPaid,
      method,
      notes,
      reference,
      paidAt: new Date().toISOString(),
    });
  };

  return (
    <AppModal open={open} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Collection Panel</p>
          <h3 className="text-xl font-bold text-content-primary mt-1">Receive Payment</h3>
          <p className="text-sm text-content-secondary mt-1">
            {payment.customerName} · {payment.invoiceNumber} · Due {formatINR(pendingAmount(payment))}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-content-muted">Amount</span>
            <input
              required
              type="number"
              min="1"
              className="input-premium"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-content-muted">Payment Mode</span>
            <select className="input-premium" value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-content-muted">Reference / Transaction ID</span>
            <input
              className="input-premium"
              placeholder="UPI ref / UTR / Cheque no."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-content-muted">Notes</span>
            <textarea
              className="input-premium min-h-[88px] resize-none"
              placeholder="Optional collection notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost border border-subtle" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Receive Payment'}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
