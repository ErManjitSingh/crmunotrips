import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { ActionModal } from '../sales-executive/LeadActionsMenu';
import PaymentScreenshotField from '../leads/PaymentScreenshotField';
import {
  CALL_PICKED_OUTCOMES,
  CALL_NOT_PICKED_REASONS,
  FOLLOWUP_COLD_REASONS,
  FOLLOWUP_CATEGORY_OPTIONS,
} from '../followups/constants';
import { LOST_REASONS, buildLostStatusReason, getDirectLostOutcome } from '../../constants/salesSop';
import { toast } from '../../context/ToastContext';

/**
 * Lead follow-up outcome: Connected / Not connected / Cold / Lost.
 * Invalid / Not interested / Booked elsewhere → direct Lost.
 * Follow-up date/time is whatever the executive sets on the schedule modal.
 */
export default function LeadFollowUpOutcomeModal({
  open,
  lead,
  onClose,
  onSubmit,
}) {
  const [category, setCategory] = useState('call_picked');
  const [option, setOption] = useState('');
  const [comment, setComment] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [paymentShots, setPaymentShots] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory('call_picked');
    setOption('');
    setComment('');
    setAdvanceAmount('');
    setPaymentMethod('upi');
    setPaymentShots([]);
  }, [open, lead]);

  const optionList =
    category === 'call_picked'
      ? CALL_PICKED_OUTCOMES
      : category === 'call_not_picked'
        ? CALL_NOT_PICKED_REASONS
        : category === 'cold'
          ? FOLLOWUP_COLD_REASONS
          : LOST_REASONS;

  const isConverted = category === 'call_picked' && option === 'converted';
  const directLost = getDirectLostOutcome(option);
  const isLost = category === 'lost' || Boolean(directLost);
  const convertInvalid =
    isConverted &&
    (!advanceAmount ||
      Number(advanceAmount) < 0 ||
      Number.isNaN(Number(advanceAmount)) ||
      !paymentShots.length);
  const lostInvalid = isLost && !comment.trim();

  const handleCategoryChange = (next) => {
    setCategory(next);
    setOption('');
  };

  const buildPayload = () => {
    const note = comment.trim();

    if (directLost) {
      if (!note) return null;
      return {
        status: directLost.status,
        statusReason: buildLostStatusReason(directLost.lostReason, note),
      };
    }

    if (category === 'call_picked') {
      if (option === 'converted') {
        return {
          status: 'converted',
          statusReason: note || 'converted',
          advanceAmount: Number(advanceAmount),
          paymentMethod,
          sendReceipt: true,
          paymentScreenshots: paymentShots.map((f) => ({ base64: f.base64, name: f.name })),
          paymentScreenshotBase64: paymentShots[0]?.base64,
          paymentScreenshotName: paymentShots[0]?.name,
        };
      }
      if (option === 'working_progress') {
        return { status: 'working_progress', statusReason: note ? `working_progress — ${note}` : 'working_progress' };
      }
      if (option === 'qualified') {
        return { status: 'qualified', statusReason: note ? `qualified — ${note}` : 'qualified' };
      }
      return {
        status: 'contacted',
        statusReason: note ? `${option} — ${note}` : option,
      };
    }

    if (category === 'call_not_picked') {
      const keepAdvanced = [
        'contacted',
        'working_progress',
        'qualified',
        'quotation_sent',
        'negotiation',
        'follow_up',
      ].includes(lead?.status);
      return {
        status: keepAdvanced ? lead.status : 'follow_up',
        statusReason: note ? `${option} — ${note}` : option,
      };
    }

    if (category === 'cold') {
      return {
        status: 'follow_up',
        statusReason: note ? `${option} — ${note}` : option,
        temperature: 'cold',
        coldReason: option,
      };
    }

    if (category === 'lost') {
      if (option === 'booked_elsewhere') {
        return {
          status: 'booked_from_another_company',
          statusReason: buildLostStatusReason('booked_elsewhere', note),
        };
      }
      return {
        status: 'lost',
        statusReason: buildLostStatusReason(option, note),
      };
    }

    return null;
  };

  const handleSave = async () => {
    if (!option) {
      toast.error('Select an option');
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

    const payload = buildPayload();
    if (!payload) {
      toast.error(isLost ? 'Add a comment before marking lead as lost' : 'Invalid selection');
      return;
    }

    setSaving(true);
    try {
      await onSubmit(payload, {
        outcome: { value: option, category, label: optionList.find((o) => o.value === option)?.label },
        comment: comment.trim(),
      });
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
            Category *
          </label>
          <select
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className="w-full rounded-xl border border-subtle bg-white p-3 text-sm font-medium"
          >
            {FOLLOWUP_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
            Option *
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {optionList.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setOption(item.value)}
                className={`text-left px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                  option === item.value
                    ? 'border-violet-500 bg-violet-50 text-violet-900'
                    : 'border-subtle bg-white text-content-secondary hover:border-violet-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
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
          <Button onClick={handleSave} disabled={!option || convertInvalid || lostInvalid || saving}>
            {saving ? 'Saving…' : isConverted ? 'Convert & Send Voucher' : 'Save follow up'}
          </Button>
        </div>
      </div>
    </ActionModal>
  );
}
