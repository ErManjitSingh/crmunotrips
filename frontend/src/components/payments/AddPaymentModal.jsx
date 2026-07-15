import { useEffect, useState } from 'react';
import AppModal from '../ui/AppModal';
import { PAYMENT_METHODS, PAYMENT_STATUSES } from './constants';

export default function AddPaymentModal({ open, onClose, onSubmit, loading, defaultInvoiceNumber }) {
  const [form, setForm] = useState({
    invoiceNumber: '',
    customerName: '',
    amount: '',
    paidAmount: '',
    method: 'upi',
    status: 'pending',
    dueDate: '',
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      invoiceNumber: defaultInvoiceNumber || '',
      customerName: '',
      amount: '',
      paidAmount: '',
      method: 'upi',
      status: 'pending',
      dueDate: '',
    });
  }, [open, defaultInvoiceNumber]);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = Number(form.amount) || 0;
    const paidAmount = Number(form.paidAmount) || 0;
    let status = form.status;
    if (paidAmount >= amount && amount > 0) status = 'paid';
    else if (paidAmount > 0) status = 'partial';

    onSubmit({
      invoiceNumber: form.invoiceNumber.trim(),
      customerName: form.customerName.trim(),
      amount,
      paidAmount,
      method: form.method,
      status,
      dueDate: form.dueDate || undefined,
      paidAt: paidAmount > 0 ? new Date().toISOString() : undefined,
    });
  };

  return (
    <AppModal open={open} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">New Record</p>
          <h3 className="text-xl font-bold text-content-primary mt-1">Add Payment</h3>
          <p className="text-sm text-content-secondary mt-1">Create an invoice and track collection from day one.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-content-muted">Invoice Number</span>
            <input required className="input-premium font-mono" value={form.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-content-muted">Customer Name</span>
            <input required className="input-premium" value={form.customerName} onChange={(e) => set('customerName', e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-content-muted">Package / Invoice Amount</span>
            <input required type="number" min="1" className="input-premium" value={form.amount} onChange={(e) => set('amount', e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-content-muted">Advance / Received</span>
            <input type="number" min="0" className="input-premium" value={form.paidAmount} onChange={(e) => set('paidAmount', e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-content-muted">Payment Mode</span>
            <select className="input-premium" value={form.method} onChange={(e) => set('method', e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-content-muted">Status</span>
            <select className="input-premium" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {PAYMENT_STATUSES.filter((s) => s.value !== 'failed').map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-content-muted">Due Date</span>
            <input type="date" className="input-premium" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost border border-subtle" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create Payment'}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
