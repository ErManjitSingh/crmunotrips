import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import { addCallNote } from '../../services/leadEnterpriseApi';
import { formatCallDurationExact } from '../../lib/callSession';

/** Outcomes when the call was picked / connected */
export const CALL_PICKED_OUTCOMES = [
  { value: 'interested', label: 'Interested' },
  { value: 'discussed_package', label: 'Discussed package' },
  { value: 'need_better_hotel', label: 'Need better hotel' },
  { value: 'budget_issue', label: 'Budget issue' },
  { value: 'call_back_later', label: 'Call back later' },
  { value: 'call_back_tomorrow', label: 'Call back tomorrow' },
  { value: 'busy', label: 'Busy / asked to call later' },
  { value: 'not_interested', label: 'Declined / Not interested' },
  { value: 'other', label: 'Other' },
];

/** Kept for CallNoteModal / older imports */
export const CALL_OUTCOMES = [
  ...CALL_PICKED_OUTCOMES,
  { value: 'no_answer', label: 'No answer / Not picked' },
];

export default function PostCallFollowUpModal({
  open,
  session,
  onClose,
  onSaved,
}) {
  const [callResult, setCallResult] = useState('picked'); // picked | not_picked
  const [outcome, setOutcome] = useState('interested');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !session) return;
    setCallResult('picked');
    setOutcome('interested');
    setNotes('');
    setError('');
  }, [open, session]);

  if (!session) return null;

  const durationSeconds = Math.max(0, Math.round(Number(session.durationSeconds) || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalOutcome = callResult === 'not_picked' ? 'no_answer' : outcome;
    if (callResult === 'picked' && !outcome) {
      setError('Select what happened on the call');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const saved = await addCallNote(session.leadId, {
        outcome: finalOutcome,
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
            <p className="text-sm text-content-muted">{session.leadName}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-sky-700">
              Duration: {formatCallDurationExact(durationSeconds)}
            </p>
            <p className="mt-1 text-[11px] font-medium text-violet-600">
              Call picked → lead moves to Connected. Next reminder in 2 hours.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
            Was the call picked? *
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setCallResult('picked');
                if (outcome === 'no_answer') setOutcome('interested');
              }}
              className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
                callResult === 'picked'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-subtle bg-white text-content-secondary hover:border-emerald-300'
              }`}
            >
              Call picked
            </button>
            <button
              type="button"
              onClick={() => setCallResult('not_picked')}
              className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors ${
                callResult === 'not_picked'
                  ? 'border-amber-500 bg-amber-50 text-amber-900'
                  : 'border-subtle bg-white text-content-secondary hover:border-amber-300'
              }`}
            >
              Not picked
            </button>
          </div>
        </div>

        {callResult === 'picked' ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">
              What happened on the call? *
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CALL_PICKED_OUTCOMES.map((item) => {
                const isDecline = item.value === 'not_interested';
                const selected = outcome === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setOutcome(item.value)}
                    className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                      selected && isDecline
                        ? 'border-red-600 bg-red-600 text-white'
                        : selected
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : isDecline
                            ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-400'
                            : 'border-subtle bg-white text-content-secondary hover:border-blue-300'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            Lead stays in New. It will not move to Connected until the call is picked.
          </p>
        )}

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
          <Button type="submit" disabled={saving} className="bg-blue-600 text-white hover:bg-blue-500">
            {saving ? 'Saving…' : callResult === 'picked' ? 'Save → Connected' : 'Save'}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
