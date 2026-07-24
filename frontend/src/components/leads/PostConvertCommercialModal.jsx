import { useEffect, useState } from 'react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import API from '../../api/axios';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatINR(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function PostConvertCommercialModal({ open, leadId, onClose, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const [packageMarginPercent, setPackageMarginPercent] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [gstAmount, setGstAmount] = useState('');
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [proofName, setProofName] = useState('');
  const [proofBase64, setProofBase64] = useState('');

  useEffect(() => {
    if (!open || !leadId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    API.get(`/sales-executive/leads/${leadId}/commercial-form`, { skipSuccessToast: true })
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        setDraft(data);
        setPackageMarginPercent(String(data.packageMarginPercent ?? ''));
        setTotalCost(String(data.totalCost ?? ''));
        setGstAmount(String(data.gstAmount ?? ''));
        setAmountReceived(String(data.amountReceived ?? ''));
        setPaymentMethod(data.paymentMethod || 'upi');
        setProofName(data.addressProofName || '');
        setProofBase64('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Failed to load form');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, leadId]);

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setProofBase64(String(reader.result || ''));
      setProofName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { data } = await API.post(`/sales-executive/leads/${leadId}/commercial-form`, {
        packageMarginPercent: Number(packageMarginPercent) || 0,
        totalCost: Number(totalCost) || 0,
        gstAmount: Number(gstAmount) || 0,
        amountReceived: Number(amountReceived) || 0,
        paymentMethod,
        totalAmount: draft?.totalAmount,
        addressProofBase64: proofBase64 || undefined,
        addressProofName: proofName || undefined,
      });
      setDraft(data);
      onSaved?.(data);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal open={open} onClose={() => !saving && onClose?.()} size="lg">
      <form onSubmit={handleSave} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        <div>
          <h3 className="text-lg font-bold text-content-primary">Post-conversion commercial form</h3>
          <p className="text-sm text-content-muted">
            {draft?.lead?.name || 'Customer'} — fill margin, costs, advance & installments
          </p>
        </div>

        {loading && <p className="text-sm text-content-muted">Loading…</p>}
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {draft && !loading && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-[11px] font-bold uppercase text-slate-500">Package margin %</span>
                <input
                  type="number"
                  step="0.1"
                  value={packageMarginPercent}
                  onChange={(e) => setPackageMarginPercent(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-subtle px-3 py-2.5 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="text-[11px] font-bold uppercase text-slate-500">Total cost (auto)</span>
                <input
                  type="number"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-subtle px-3 py-2.5 text-sm bg-slate-50"
                />
              </label>
              <label className="text-sm">
                <span className="text-[11px] font-bold uppercase text-slate-500">GST amount (auto)</span>
                <input
                  type="number"
                  value={gstAmount}
                  onChange={(e) => setGstAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-subtle px-3 py-2.5 text-sm bg-slate-50"
                />
              </label>
              <label className="text-sm">
                <span className="text-[11px] font-bold uppercase text-slate-500">Amount received (token / advance)</span>
                <input
                  type="number"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-subtle px-3 py-2.5 text-sm"
                  required
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="text-[11px] font-bold uppercase text-slate-500">Payment mode</span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-subtle px-3 py-2.5 text-sm"
                >
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </label>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500 mb-1.5">
                Address proof (client document)
              </p>
              <input type="file" accept="image/*,.pdf" onChange={onFile} className="text-sm" />
              {(proofName || draft.addressProofName) && (
                <p className="mt-1 text-xs text-slate-600">
                  {proofName || draft.addressProofName}
                  {draft.addressProofUrl && !proofBase64 ? ' (already uploaded)' : ''}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-subtle overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                Auto installments after token · Package {formatINR(draft.totalAmount)}
              </div>
              <div className="divide-y divide-subtle">
                {(draft.scheduledInstallments || []).map((row, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div>
                      <p className="font-semibold text-slate-800">{row.label}</p>
                      <p className="text-xs text-slate-500">Due {formatDate(row.dueDate)}</p>
                    </div>
                    <p className="font-bold tabular-nums">{formatINR(row.amount)}</p>
                  </div>
                ))}
                {!draft.scheduledInstallments?.length && (
                  <p className="px-3 py-3 text-xs text-slate-500">No balance left after token.</p>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
            Later
          </Button>
          <Button type="submit" variant="emerald" disabled={saving || loading || !draft}>
            {saving ? 'Saving…' : 'Save commercial details'}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
