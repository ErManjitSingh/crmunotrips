import { useEffect, useState } from 'react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import {
  FOLLOWUP_CATEGORY_OPTIONS,
  getOutcomesForCategory,
  buildLeadStatusPayload,
} from '../../lib/leadTemperatureStatus';
import { toast } from '../../context/ToastContext';
import { useLeadStatusOptions } from '../../context/LeadStatusOptionsContext';

export default function BulkStatusModal({ open, onClose, count, onSubmit }) {
  const { loaded } = useLeadStatusOptions();
  const [category, setCategory] = useState('warm');
  const [option, setOption] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory('warm');
    setOption('');
    setComment('');
  }, [open]);

  const options = getOutcomesForCategory(category);
  void loaded;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!option) {
      toast.error('Select an option');
      return;
    }
    const payload = buildLeadStatusPayload(category, option, comment);
    if (!payload) {
      toast.error('Invalid selection');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal open={open} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-content-primary">Bulk Update Status</h3>
          <p className="text-sm text-content-secondary mt-1">
            Update status for {count} selected lead{count !== 1 ? 's' : ''}
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Status *
          </label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setOption('');
            }}
            className="w-full rounded-xl border border-subtle bg-white p-3 text-sm font-medium"
          >
            {FOLLOWUP_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
          {options.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setOption(item.value)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left text-sm font-semibold ${
                option === item.value
                  ? 'border-brand-500 bg-brand-500/5 ring-1 ring-brand-500/30'
                  : 'border-strong hover:bg-surface-secondary'
              }`}
            >
              {item.label}
              {option === item.value && <span className="text-brand-600 text-xs font-medium">Selected</span>}
            </button>
          ))}
        </div>

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
          <Button type="submit" variant="default" disabled={submitting || !option}>
            {submitting ? 'Updating...' : 'Update Status'}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
