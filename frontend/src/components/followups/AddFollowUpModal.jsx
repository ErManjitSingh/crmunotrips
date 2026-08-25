import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import AppModal from '../ui/AppModal';
import {
  FOLLOWUP_PRIORITIES,
  FOLLOWUP_CATEGORY_OPTIONS,
  FOLLOWUP_TYPES,
  getOutcomesForCategory,
} from './constants';
import { buildLeadStatusPayload } from '../../lib/leadTemperatureStatus';
import { useLeadStatusOptions } from '../../context/LeadStatusOptionsContext';

const emptyForm = {
  lead: '',
  type: 'call',
  category: 'warm',
  date: '',
  time: '10:00',
  priority: 'medium',
  remarks: '',
  outcome: '',
};

function buildStatusFromCategory(form, lead = null) {
  const { category, outcome } = form;
  if (!outcome) return null;
  return buildLeadStatusPayload(category, outcome, form.remarks, lead);
}

export default function AddFollowUpModal({
  open,
  onClose,
  onSubmit,
  leads = [],
  editData = null,
  fixedLeadId = null,
  fixedLeadName = null,
  /** When true, also pushes lead status from the selected category/reason */
  showLeadOutcome = false,
  lead = null,
}) {
  const { loaded } = useLeadStatusOptions();
  void loaded;
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (editData) {
      const d = new Date(editData.scheduledAt);
      const pad2 = (n) => String(n).padStart(2, '0');
      const localDate = Number.isNaN(d.getTime())
        ? ''
        : `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      const localTime = Number.isNaN(d.getTime())
        ? '10:00'
        : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      let cat = editData.category === 'dead_lead' ? 'cold' : (editData.category || 'warm');
      if (cat === 'call_picked' || cat === 'call_not_picked') cat = 'warm';
      if (cat === 'lost') cat = 'cold';
      if (!['warm', 'hot', 'cold', 'converted'].includes(cat)) cat = 'warm';
      setForm({
        lead: editData.lead?._id || fixedLeadId || '',
        type: editData.type || 'call',
        category: cat,
        date: localDate,
        time: localTime,
        priority: editData.priority || 'medium',
        remarks: editData.notes || '',
        outcome:
          editData.outcome ||
          editData.pickedOutcome ||
          editData.warmOutcome ||
          editData.hotOutcome ||
          editData.coldReason ||
          editData.notPickedReason ||
          '',
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      setForm({
        ...emptyForm,
        lead: fixedLeadId || '',
        date: today,
      });
    }
  }, [editData, open, fixedLeadId, lead]);

  const outcomeOptions = getOutcomesForCategory(form.category);

  const applyCategoryDefaults = (nextCategory) => {
    setForm((prev) => ({
      ...prev,
      category: nextCategory,
      outcome: nextCategory === 'converted' ? 'converted' : '',
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
    if (!form.outcome) {
      setError(`Please select a ${form.category} option`);
      return;
    }

    setSaving(true);
    try {
      const outcomeLabel = outcomeOptions.find((r) => r.value === form.outcome)?.label;
      let remarks = form.remarks?.trim() || '';
      const prefix =
        form.category === 'warm'
          ? `Warm — ${outcomeLabel}`
          : form.category === 'hot'
            ? `Hot — ${outcomeLabel}`
            : form.category === 'converted'
              ? `Converted — ${outcomeLabel}`
              : `Cold — ${outcomeLabel}`;
      remarks = remarks ? `${prefix}. ${remarks}` : prefix;

      // Converted needs payment proof — use Lead follow up / Change status modal instead
      const statusUpdate =
        showLeadOutcome && form.category !== 'converted'
          ? buildStatusFromCategory(form, lead)
          : null;

      await onSubmit({
        ...form,
        lead: fixedLeadId || form.lead,
        scheduledAt: `${form.date}T${form.time}:00`,
        notes: remarks,
        category: form.category,
        coldReason: form.category === 'cold' ? form.outcome : undefined,
        pickedOutcome: form.category === 'warm' || form.category === 'hot' ? form.outcome : undefined,
        warmOutcome: form.category === 'warm' ? form.outcome : undefined,
        hotOutcome: form.category === 'hot' ? form.outcome : undefined,
        outcome: form.outcome,
        statusUpdate,
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

  return (
    <AppModal open={open} onClose={onClose} size="lg" className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-content-primary">{editData ? 'Update Follow-up' : 'Lead follow up'}</h3>
          <p className="text-xs text-content-muted">
            {fixedLeadName || 'Select Warm / Hot / Cold / Converted & option'}
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
          <label className="text-xs font-medium text-content-muted mb-1 block">Status *</label>
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

        <div className={`rounded-xl border p-3 space-y-3 ${
          form.category === 'hot'
            ? 'border-rose-200 bg-rose-50/80'
            : form.category === 'cold'
              ? 'border-sky-200 bg-sky-50/80'
              : 'border-amber-200 bg-amber-50/80'
        }`}>
          <p className={`text-xs font-semibold ${
            form.category === 'hot'
              ? 'text-rose-800'
              : form.category === 'cold'
                ? 'text-sky-800'
                : 'text-amber-800'
          }`}>
            {form.category === 'warm' && 'Warm — select option'}
            {form.category === 'hot' && 'Hot — select option'}
            {form.category === 'cold' && 'Cold — select option'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {outcomeOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, outcome: item.value }))}
                className={`text-left px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                  form.outcome === item.value
                    ? form.category === 'hot'
                      ? 'border-rose-500 bg-rose-100 text-rose-900'
                      : form.category === 'cold'
                        ? 'border-sky-500 bg-sky-100 text-sky-800'
                        : 'border-amber-500 bg-amber-100 text-amber-900'
                    : 'border-subtle bg-white text-content-secondary hover:border-amber-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

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
            Comments (optional)
          </label>
          <textarea
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            rows={3}
            className="input-premium w-full rounded-xl resize-none"
            placeholder="Optional notes…"
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
