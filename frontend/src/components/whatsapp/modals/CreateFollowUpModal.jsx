import { useState, useEffect } from 'react';
import AppModal from '../../ui/AppModal';
import { Button } from '../../ui/button';
import {
  FOLLOWUP_CATEGORY_OPTIONS,
  getOutcomesForCategory,
} from '../../followups/constants';

export default function CreateFollowUpModal({ open, onClose, onSubmit, leadName }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [category, setCategory] = useState('warm');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split('T')[0]);
      setError('');
      setNotes('');
      setCategory('warm');
      setOutcome('');
    }
  }, [open]);

  const outcomeOptions = getOutcomesForCategory(category);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) {
      setError('Please select date');
      return;
    }
    if (!outcome) {
      setError(`Please select a ${category} option`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      await onSubmit({
        scheduledAt,
        notes,
        type: 'whatsapp',
        category,
        coldReason: category === 'cold' ? outcome : undefined,
        pickedOutcome: category === 'warm' || category === 'hot' ? outcome : undefined,
        warmOutcome: category === 'warm' ? outcome : undefined,
        hotOutcome: category === 'hot' ? outcome : undefined,
        outcome,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal open={open} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-content-primary">Lead follow up</h3>
          <p className="text-sm text-content-secondary mt-1">{leadName}</p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className="text-xs font-medium text-content-secondary mb-1 block">Status *</label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setOutcome('');
            }}
            className="w-full rounded-lg border border-strong bg-surface px-3 py-2.5 text-sm font-medium"
          >
            {FOLLOWUP_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div className={`rounded-xl border p-3 space-y-2 ${
          category === 'hot'
            ? 'border-rose-200 bg-rose-50/80'
            : category === 'cold'
              ? 'border-sky-200 bg-sky-50/80'
              : 'border-amber-200 bg-amber-50/80'
        }`}>
          <p className={`text-xs font-semibold ${
            category === 'hot' ? 'text-rose-800' : category === 'cold' ? 'text-sky-800' : 'text-amber-800'
          }`}>
            {category === 'warm' && 'Warm — option *'}
            {category === 'hot' && 'Hot — option *'}
            {category === 'cold' && 'Cold — option *'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {outcomeOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setOutcome(item.value)}
                className={`text-left px-3 py-2 rounded-xl border text-xs font-semibold ${
                  outcome === item.value
                    ? category === 'hot'
                      ? 'border-rose-500 bg-rose-100 text-rose-900'
                      : category === 'cold'
                        ? 'border-sky-500 bg-sky-100 text-sky-800'
                        : 'border-amber-500 bg-amber-100 text-amber-900'
                    : 'border-subtle bg-white text-content-secondary'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-content-secondary mb-1 block">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-lg border border-strong bg-surface px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary mb-1 block">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-lg border border-strong bg-surface px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-content-secondary mb-1 block">
            Remarks (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Follow-up agenda..."
            rows={3}
            className="w-full rounded-xl border border-strong bg-surface px-4 py-3 text-sm resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="emerald" disabled={saving || !date}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
