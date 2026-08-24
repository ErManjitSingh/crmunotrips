import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Bell } from 'lucide-react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import API from '../../api/axios';
import PaymentScreenshotField from './PaymentScreenshotField';
import { toast } from '../../context/ToastContext';

function formatINR(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rowsFromDraft(draft) {
  return (draft?.scheduledInstallments || []).map((row, index) => ({
    key: `${index}-${row.label || 'row'}`,
    label: row.label || `Installment ${index + 1}`,
    amount: String(row.amount ?? ''),
    dueDate: toDateInput(row.dueDate),
    status: row.status || 'pending',
  }));
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
  const [shotFiles, setShotFiles] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [createReminders, setCreateReminders] = useState(true);

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
        setShotFiles([]);
        setInstallments(rowsFromDraft(data));
        setCreateReminders(true);
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

  const totalAmount = Number(draft?.totalAmount || 0);
  const token = Number(amountReceived || 0);
  const remaining = Math.max(0, totalAmount - token);
  const installmentSum = useMemo(
    () => installments.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [installments]
  );
  const sumMismatch = installments.length > 0 && Math.abs(installmentSum - remaining) > 5;

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

  const updateRow = (index, patch) => {
    setInstallments((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => {
    setInstallments((rows) => [
      ...rows,
      {
        key: `new-${Date.now()}`,
        label: `Installment ${rows.length + 1}`,
        amount: '',
        dueDate: '',
        status: 'pending',
      },
    ]);
  };

  const removeRow = (index) => {
    setInstallments((rows) => rows.filter((_, i) => i !== index));
  };

  const applySuggestedSplit = () => {
    if (!draft) return;
    const paid = Math.max(0, Math.min(totalAmount, token));
    const bal = Math.max(0, totalAmount - paid);
    const a50 = Math.round(bal * 0.5);
    const a30 = Math.round(bal * 0.3);
    const aRest = Math.max(0, bal - a50 - a30);
    const start = draft.lead?.travelDate ? new Date(draft.lead.travelDate) : null;
    const end = draft.lead?.returnDate ? new Date(draft.lead.returnDate) : start;
    const mid =
      start && end
        ? new Date(Math.round((start.getTime() + end.getTime()) / 2))
        : start;
    const due50 = start ? new Date(start.getTime() - 2 * 86400000) : null;
    setInstallments(
      [
        { label: 'Installment 1 — 50% after token', amount: a50, dueDate: due50 },
        { label: 'Installment 2 — 30% mid-tour', amount: a30, dueDate: mid },
        { label: 'Installment 3 — balance on last tour day', amount: aRest, dueDate: end || start },
      ]
        .filter((r) => r.amount > 0)
        .map((r, index) => ({
          key: `sug-${index}`,
          label: r.label,
          amount: String(r.amount),
          dueDate: toDateInput(r.dueDate),
          status: 'pending',
        }))
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (sumMismatch) {
      setError(
        `Installments total ${formatINR(installmentSum)} must equal remaining ${formatINR(remaining)}`
      );
      return;
    }
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
        paymentScreenshots: shotFiles.length
          ? shotFiles.map((f) => ({ base64: f.base64, name: f.name }))
          : undefined,
        paymentScreenshotBase64: shotFiles[0]?.base64 || undefined,
        paymentScreenshotName: shotFiles[0]?.name || undefined,
        scheduledInstallments: installments.map((row) => ({
          label: row.label,
          amount: Number(row.amount) || 0,
          dueDate: row.dueDate || null,
          status: row.status || 'pending',
        })),
        createPaymentReminders: createReminders,
      });
      setDraft(data);
      toast.success(
        createReminders
          ? 'Commercial form saved · payment reminders set'
          : 'Commercial form saved'
      );
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
            {draft?.lead?.name || 'Customer'} — margin, costs, advance, installments & reminders
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
                <span className="text-[11px] font-bold uppercase text-slate-500">Total cost</span>
                <input
                  type="number"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-subtle px-3 py-2.5 text-sm bg-slate-50"
                />
              </label>
              <label className="text-sm">
                <span className="text-[11px] font-bold uppercase text-slate-500">GST amount</span>
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

            <PaymentScreenshotField
              value={shotFiles}
              existing={draft.paymentScreenshots || (draft.paymentScreenshotUrl
                ? [{ url: draft.paymentScreenshotUrl, name: draft.paymentScreenshotName }]
                : [])}
              onChange={({ files, error: shotErr }) => {
                if (shotErr) toast.error(shotErr);
                setShotFiles(files || []);
              }}
            />

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
              <div className="bg-slate-50 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    Installments after token
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Package {formatINR(totalAmount)} · Remaining {formatINR(remaining)} · Planned{' '}
                    <span className={sumMismatch ? 'text-red-600 font-semibold' : ''}>
                      {formatINR(installmentSum)}
                    </span>
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" variant="ghost" onClick={applySuggestedSplit}>
                    Suggest 50/30/20
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={addRow}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              <div className="divide-y divide-subtle">
                {installments.map((row, index) => (
                  <div key={row.key} className="grid gap-2 px-3 py-2.5 sm:grid-cols-[1.4fr_0.8fr_0.9fr_auto]">
                    <input
                      value={row.label}
                      onChange={(e) => updateRow(index, { label: e.target.value })}
                      className="rounded-lg border border-subtle px-2.5 py-2 text-sm"
                      placeholder="Label"
                    />
                    <input
                      type="number"
                      value={row.amount}
                      onChange={(e) => updateRow(index, { amount: e.target.value })}
                      className="rounded-lg border border-subtle px-2.5 py-2 text-sm tabular-nums"
                      placeholder="Amount"
                      min="0"
                    />
                    <input
                      type="date"
                      value={row.dueDate}
                      onChange={(e) => updateRow(index, { dueDate: e.target.value })}
                      className="rounded-lg border border-subtle px-2.5 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {!installments.length && (
                  <p className="px-3 py-3 text-xs text-slate-500">
                    No installments — click Add, or Suggest 50/30/20. Leave empty if token covers full package.
                  </p>
                )}
              </div>
            </div>

            <label className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={createReminders}
                onChange={(e) => setCreateReminders(e.target.checked)}
              />
              <span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-amber-900">
                  <Bell className="w-3.5 h-3.5" />
                  Set payment reminders
                </span>
                <span className="block text-xs text-amber-800/90 mt-0.5">
                  Creates a reminder on each installment due date (shows in Reminders for the assigned executive).
                </span>
              </span>
            </label>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
            Later
          </Button>
          <Button type="submit" variant="emerald" disabled={saving || loading || !draft || sumMismatch}>
            {saving ? 'Saving…' : 'Save commercial details'}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
