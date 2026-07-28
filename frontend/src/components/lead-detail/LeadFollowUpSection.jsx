import { useState, useEffect } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import AddFollowUpModal from '../followups/AddFollowUpModal';
import FollowUpCategoryBadge from '../followups/FollowUpCategoryBadge';
import { createExecutiveFollowUp, buildFollowUpPayload } from '../followups/followupApi';
import { FOLLOWUP_CATEGORY_OPTIONS } from '../followups/constants';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function mapFollowUps(items = []) {
  return items.map((f, i) => ({
    id: f._id || `f-${i}`,
    date: f.scheduledAt,
    category: f.category || 'warm',
    type: f.type,
    remarks: f.notes || f.outcome || '',
  }));
}

export default function LeadFollowUpSection({
  followUps: initial = [],
  lead,
  canCreate = false,
  onRefresh,
  onFollowUpAdded,
  modalOpen: controlledOpen,
  onModalOpenChange,
}) {
  const [followUps, setFollowUps] = useState(() => mapFollowUps(initial));
  const [internalOpen, setInternalOpen] = useState(false);
  const modalOpen = controlledOpen ?? internalOpen;
  const setModalOpen = onModalOpenChange ?? setInternalOpen;

  useEffect(() => {
    setFollowUps(mapFollowUps(initial));
  }, [initial, lead?._id]);

  const display = followUps.length ? followUps : mapFollowUps(initial);

  const handleAdd = async (form) => {
    if (!canCreate || !lead?._id) {
      throw new Error('Cannot add follow-up');
    }
    const created = await createExecutiveFollowUp(buildFollowUpPayload({ ...form, lead: lead._id }));
    setFollowUps((prev) => [
      {
        id: created._id,
        date: created.scheduledAt,
        category: created.category || 'warm',
        type: created.type,
        remarks: created.notes || '',
      },
      ...prev,
    ]);
    onFollowUpAdded?.(created);
    await onRefresh?.({ silent: true });
    return created;
  };

  return (
    <>
      <div className="rounded-2xl border border-subtle bg-surface shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-subtle flex items-center justify-between bg-surface-elevated/40">
          <div>
            <h3 className="text-[15px] font-semibold text-content-primary">Follow-ups</h3>
            <p className="text-xs text-content-muted mt-0.5">
              {canCreate
                ? 'Warm · Cold · Converted · Expected Conv.'
                : 'View only — executives add follow-ups'}
            </p>
          </div>
          {canCreate && (
            <Button
              size="sm"
              className="rounded-lg h-8 text-xs bg-violet-600 hover:bg-violet-500 text-white"
              onClick={() => setModalOpen(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add
            </Button>
          )}
        </div>

        <div className="px-5 pb-5 pt-4 space-y-2">
          {display.length === 0 ? (
            <p className="text-sm text-content-muted py-6 text-center">No follow-ups yet. Click Add to save one.</p>
          ) : (
            display.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-subtle/80 hover:bg-surface-elevated/50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <FollowUpCategoryBadge category={f.category} />
                    {f.type && (
                      <span className="text-[10px] text-content-muted capitalize">{f.type}</span>
                    )}
                  </div>
                  <p className="text-sm text-content-primary">{f.remarks || '—'}</p>
                  <p className="text-xs text-content-muted flex items-center gap-1.5 mt-1">
                    <Calendar className="w-3 h-3" /> {fmt(f.date)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {canCreate && (
          <div className="px-5 pb-4 text-[10px] text-content-muted">
            Categories: {FOLLOWUP_CATEGORY_OPTIONS.map((c) => c.label).join(' · ')}
          </div>
        )}
      </div>

      {canCreate && (
        <AddFollowUpModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={handleAdd}
          fixedLeadId={lead?._id}
          fixedLeadName={lead?.name}
        />
      )}
    </>
  );
};
