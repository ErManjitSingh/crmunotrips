import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { ActionModal } from '../sales-executive/LeadActionsMenu';
import {
  FOLLOWUP_CATEGORY_OPTIONS,
  getOutcomesForCategory,
  buildLeadStatusPayload,
} from '../../lib/leadTemperatureStatus';
import { toast } from '../../context/ToastContext';

/**
 * Lead follow-up outcome: Warm / Hot / Cold only.
 */
export default function LeadFollowUpOutcomeModal({
  open,
  lead,
  onClose,
  onSubmit,
}) {
  const [category, setCategory] = useState('warm');
  const [option, setOption] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory('warm');
    setOption('');
    setComment('');
  }, [open, lead]);

  const optionList = getOutcomesForCategory(category);

  const handleCategoryChange = (next) => {
    setCategory(next);
    setOption('');
  };

  const handleSave = async () => {
    if (!option) {
      toast.error('Select an option');
      return;
    }

    const payload = buildLeadStatusPayload(category, option, comment);
    if (!payload) {
      toast.error('Invalid selection');
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
          <Button onClick={handleSave} disabled={!option || saving}>
            {saving ? 'Saving…' : 'Save follow up'}
          </Button>
        </div>
      </div>
    </ActionModal>
  );
}
