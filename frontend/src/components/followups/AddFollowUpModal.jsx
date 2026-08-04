import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import AppModal from '../ui/AppModal';
import {
  FOLLOWUP_PRIORITIES,
  FOLLOWUP_CATEGORY_OPTIONS,
  FOLLOWUP_TYPES,
  CALL_NOT_PICKED_REASONS,
  CALL_PICKED_OUTCOMES,
} from './constants';
import { COLD_LEAD_REASONS } from '../lead-wizard/constants';

const emptyForm = {
  lead: '',
  type: 'call',
  category: 'call_picked',
  date: '',
  time: '10:00',
  priority: 'medium',
  remarks: '',
  coldReason: '',
  notPickedReason: '',
  pickedOutcome: '',
};

function plusFourHoursLocal() {
  const d = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export default function AddFollowUpModal({
  open,
  onClose,
  onSubmit,
  leads = [],
  editData = null,
  fixedLeadId = null,
  fixedLeadName = null,
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editData) {
      const d = new Date(editData.scheduledAt);
      const pad = (n) => String(n).padStart(2, '0');
      const localDate = Number.isNaN(d.getTime())
        ? ''
        : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const localTime = Number.isNaN(d.getTime())
        ? '10:00'
        : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setForm({
        lead: editData.lead?._id || fixedLeadId || '',
        type: editData.type || 'call',
        category: editData.category || 'call_picked',
        date: localDate,
        time: localTime,
        priority: editData.priority || 'medium',
        remarks: editData.notes || '',
        coldReason: editData.coldReason || '',
        notPickedReason: editData.notPickedReason || (editData.category === 'call_not_picked' ? editData.outcome : '') || '',
        pickedOutcome: editData.pickedOutcome || (editData.category === 'call_picked' ? editData.outcome : '') || '',
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setForm({ ...emptyForm, lead: fixedLeadId || '', date: today });
    }
  }, [editData, open, fixedLeadId]);

  const applyCategoryDefaults = (nextCategory) => {
    if (nextCategory === 'cold') {
      const slot = plusFourHoursLocal();
      setForm((prev) => ({
        ...prev,
        category: 'cold',
        type: 'call',
        date: slot.date,
        time: slot.time,
        notPickedReason: '',
        pickedOutcome: '',
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      category: nextCategory,
      coldReason: nextCategory === 'cold' ? prev.coldReason : '',
      notPickedReason: nextCategory === 'call_not_picked' ? prev.notPickedReason : '',
      pickedOutcome: nextCategory === 'call_picked' ? prev.pickedOutcome : '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.date) {
      setError('Please select follow-up date');
      return;
    }
    if (!fixedLeadId && !editData && !form.lead) {
      setError('Please select a lead');
      return;
    }
    if (form.category === 'cold' && !form.coldReason) {
      setError('Please select why this is a cold lead');
      return;
    }
    if (form.category === 'call_not_picked' && !form.notPickedReason) {
      setError('Please select why the call was not picked');
      return;
    }
    if (form.category === 'call_picked' && !form.pickedOutcome) {
      setError('Please select a call picked outcome');
      return;
    }
    if (!form.remarks?.trim() && form.category !== 'cold' && form.category !== 'call_not_picked' && form.category !== 'call_picked') {
      setError('Please enter remarks');
      return;
    }

    setSaving(true);
    try {
      const coldLabel = COLD_LEAD_REASONS.find((r) => r.value === form.coldReason)?.label;
      const notPickedLabel = CALL_NOT_PICKED_REASONS.find((r) => r.value === form.notPickedReason)?.label;
      const pickedLabel = CALL_PICKED_OUTCOMES.find((r) => r.value === form.pickedOutcome)?.label;

      let remarks = form.remarks?.trim() || '';
      if (form.category === 'cold') {
        remarks = [remarks, coldLabel ? `Cold reason: ${coldLabel}` : '']
          .filter(Boolean)
          .join(' — ') || `Cold lead — ${coldLabel}`;
      } else if (form.category === 'call_not_picked') {
        remarks = [remarks, notPickedLabel ? `Call not picked: ${notPickedLabel}` : '']
          .filter(Boolean)
          .join(' — ') || `Call not picked — ${notPickedLabel}`;
      } else if (form.category === 'call_picked') {
        remarks = [remarks, pickedLabel ? `Call picked: ${pickedLabel}` : '']
          .filter(Boolean)
          .join(' — ') || `Call picked — ${pickedLabel}`;
      }

      await onSubmit({
        ...form,
        lead: fixedLeadId || form.lead,
        scheduledAt: `${form.date}T${form.time}:00`,
        notes: remarks,
        coldReason: form.category === 'cold' ? form.coldReason : undefined,
        notPickedReason: form.category === 'call_not_picked' ? form.notPickedReason : undefined,
        pickedOutcome: form.category === 'call_picked' ? form.pickedOutcome : undefined,
        outcome: form.category === 'call_not_picked'
          ? form.notPickedReason
          : form.category === 'call_picked'
            ? form.pickedOutcome
            : undefined,
      });
      if (!editData) {
        const today = new Date().toISOString().split('T')[0];
        setForm({ ...emptyForm, lead: fixedLeadId || '', date: today });
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save follow-up');
    } finally {
      setSaving(false);
    }
  };

  const remarksOptional = form.category === 'cold' || form.category === 'call_not_picked' || form.category === 'call_picked';

  return (
    <AppModal open={open} onClose={onClose} size="lg" className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-content-primary">{editData ? 'Update Follow-up' : 'Lead follow up'}</h3>
          <p className="text-xs text-content-muted">
            {fixedLeadName || 'Select category, date & save'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-surface-elevated"><X className="w-5 h-5" /></button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
        )}

        {!editData && !fixedLeadId && (
          <div>
            <label className="text-xs font-medium text-content-muted mb-1 block">Lead *</label>
            <select
              value={form.lead}
              onChange={(e) => setForm({ ...form, lead: e.target.value })}
              required
              className="input-premium w-full h-11 rounded-xl"
            >
              <option value="">Select lead</option>
              {leads.map((l) => (
                <option key={l._id} value={l._id}>{l.name} — {l.destination}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-content-muted mb-1 block">Follow-up Category *</label>
          <select
            value={form.category}
            onChange={(e) => applyCategoryDefaults(e.target.value)}
            required
            className="input-premium w-full h-11 rounded-xl font-medium"
          >
            {FOLLOWUP_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {form.category === 'call_picked' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 space-y-3">
            <p className="text-xs font-semibold text-emerald-800">
              Call picked — select the outcome
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CALL_PICKED_OUTCOMES.map((outcome) => (
                <button
                  key={outcome.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, pickedOutcome: outcome.value }))}
                  className={`text-left px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                    form.pickedOutcome === outcome.value
                      ? 'border-emerald-500 bg-emerald-100 text-emerald-900'
                      : 'border-subtle bg-white text-content-secondary hover:border-emerald-300'
                  }`}
                >
                  {outcome.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {form.category === 'call_not_picked' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 space-y-3">
            <p className="text-xs font-semibold text-amber-800">
              Call not picked — select the reason
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CALL_NOT_PICKED_REASONS.map((reason) => (
                <button
                  key={reason.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, notPickedReason: reason.value }))}
                  className={`text-left px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                    form.notPickedReason === reason.value
                      ? 'border-amber-500 bg-amber-100 text-amber-900'
                      : 'border-subtle bg-white text-content-secondary hover:border-amber-300'
                  }`}
                >
                  {reason.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {form.category === 'cold' && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3 space-y-3">
            <p className="text-xs font-semibold text-sky-800">
              Cold lead selected — choose why, and a 4-hour call reminder will be set automatically.
            </p>
            <div>
              <label className="text-xs font-medium text-content-muted mb-1 block">Why is this cold? *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COLD_LEAD_REASONS.map((reason) => (
                  <button
                    key={reason.value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, coldReason: reason.value }))}
                    className={`text-left px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      form.coldReason === reason.value
                        ? 'border-sky-500 bg-sky-100 text-sky-800'
                        : 'border-subtle bg-white text-content-secondary hover:border-sky-300'
                    }`}
                  >
                    {reason.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-content-muted mb-1 block">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-premium w-full h-11 rounded-xl">
              {FOLLOWUP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-content-muted mb-1 block">Intent</label>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input-premium w-full h-11 rounded-xl">
              {FOLLOWUP_PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-content-muted mb-1 block">Date *</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="input-premium w-full h-11 rounded-xl" />
          </div>
          <div>
            <label className="text-xs font-medium text-content-muted mb-1 block">Time *</label>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required className="input-premium w-full h-11 rounded-xl" />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-content-muted mb-1 block">
            Comments {remarksOptional ? '(optional)' : '*'}
          </label>
          <textarea
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            required={!remarksOptional}
            rows={3}
            className="input-premium w-full rounded-xl resize-none"
            placeholder={
              form.category === 'cold'
                ? 'Add notes about this cold lead…'
                : form.category === 'call_not_picked'
                  ? 'Optional notes…'
                  : form.category === 'call_picked'
                    ? 'Optional notes about the call…'
                    : 'What to discuss on this follow-up...'
            }
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1 rounded-xl" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="violet" className="flex-1 rounded-xl" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
