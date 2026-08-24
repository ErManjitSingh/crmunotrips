import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import { addCallNote } from '../../services/leadEnterpriseApi';
import { formatCallDurationExact } from '../../lib/callSession';
import {
  FOLLOWUP_CATEGORY_OPTIONS,
  getOutcomesForCategory,
} from '../../lib/leadTemperatureStatus';

/** @deprecated older imports */
export const CALL_PICKED_OUTCOMES = getOutcomesForCategory('warm');
export const CALL_OUTCOMES = [
  ...getOutcomesForCategory('warm'),
  ...getOutcomesForCategory('hot'),
  ...getOutcomesForCategory('cold'),
  { value: 'no_answer', label: 'No answer / Not picked' },
];

export default function PostCallFollowUpModal({
  open,
  session,
  onClose,
  onSaved,
}) {
  const [category, setCategory] = useState('warm');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !session) return;
    setCategory('warm');
    setOutcome('');
    setNotes('');
    setError('');
  }, [open, session]);

  if (!session) return null;

  const durationSeconds = Math.max(0, Math.round(Number(session.durationSeconds) || 0));
  const options = getOutcomesForCategory(category);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!outcome) {
      setError('Select a status option');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await addCallNote(session.leadId, {
        outcome,
        notes: notes.trim(),
        durationSeconds,
        startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : undefined,
        endedAt: session.endedAt ? new Date(session.endedAt).toISOString() : new Date().toISOString(),
        scheduleNextCall: true,
        category,
        statusReason: notes.trim() ? `${outcome} — ${notes.trim()}` : outcome,
      });
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save call');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal open={open} onClose={() => !saving && onClose?.()} size="md">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white">
            <Phone className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-content-primary">Call follow-up</h3>
            <p className="text-sm text-content-muted">{session.leadName}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-sky-700">
              Duration: {formatCallDurationExact(durationSeconds)}
            </p>
            <p className="mt-1 text-[11px] font-medium text-violet-600">
              Set Warm / Hot / Cold from this call. Next reminder in 2 hours.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-content-muted">
            Status *
          </label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setOutcome('');
            }}
            className="w-full rounded-xl border border-subtle bg-white p-3 text-sm font-medium"
          >
            {FOLLOWUP_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
            Option *
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {options.map((item) => {
              const selected = outcome === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setOutcome(item.value)}
                  className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    selected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-subtle bg-white text-content-secondary hover:border-blue-300'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-content-muted">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-subtle bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
            placeholder="Anything useful from the call…"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onClose?.()}>
            Skip
          </Button>
          <Button type="submit" disabled={saving || !outcome} className="bg-blue-600 text-white hover:bg-blue-500">
            {saving ? 'Saving…' : 'Save status'}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
