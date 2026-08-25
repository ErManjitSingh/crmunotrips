import { useEffect, useState } from 'react';
import AppModal from '../../ui/AppModal';
import { Button } from '../../ui/button';
import {
  FOLLOWUP_CATEGORY_OPTIONS,
  getOutcomesForCategory,
  buildLeadStatusPayload,
} from '../../../lib/leadTemperatureStatus';
import { useLeadStatusOptions } from '../../../context/LeadStatusOptionsContext';
import PaymentScreenshotField from '../../leads/PaymentScreenshotField';
import { toast } from '../../../context/ToastContext';
import { cn } from '../../../lib/utils';

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

export default function ChangeStatusModal({ open, onClose, onSubmit, currentStatus, lead = null }) {
  const { loaded } = useLeadStatusOptions();
  const [category, setCategory] = useState('warm');
  const [option, setOption] = useState('');
  const [comment, setComment] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [shotFiles, setShotFiles] = useState([]);

  useEffect(() => {
    if (!open) return;
    setCategory('warm');
    setOption('');
    setComment('');
    setAdvanceAmount('');
    setShotFiles([]);
  }, [open, currentStatus]);

  const options = getOutcomesForCategory(category);
  void loaded;

  const handleCategoryChange = (next) => {
    setCategory(next);
    setOption(next === 'converted' ? 'converted' : '');
    setAdvanceAmount('');
    setShotFiles([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!option) return;

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
    if (!payload) return;

    if (category === 'converted') {
      payload.advanceAmount = Number(advanceAmount);
      payload.paymentScreenshots = shotFiles.map((f) => ({ base64: f.base64, name: f.name }));
      payload.paymentScreenshotBase64 = shotFiles[0]?.base64;
      payload.paymentScreenshotName = shotFiles[0]?.name;
    }

    onSubmit(payload);
    onClose();
  };

  const canSubmit =
    Boolean(option) &&
    (category !== 'converted' ||
      (Number.isFinite(Number(advanceAmount)) && Number(advanceAmount) >= 0 && shotFiles.length > 0));

  return (
    <AppModal open={open} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-content-primary">Lead status</h3>
          <p className="text-sm text-content-secondary mt-1">Set Warm, Hot, Cold, or Converted</p>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Status *
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

        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
          {options.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setOption(item.value)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left text-sm font-semibold ${
                option === item.value
                  ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                  : 'border-strong hover:bg-surface-secondary'
              }`}
            >
              {item.label}
              {option === item.value && <span className="text-emerald-500 text-xs font-medium">Selected</span>}
            </button>
          ))}
        </div>

        {category === 'converted' ? (
          <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
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
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Comment
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Optional note…"
            className="w-full rounded-xl border border-subtle bg-white p-3 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="emerald" disabled={!canSubmit}>
            {category === 'converted' ? 'Convert lead' : 'Update Status'}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
