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
import { cn } from '../../lib/utils';

const CATEGORY_CHIP = {
  warm: {
    active: 'border-amber-500 bg-amber-500 text-white shadow-sm',
    idle: 'border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-400',
  },
  hot: {
    active: 'border-rose-600 bg-rose-600 text-white shadow-sm',
    idle: 'border-rose-200 bg-rose-50 text-rose-900 hover:border-rose-400',
  },
  cold: {
    active: 'border-slate-600 bg-slate-600 text-white shadow-sm',
    idle: 'border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-400',
  },
  converted: {
    active: 'border-emerald-600 bg-emerald-600 text-white shadow-sm',
    idle: 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-400',
  },
};

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
            Status * (Warm / Hot / Cold / Converted)
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FOLLOWUP_CATEGORY_OPTIONS.map((c) => {
              const tone = CATEGORY_CHIP[c.value] || CATEGORY_CHIP.warm;
              const active = category === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleCategoryChange(c.value)}
                  className={cn(
                    'rounded-xl border px-2 py-2.5 text-xs font-bold transition-colors',
                    active ? tone.active : tone.idle
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
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
