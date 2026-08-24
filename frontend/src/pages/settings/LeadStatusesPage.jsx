import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  RotateCcw,
  Save,
  Eye,
  EyeOff,
  Thermometer,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/button';
import AppModal from '../../components/ui/AppModal';
import {
  fetchLeadStatusConfigAdmin,
  saveLeadStatusConfig,
  resetLeadStatusConfig,
} from '../../services/leadStatusConfigApi';
import { setLeadStatusOptionsFromApi } from '../../lib/leadStatusOptionsStore';
import { toast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';

const CATEGORIES = [
  {
    key: 'warm',
    label: 'Warm',
    hint: 'Active conversations',
    tone: 'border-amber-200 bg-amber-50/40',
    badge: 'bg-amber-100 text-amber-800',
  },
  {
    key: 'hot',
    label: 'Hot',
    hint: 'Ready to book',
    tone: 'border-rose-200 bg-rose-50/40',
    badge: 'bg-rose-100 text-rose-800',
  },
  {
    key: 'cold',
    label: 'Cold',
    hint: 'Not progressing',
    tone: 'border-slate-200 bg-slate-50/60',
    badge: 'bg-slate-200 text-slate-700',
  },
];

function emptyOption() {
  return { key: '', label: '', enabled: true, sortOrder: 0 };
}

function slugify(label) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

export default function LeadStatusesPage() {
  const [config, setConfig] = useState({ warm: [], hot: [], cold: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [modal, setModal] = useState({ open: false, category: 'warm', index: -1, form: emptyOption() });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLeadStatusConfigAdmin();
      setConfig({
        warm: data.warm || [],
        hot: data.hot || [],
        cold: data.cold || [],
      });
      setLeadStatusOptionsFromApi(data);
      setDirty(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to load lead statuses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateCategory = (category, list) => {
    setConfig((prev) => ({ ...prev, [category]: list }));
    setDirty(true);
  };

  const openAdd = (category) => {
    setModal({
      open: true,
      category,
      index: -1,
      form: { ...emptyOption(), sortOrder: (config[category] || []).length },
    });
  };

  const openEdit = (category, index) => {
    const item = config[category][index];
    setModal({
      open: true,
      category,
      index,
      form: { ...item },
    });
  };

  const saveModal = () => {
    const label = String(modal.form.label || '').trim();
    if (!label) {
      toast.error('Label is required');
      return;
    }
    let key = String(modal.form.key || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!key) key = slugify(label);
    if (!key) {
      toast.error('Could not create a key from the label');
      return;
    }

    const nextItem = {
      key,
      label,
      enabled: modal.form.enabled !== false,
      sortOrder: Number(modal.form.sortOrder) || 0,
    };

    const list = [...(config[modal.category] || [])];
    if (modal.index >= 0) {
      list[modal.index] = nextItem;
    } else {
      list.push(nextItem);
    }
    updateCategory(modal.category, list.map((o, i) => ({ ...o, sortOrder: i })));
    setModal({ open: false, category: 'warm', index: -1, form: emptyOption() });
  };

  const toggleEnabled = (category, index) => {
    const list = [...config[category]];
    list[index] = { ...list[index], enabled: !list[index].enabled };
    updateCategory(category, list);
  };

  const removeOption = (category, index) => {
    const item = config[category][index];
    if (!window.confirm(`Remove “${item.label}”? Existing leads with this option keep their history.`)) {
      return;
    }
    updateCategory(
      category,
      config[category].filter((_, i) => i !== index).map((o, i) => ({ ...o, sortOrder: i }))
    );
  };

  const moveOption = (category, index, dir) => {
    const list = [...config[category]];
    const next = index + dir;
    if (next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    updateCategory(
      category,
      list.map((o, i) => ({ ...o, sortOrder: i }))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await saveLeadStatusConfig(config);
      setConfig({
        warm: data.warm || [],
        hot: data.hot || [],
        cold: data.cold || [],
      });
      setLeadStatusOptionsFromApi(data);
      setDirty(false);
      toast.success('Lead statuses saved — live for the whole CRM');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset Warm / Hot / Cold options to the default set?')) return;
    setSaving(true);
    try {
      const data = await resetLeadStatusConfig();
      setConfig({
        warm: data.warm || [],
        hot: data.hot || [],
        cold: data.cold || [],
      });
      setLeadStatusOptionsFromApi(data);
      setDirty(false);
      toast.success('Restored default lead statuses');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Status Control"
        description="Add, rename, reorder, or disable Warm / Hot / Cold options. Changes apply across CRM, WhatsApp, and follow-ups."
        breadcrumbs={['Settings', 'Lead Status']}
        actions={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={handleReset} disabled={saving || loading}>
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Reset defaults
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || loading || !dirty}>
              <Save className="w-4 h-4 mr-1.5" />
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}
      />

      <div className="rounded-2xl border border-orange-200/80 bg-orange-50/50 px-4 py-3 text-sm text-orange-900">
        <p className="font-semibold inline-flex items-center gap-2">
          <Thermometer className="w-4 h-4" />
          How it works
        </p>
        <ul className="mt-1.5 list-disc pl-5 space-y-0.5 text-orange-800/90">
          <li>Executives only see <strong>enabled</strong> options when setting lead status.</li>
          <li>Cold → Warm still moves the lead to <strong>Working Progress</strong> (system rule).</li>
          <li>Renaming keeps the same key so past leads stay counted correctly. Prefer edit label over delete.</li>
        </ul>
      </div>

      {loading ? (
        <p className="text-sm text-content-muted">Loading status options…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {CATEGORIES.map((cat) => (
            <section
              key={cat.key}
              className={cn('rounded-2xl border p-4 shadow-sm', cat.tone)}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold', cat.badge)}>
                    {cat.label}
                  </span>
                  <p className="text-xs text-content-muted mt-1">{cat.hint}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => openAdd(cat.key)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>

              <ul className="space-y-2">
                {(config[cat.key] || []).map((item, index) => (
                  <li
                    key={`${item.key}-${index}`}
                    className={cn(
                      'rounded-xl border border-white/80 bg-white/90 px-3 py-2.5 shadow-sm',
                      item.enabled === false && 'opacity-55'
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex flex-col gap-0.5 pt-0.5">
                        <button
                          type="button"
                          className="text-slate-400 hover:text-slate-600"
                          title="Move up"
                          onClick={() => moveOption(cat.key, index, -1)}
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-content-primary truncate">{item.label}</p>
                        <p className="text-[10px] font-mono text-content-muted truncate">{item.key}</p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                          title={item.enabled === false ? 'Enable' : 'Disable'}
                          onClick={() => toggleEnabled(cat.key, index)}
                        >
                          {item.enabled === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                          title="Edit"
                          onClick={() => openEdit(cat.key, index)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                          title="Remove"
                          onClick={() => removeOption(cat.key, index)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-slate-500 hover:text-slate-800"
                        onClick={() => moveOption(cat.key, index, -1)}
                      >
                        ↑ Up
                      </button>
                      <button
                        type="button"
                        className="text-[10px] font-semibold text-slate-500 hover:text-slate-800"
                        onClick={() => moveOption(cat.key, index, 1)}
                      >
                        ↓ Down
                      </button>
                    </div>
                  </li>
                ))}
                {!config[cat.key]?.length && (
                  <li className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-content-muted">
                    No options — click Add
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
      )}

      <AppModal
        open={modal.open}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
        size="md"
      >
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-content-primary">
              {modal.index >= 0 ? 'Edit option' : 'Add option'} — {modal.category}
            </h3>
            <p className="text-sm text-content-secondary mt-1">
              Label is what the team sees. Key is stored on leads (auto from label if blank).
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Label *
            </label>
            <input
              value={modal.form.label}
              onChange={(e) => {
                const label = e.target.value;
                setModal((m) => ({
                  ...m,
                  form: {
                    ...m.form,
                    label,
                    key: m.index >= 0 ? m.form.key : slugify(label),
                  },
                }));
              }}
              className="w-full rounded-xl border border-subtle bg-white p-3 text-sm font-medium"
              placeholder="e.g. Waiting for documents"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Key {modal.index >= 0 ? '(locked after create — edit carefully)' : '(auto)'}
            </label>
            <input
              value={modal.form.key}
              onChange={(e) =>
                setModal((m) => ({
                  ...m,
                  form: {
                    ...m.form,
                    key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
                  },
                }))
              }
              className="w-full rounded-xl border border-subtle bg-white p-3 text-sm font-mono"
              placeholder="waiting_for_documents"
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-content-primary">
            <input
              type="checkbox"
              checked={modal.form.enabled !== false}
              onChange={(e) =>
                setModal((m) => ({ ...m, form: { ...m.form, enabled: e.target.checked } }))
              }
            />
            Enabled (visible in status pickers)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModal((m) => ({ ...m, open: false }))}>
              Cancel
            </Button>
            <Button type="button" onClick={saveModal}>
              {modal.index >= 0 ? 'Update' : 'Add'}
            </Button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
