import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { ActionModal } from '../sales-executive/LeadActionsMenu';
import PaymentScreenshotField from '../leads/PaymentScreenshotField';
import {
  LEAD_FOLLOW_UP_OUTCOMES,
  getFollowUpOutcome,
  resolveOutcomeFromLead,
} from '../../constants/leadFollowUpOutcomes';
import { buildLostStatusReason } from '../../constants/salesSop';
import { toast } from '../../context/ToastContext';

/**
 * Replaces the old multi-status picker for sales executives.
 * One "Lead follow up" outcome + optional comment (+ convert payment fields).
 * Lost outcomes require a comment before status can change.
 */
export default function LeadFollowUpOutcomeModal({
  open,
  lead,
  onClose,
  onSubmit,
}) {
  const [outcome, setOutcome] = useState('');
  const [comment, setComment] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [paymentShots, setPaymentShots] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOutcome(resolveOutcomeFromLead(lead) || '');
    setComment('');
    setAdvanceAmount('');
    setPaymentMethod('upi');
    setPaymentShots([]);
  }, [open, lead]);

  const selected = getFollowUpOutcome(outcome);
  const isConverted = selected?.status === 'converted';
  const isLost = selected && ['lost', 'booked_from_another_company'].includes(selected.status);
  const convertInvalid =
    isConverted &&
    (!advanceAmount ||
      Number(advanceAmount) < 0 ||
      Number.isNaN(Number(advanceAmount)) ||
      !paymentShots.length);
  const lostInvalid = isLost && !comment.trim();

  const handleSave = async () => {
    if (!selected) {
      toast.error('Select a lead follow-up outcome');
      return;
    }
    if (convertInvalid) {
      toast.error('Enter advance and upload payment screenshot to convert');
      return;
    }
    if (lostInvalid) {
      toast.error('Add a comment before marking lead as lost');
      return;
    }

    const note = comment.trim();
    const payload = {
      status: selected.status,
      statusReason: selected.lostReason || selected.value,
    };

    if (['lost', 'booked_from_another_company'].includes(selected.status)) {
      payload.statusReason = buildLostStatusReason(selected.lostReason || selected.value, note);
    } else if (note && selected.status !== 'converted') {
      payload.statusReason = `${selected.lostReason || selected.value} — ${note}`;
    }

    if (isConverted) {
      payload.advanceAmount = Number(advanceAmount);
      payload.paymentMethod = paymentMethod;
      payload.sendReceipt = true;
      payload.paymentScreenshots = paymentShots.map((f) => ({
        base64: f.base64,
        name: f.name,
      }));
      payload.paymentScreenshotBase64 = paymentShots[0]?.base64;
      payload.paymentScreenshotName = paymentShots[0]?.name;
      if (note) payload.statusReason = note;
    }

    setSaving(true);
    try {
      await onSubmit(payload, { outcome: selected, comment: note });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ActionModal open={open} title="Lead follow up" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
            Outcome *
          </label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="w-full rounded-xl border border-subtle bg-white p-3 text-sm"
          >
            <option value="">Select follow-up outcome…</option>
            {LEAD_FOLLOW_UP_OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {isConverted && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
            <p className="text-xs font-semibold text-emerald-800">
              Enter advance / token received. Customer will get a payment voucher by email.
            </p>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Advance / Token (₹)
              </label>
              <input
                type="number"
                min={0}
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="e.g. 15000"
                className="mt-1 w-full rounded-xl border border-subtle bg-white p-3 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Payment mode
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 w-full rounded-xl border border-subtle bg-white p-3 text-sm"
              >
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
            <PaymentScreenshotField
              required
              value={paymentShots}
              onChange={({ files, error }) => {
                if (error) toast.error(error);
                setPaymentShots(files || []);
              }}
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
            Comment {isLost ? '*' : ''}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            required={Boolean(isLost)}
            placeholder={isLost ? 'Required: why is this lead lost?' : 'Add a comment (optional)…'}
            className="w-full rounded-xl border border-subtle bg-white p-3 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!outcome || convertInvalid || lostInvalid || saving}>
            {saving ? 'Saving…' : isConverted ? 'Convert & Send Voucher' : 'Save follow up'}
          </Button>
        </div>
      </div>
    </ActionModal>
  );
}
