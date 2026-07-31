import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Plus, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/button';
import Switch from '../../components/ui/switch';
import AppModal from '../../components/ui/AppModal';
import {
  fetchWhatsAppTemplates,
  createWhatsAppTemplate,
  updateWhatsAppTemplate,
  deleteWhatsAppTemplate,
} from '../../services/whatsappTemplatesApi';
import { usePermissions } from '../../hooks/usePermissions';

const EMPTY_FORM = { name: '', body: '', enabled: true, sortOrder: 0 };

export default function WhatsAppTemplatesPage() {
  const { can } = usePermissions();
  const canManage = can('whatsapp', 'manage');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return fetchWhatsAppTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (canManage) load();
  }, [canManage, load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (template) => {
    setEditing(template);
    setForm({
      name: template.name,
      body: template.body,
      enabled: template.enabled !== false,
      sortOrder: template.sortOrder || 0,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateWhatsAppTemplate(editing._id, form);
      } else {
        await createWhatsAppTemplate(form);
      }
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    await deleteWhatsAppTemplate(id);
    await load();
  };

  const toggleEnabled = async (template) => {
    await updateWhatsAppTemplate(template._id, { enabled: !template.enabled });
    await load();
  };

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-subtle bg-surface p-12 text-center text-content-muted">
        You do not have permission to manage WhatsApp templates.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="WhatsApp Templates"
          description="Predefined messages for quick customer contact — no chat sync or message storage"
          breadcrumbs={['Settings', 'WhatsApp Templates']}
        />
        <Button onClick={openCreate} className="rounded-xl gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white border-0">
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      <div className="rounded-2xl border border-subtle bg-surface overflow-hidden">
        {loading ? (
          <p className="p-12 text-center text-content-muted">Loading templates…</p>
        ) : templates.length === 0 ? (
          <p className="p-12 text-center text-content-muted">No templates yet</p>
        ) : (
          <div className="divide-y divide-subtle">
            {templates.map((template) => (
              <div key={template._id} className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-content-primary">{template.name}</h3>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${template.enabled ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-500/10 text-slate-600'}`}>
                        {template.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-sm text-content-secondary mt-2 whitespace-pre-line">{template.body}</p>
                    <p className="text-[11px] text-content-muted mt-2">
                      Variables: {'{{customerName}}'}, {'{{destination}}'}, {'{{executiveName}}'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={Boolean(template.enabled)}
                    size="sm"
                    tone="emerald"
                    aria-label={template.enabled ? 'Disable template' : 'Enable template'}
                    onCheckedChange={() => toggleEnabled(template)}
                  />
                  <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => openEdit(template)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="rounded-lg text-rose-600" onClick={() => handleDelete(template._id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AppModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} size="lg" className="p-6">
        <h3 className="text-lg font-bold text-content-primary mb-4">
          {editing ? 'Edit Template' : 'Create Template'}
        </h3>
        <div className="space-y-4">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Template name"
            className="w-full rounded-xl border border-subtle bg-surface-elevated p-3 text-sm"
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={8}
            placeholder="Message body with {{customerName}}, {{destination}}…"
            className="w-full rounded-xl border border-subtle bg-surface-elevated p-3 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-content-secondary">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            Enabled
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.body.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </AppModal>
    </div>
  );
}
