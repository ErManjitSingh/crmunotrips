import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import { addCallNote } from '../../services/leadEnterpriseApi';
import { formatCallDuration } from '../../lib/callSession';

export const CALL_OUTCOMES = [
  { value: 'interested', label: 'Interested' },
  { value: 'discussed_package', label: 'Discussed package' },
  { value: 'need_better_hotel', label: 'Need better hotel' },
  { value: 'budget_issue', label: 'Budget issue' },
  { value: 'call_back_later', label: 'Call back later' },
  { value: 'call_back_tomorrow', label: 'Call back tomorrow' },
  { value: 'busy', label: 'Busy / asked to call later' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'other', label: 'Other' },
];

function secondsToParts(total) {
  const s = Math.max(0, Math.round(Number(total) || 0));
  return { mins: Math.floor(s / 60), secs: s % 60 };
}

export default function PostCallFollowUpModal({
  open,
  session,
  onClose,
  onSaved,
}) {
  const [outcome, setOutcome] = useState('interested');
  const [notes, setNotes] = useState('');
  const [mins, setMins] = useState(0);
  const [secs, setSecs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !session) return;
    setOutcome('interested');
    setNotes('');
    setError('');
    const parts = secondsToParts(session.durationSeconds);
    setMins(parts.mins);
    setSecs(parts.secs);
  }, [open, session]);

  if (!session) return null;

  const durationSeconds = Math.max(0, Number(mins) * 60 + Number(secs));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!outcome) {
      setError('Select what happened on the call');
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
            <p className="text-sm text-content-muted">
              {session.leadName} · talk time ~ {formatCallDuration(durationSeconds)}
            </p>
            <p className="mt-1 text-[11px] font-medium text-violet-600">
              Next call reminder will be set automatically in 2 hours
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
            What happened on the call? *
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CALL_OUTCOMES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setOutcome(item.value)}
                className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  outcome === item.value
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-subtle bg-white text-content-secondary hover:border-blue-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Minutes</span>
            <input
              type="number"
              min={0}
              value={mins}
              onChange={(e) => setMins(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Seconds</span>
            <input
              type="number"
              min={0}
              max={59}
              value={secs}
              onChange={(e) => setSecs(Math.min(59, Number(e.target.value) || 0))}
              className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
            />
          </label>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-content-muted">
            Comments (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What did you discuss? Any next steps?"
            className="mt-1.5 w-full resize-none rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>
            Skip
          </Button>
          <Button type="submit" variant="emerald" disabled={saving}>
            {saving ? 'Saving…' : 'Save & set 2hr reminder'}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
