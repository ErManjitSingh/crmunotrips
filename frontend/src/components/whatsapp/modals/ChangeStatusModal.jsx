import { useState } from 'react';
import AppModal from '../../ui/AppModal';
import { Button } from '../../ui/button';
import LeadStatusBadge from '../../leads/LeadStatusBadge';
import { LEAD_STATUSES } from '../constants';

export default function ChangeStatusModal({ open, onClose, onSubmit, currentStatus }) {
  const [status, setStatus] = useState(currentStatus || 'new');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(status);
    onClose();
  };

  return (
    <AppModal open={open} onClose={onClose} size="md">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-content-primary">Lead status</h3>
          <p className="text-sm text-content-secondary mt-1">Update the pipeline stage for this lead</p>
        </div>
        <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
          {LEAD_STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatus(s.value)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                status === s.value
                  ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/30'
                  : 'border-strong hover:bg-surface-secondary'
              }`}
            >
              <LeadStatusBadge status={s.value} />
              {status === s.value && <span className="text-emerald-500 text-xs font-medium">Selected</span>}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="emerald">Update Status</Button>
        </div>
      </form>
    </AppModal>
  );
}
