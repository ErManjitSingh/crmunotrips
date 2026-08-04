import { useMemo, useState } from 'react';
import { X, UserPlus, Search } from 'lucide-react';
import { Button } from '../ui/button';
import AppModal from '../ui/AppModal';

export default function AssignLeadModal({ open, lead, executives, onClose, onAssign }) {
  const isBulk = lead?.bulk;
  const isLostLead = ['lost', 'booked_from_another_company'].includes(lead?.status);
  const [userSearch, setUserSearch] = useState('');
  const [executiveId, setExecutiveId] = useState('');

  const filtered = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return executives || [];
    return (executives || []).filter((ex) => {
      const name = String(ex.name || '').toLowerCase();
      const email = String(ex.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [executives, userSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!executiveId) return;
    onAssign({
      executiveId,
      leadIds: isBulk ? undefined : [lead._id],
    });
  };

  const handleClose = () => {
    setUserSearch('');
    setExecutiveId('');
    onClose();
  };

  return (
    <AppModal open={open} onClose={handleClose} size="md" className="overflow-hidden">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-violet-600" />
            {isBulk ? `Assign ${lead?.count} Leads` : (isLostLead ? 'Reassign Lost Lead' : (lead?.assignedTo ? 'Reassign Lead' : 'Assign Lead'))}
          </h2>
          <button type="button" onClick={handleClose} className="p-2 rounded-xl hover:bg-surface-elevated"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {!isBulk && lead && (
            <div className="p-3 rounded-xl bg-surface-elevated/50 border border-subtle text-sm">
              <p className="font-semibold text-content-primary">{lead.name}</p>
              <p className="text-content-muted">{lead.destination} · {lead.sourceLabel}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-content-muted mb-1.5">Assign to Executive</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search sales executive…"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-subtle bg-white text-sm outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>
            <select
              name="executiveId"
              required
              value={executiveId}
              onChange={(e) => setExecutiveId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-subtle bg-surface-elevated/50 text-sm outline-none focus:ring-2 focus:ring-violet-500/30"
            >
              <option value="">Select executive…</option>
              {filtered.map((ex) => (
                <option key={ex._id} value={ex._id}>{ex.name} · {ex.leads ?? ex.assignedLeads ?? 0} leads</option>
              ))}
            </select>
            {!executives.length && (
              <p className="text-xs text-amber-600 mt-2">No active executives found. Add a Sales Executive user in Team Management.</p>
            )}
            {executives.length > 0 && filtered.length === 0 && (
              <p className="text-xs text-content-muted mt-2">No executive matches your search.</p>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={!executiveId || !executives.length}>Confirm Assignment</Button>
          </div>
        </div>
      </form>
    </AppModal>
  );
}
