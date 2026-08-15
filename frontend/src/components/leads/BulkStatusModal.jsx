import { useState } from 'react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import LeadStatusBadge from './LeadStatusBadge';
import LostReasonSelect from './LostReasonSelect';
import { LEAD_STATUSES } from './constants';
import { buildLostStatusReason } from '../../constants/salesSop';
import { toast } from '../../context/ToastContext';

const LOST_STATUSES = new Set(['lost', 'booked_from_another_company']);

export default function BulkStatusModal({ open, onClose, count, onSubmit }) {
  const [status, setStatus] = useState('contacted');
  const [lostReason, setLostReason] = useState('');
  const [lostComment, setLostComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const needsLostReason = LOST_STATUSES.has(status);
  const canSubmit =
    !needsLostReason || Boolean(buildLostStatusReason(lostReason || (status === 'booked_from_another_company' ? 'booked_elsewhere' : ''), lostComment));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (needsLostReason) {
      const key = lostReason || (status === 'booked_from_another_company' ? 'booked_elsewhere' : '');
      if (!key) {
        toast.error('Select a lost reason');
        return;
      }
      if (!lostComment.trim()) {
        toast.error('Add a lost reason comment before marking as lost');
        return;
      }
    }

    setSubmitting(true);
    try {
      const statusReason = needsLostReason
        ? buildLostStatusReason(
            lostReason || (status === 'booked_from_another_company' ? 'booked_elsewhere' : ''),
            lostComment
          )
        : undefined;
      await onSubmit(status, statusReason);
      setLostReason('');
      setLostComment('');
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
        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
          {LEAD_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setStatus(s.value);
                if (!LOST_STATUSES.has(s.value)) {
                  setLostReason('');
                  setLostComment('');
                } else if (s.value === 'booked_from_another_company' && !lostReason) {
                  setLostReason('booked_elsewhere');
                }
              }}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                status === s.value
                  ? 'border-brand-500 bg-brand-500/5 ring-1 ring-brand-500/30'
                  : 'border-strong hover:bg-surface-secondary'
              }`}
            >
              <LeadStatusBadge status={s.value} />
              {status === s.value && <span className="text-brand-600 text-xs font-medium">Selected</span>}
            </button>
          ))}
        </div>

        {needsLostReason && (
          <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/70 p-3">
            <p className="text-xs font-semibold text-red-800">
              Lost reason and comment are required before status can be Lost.
            </p>
            <LostReasonSelect value={lostReason} onChange={setLostReason} />
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                Comment *
              </label>
              <textarea
                value={lostComment}
                onChange={(e) => setLostComment(e.target.value)}
                rows={3}
                required
                placeholder="Explain why this lead is lost…"
                className="w-full rounded-xl border border-subtle bg-white p-3 text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="default" disabled={submitting || !canSubmit}>
            {submitting ? 'Updating...' : 'Update Status'}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
