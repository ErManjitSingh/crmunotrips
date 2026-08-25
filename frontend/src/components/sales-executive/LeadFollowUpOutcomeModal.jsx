import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { ActionModal } from '../sales-executive/LeadActionsMenu';
import {
  FOLLOWUP_CATEGORY_OPTIONS,
  getOutcomesForCategory,
  buildLeadStatusPayload,
} from '../../lib/leadTemperatureStatus';
import { toast } from '../../context/ToastContext';
import { useLeadStatusOptions } from '../../context/LeadStatusOptionsContext';
import PaymentScreenshotField from '../leads/PaymentScreenshotField';

/**
 * Lead follow-up outcome: Warm / Hot / Cold / Converted.
 * Converted requires advance amount + payment screenshot (full convert flow).
 */
export default function LeadFollowUpOutcomeModal({
  open,
  lead,
  onClose,
  onSubmit,
}) {
  const { loaded } = useLeadStatusOptions();
  const [category, setCategory] = useState('warm');
  const [option, setOption] = useState('');
  const [comment, setComment] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [shotFiles, setShotFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory('warm');
    setOption('');
    setComment('');
    setAdvanceAmount('');
    setShotFiles([]);
  }, [open, lead]);

  const optionList = getOutcomesForCategory(category);
  void loaded;

  const handleCategoryChange = (next) => {
    setCategory(next);
    if (next === 'converted') {
      setOption('converted');
    } else {
      setOption('');
    }
    setAdvanceAmount('');
    setShotFiles([]);
  };

  const handleSave = async () => {
    if (!option) {
      toast.error('Select an option');
      return;
    }

    if (category === 'converted') {
      const advance = Number(advanceAmount);
      if (!Number.isFinite(advance) || advance < 0) {
        toast.error('Enter advance / token amount received (₹)');
        return;
      }
      if (!shotFiles.length) {
        toast.error('Upload payment screenshot (UPI / bank transfer proof)');
        return;
      }
    }

    const payload = buildLeadStatusPayload(category, option, comment, lead);
    if (!payload) {
      toast.error('Invalid selection');
      return;
    }

    if (category === 'converted') {
      payload.advanceAmount = Number(advanceAmount);
      payload.paymentScreenshots = shotFiles.map((f) => ({ base64: f.base64, name: f.name }));
      payload.paymentScreenshotBase64 = shotFiles[0]?.base64;
      payload.paymentScreenshotName = shotFiles[0]?.name;
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

  const canSave =
    Boolean(option) &&
    !saving &&
    (category !== 'converted' ||
      (Number.isFinite(Number(advanceAmount)) && Number(advanceAmount) >= 0 && shotFiles.length > 0));

  return (
    <ActionModal open={open} title="Lead follow up" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
            Status *
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

        {category === 'converted' ? (
          <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <p className="text-xs font-medium text-emerald-900">
              Converted starts the booking — enter token amount and upload payment proof.
            </p>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
                Advance / token amount (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="e.g. 10000"
                className="w-full rounded-xl border border-subtle bg-white p-3 text-sm"
              />
            </div>
            <PaymentScreenshotField
              required
              value={shotFiles}
              onChange={({ files, error }) => {
                setShotFiles(files || []);
                if (error) toast.error(error);
              }}
            />
          </div>
        ) : null}

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
            Comment
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Add a comment (optional)…"
            className="w-full rounded-xl border border-subtle bg-white p-3 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? 'Saving…' : category === 'converted' ? 'Convert lead' : 'Save follow up'}
          </Button>
        </div>
      </div>
    </ActionModal>
  );
}
