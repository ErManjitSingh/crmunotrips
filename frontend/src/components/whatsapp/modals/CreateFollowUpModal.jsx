import { useState, useEffect } from 'react';
import AppModal from '../../ui/AppModal';
import { Button } from '../../ui/button';
import {
  FOLLOWUP_CATEGORY_OPTIONS,
  CALL_NOT_PICKED_REASONS,
} from '../../followups/constants';
import { COLD_LEAD_REASONS } from '../../lead-wizard/constants';

export default function CreateFollowUpModal({ open, onClose, onSubmit, leadName }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [category, setCategory] = useState('call_picked');
  const [coldReason, setColdReason] = useState('');
  const [notPickedReason, setNotPickedReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().split('T')[0]);
      setError('');
      setNotes('');
      setCategory('call_picked');
      setColdReason('');
      setNotPickedReason('');
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) {
      setError('Please select date');
      return;
    }
    if (category === 'cold' && !coldReason) {
      setError('Please select why this is a cold lead');
      return;
    }
    if (category === 'call_not_picked' && !notPickedReason) {
      setError('Please select why the call was not picked');
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
        coldReason: category === 'cold' ? coldReason : undefined,
        notPickedReason: category === 'call_not_picked' ? notPickedReason : undefined,
        outcome: category === 'call_not_picked' ? notPickedReason : undefined,
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
          <h3 className="text-lg font-semibold text-content-primary">Add Follow-up</h3>
          <p className="text-sm text-content-secondary mt-1">{leadName}</p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

        <div>
          <label className="text-xs font-medium text-content-secondary mb-1 block">Follow-up Category *</label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setColdReason('');
              setNotPickedReason('');
            }}
            className="w-full rounded-lg border border-strong bg-surface px-3 py-2.5 text-sm font-medium"
          >
            {FOLLOWUP_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {category === 'call_not_picked' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 space-y-2">
            <p className="text-xs font-semibold text-amber-800">Call not picked — reason *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CALL_NOT_PICKED_REASONS.map((reason) => (
                <button
                  key={reason.value}
                  type="button"
                  onClick={() => setNotPickedReason(reason.value)}
                  className={`text-left px-3 py-2 rounded-xl border text-xs font-semibold ${
                    notPickedReason === reason.value
                      ? 'border-amber-500 bg-amber-100 text-amber-900'
                      : 'border-subtle bg-white text-content-secondary'
                  }`}
                >
                  {reason.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {category === 'cold' && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3 space-y-2">
            <p className="text-xs font-semibold text-sky-800">Cold lead — reason *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {COLD_LEAD_REASONS.map((reason) => (
                <button
                  key={reason.value}
                  type="button"
                  onClick={() => setColdReason(reason.value)}
                  className={`text-left px-3 py-2 rounded-xl border text-xs font-semibold ${
                    coldReason === reason.value
                      ? 'border-sky-500 bg-sky-100 text-sky-800'
                      : 'border-subtle bg-white text-content-secondary'
                  }`}
                >
                  {reason.label}
                </button>
              ))}
            </div>
          </div>
        )}

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
          <label className="text-xs font-medium text-content-secondary mb-1 block">Remarks *</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Follow-up agenda..."
            rows={3}
            required={category !== 'cold' && category !== 'call_not_picked'}
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
