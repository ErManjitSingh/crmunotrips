import { useState } from 'react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import { addCallNote } from '../../services/leadEnterpriseApi';
import { CALL_OUTCOMES } from './PostCallFollowUpModal';

export default function CallNoteModal({ open, onClose, leadId, onSaved }) {
  const [outcome, setOutcome] = useState('interested');
  const [notes, setNotes] = useState('');
  const [mins, setMins] = useState('');
  const [secs, setSecs] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!outcome) return;
    setSubmitting(true);
    try {
      const durationSeconds = (Number(mins) || 0) * 60 + (Number(secs) || 0);
      await addCallNote(leadId, {
        outcome,
        notes: notes.trim(),
        durationSeconds,
        scheduleNextCall: true,
      });
      setNotes('');
      setMins('');
      setSecs('');
      onSaved?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppModal open={open} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-content-primary">Log Call Note</h3>
          <p className="text-sm text-content-secondary mt-1">
            Record outcome — next call reminder auto-sets in 2 hours
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-content-muted uppercase tracking-wide">Outcome *</label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
          >
            {CALL_OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-content-muted uppercase tracking-wide">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="What was discussed? Next steps?"
            className="mt-1.5 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-content-muted uppercase tracking-wide">Minutes</label>
            <input
              type="number"
              min="0"
              value={mins}
              onChange={(e) => setMins(e.target.value)}
              placeholder="0"
              className="mt-1.5 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-muted uppercase tracking-wide">Seconds</label>
            <input
              type="number"
              min="0"
              max="59"
              value={secs}
              onChange={(e) => setSecs(e.target.value)}
              placeholder="0"
              className="mt-1.5 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="emerald" disabled={submitting || !outcome}>
            {submitting ? 'Saving...' : 'Save Call Note'}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
