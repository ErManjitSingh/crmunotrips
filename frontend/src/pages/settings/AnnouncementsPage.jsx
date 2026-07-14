import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Plus, Pencil, Trash2, Pin, Sparkles } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/button';
import AppModal from '../../components/ui/AppModal';
import {
  createAnnouncement,
  deleteAnnouncement,
  fetchAnnouncementsAdmin,
  seedAnnouncementDemo,
  updateAnnouncement,
} from '../../services/announcementApi';
import {
  ANNOUNCEMENT_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  ROLE_OPTIONS,
} from '../../components/announcements/announcementThemes';
import { cn } from '../../lib/utils';

const EMPTY_FORM = {
  title: '',
  description: '',
  bodyHtml: '',
  type: 'offer',
  priority: 'high',
  badge: '🔥 Limited Offer',
  tags: 'Travel Contest, Bonus, Limited Time',
  audienceRoles: ['sales_executive'],
  publishAt: '',
  expiresAt: '',
  pinToDashboard: true,
  enablePopup: true,
  ctaText: 'View Details',
  ctaUrl: '',
  secondaryCtaText: 'Participate Now',
  secondaryCtaUrl: '',
  progressLabel: 'Campaign Progress',
  progressPercent: 72,
  active: true,
};

function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return fetchAnnouncementsAdmin()
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      title: item.title || '',
      description: item.description || '',
      bodyHtml: item.bodyHtml || '',
      type: item.type || 'update',
      priority: item.priority || 'normal',
      badge: item.badge || '',
      tags: (item.tags || []).join(', '),
      audienceRoles: item.audienceRoles?.length ? item.audienceRoles : ['sales_executive'],
      publishAt: toLocalInput(item.publishAt),
      expiresAt: toLocalInput(item.expiresAt),
      pinToDashboard: !!item.pinToDashboard,
      enablePopup: !!item.enablePopup,
      ctaText: item.ctaText || 'View Details',
      ctaUrl: item.ctaUrl || '',
      secondaryCtaText: item.secondaryCtaText || 'Participate Now',
      secondaryCtaUrl: item.secondaryCtaUrl || '',
      progressLabel: item.progressLabel || 'Campaign Progress',
      progressPercent: item.progressPercent ?? '',
      active: item.active !== false,
    });
    setModalOpen(true);
  };

  const buildPayload = () => ({
    title: form.title.trim(),
    description: form.description.trim(),
    bodyHtml: form.bodyHtml,
    type: form.type,
    priority: form.priority,
    badge: form.badge,
    tags: form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
    audienceRoles: form.audienceRoles,
    publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : new Date().toISOString(),
    expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
    pinToDashboard: form.pinToDashboard,
    enablePopup: form.enablePopup,
    ctaText: form.ctaText,
    ctaUrl: form.ctaUrl,
    secondaryCtaText: form.secondaryCtaText,
    secondaryCtaUrl: form.secondaryCtaUrl,
    progressLabel: form.progressLabel,
    progressPercent:
      form.progressPercent === '' || form.progressPercent == null
        ? null
        : Number(form.progressPercent),
    active: form.active,
  });

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) await updateAnnouncement(editing._id, payload);
      else await createAnnouncement(payload);
      setModalOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    await deleteAnnouncement(id);
    await load();
  };

  const handleSeed = async () => {
    await seedAnnouncementDemo();
    await load();
  };

  const toggleRole = (role) => {
    setForm((prev) => {
      const has = prev.audienceRoles.includes(role);
      return {
        ...prev,
        audienceRoles: has
          ? prev.audienceRoles.filter((r) => r !== role)
          : [...prev.audienceRoles, role],
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Announcements"
          description="Create promotions, contests, targets & notices for the sales team"
          breadcrumbs={['Settings', 'Announcements']}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleSeed} className="rounded-xl gap-2">
            <Sparkles className="w-4 h-4" /> Seed Demo
          </Button>
          <Button onClick={openCreate} className="rounded-xl gap-2">
            <Plus className="w-4 h-4" /> New Announcement
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-subtle bg-surface overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-content-muted">Loading…</div>
        ) : !items.length ? (
          <div className="p-12 text-center">
            <Megaphone className="mx-auto mb-3 h-8 w-8 text-content-muted" />
            <p className="text-content-muted">No announcements yet. Create one or seed demo data.</p>
          </div>
        ) : (
          <div className="divide-y divide-subtle">
            {items.map((item) => (
              <div key={item._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-content-primary truncate">{item.title}</h3>
                    {item.pinToDashboard && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-600">
                        <Pin className="h-3 w-3" /> Pinned
                      </span>
                    )}
                    <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-semibold uppercase text-content-muted">
                      {item.type}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                        item.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'
                      )}
                    >
                      {item.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-content-secondary">{item.description}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" className="rounded-lg gap-1" onClick={() => openEdit(item)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-lg gap-1 text-red-600" onClick={() => handleDelete(item._id)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AppModal open={modalOpen} onClose={() => setModalOpen(false)} size="2xl" className="p-6">
        <h3 className="mb-4 text-lg font-bold text-content-primary">
          {editing ? 'Edit Announcement' : 'Create Announcement'}
        </h3>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-content-muted">Title</span>
              <input className="input-premium h-10 w-full rounded-xl" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-content-muted">Description</span>
              <textarea className="input-premium min-h-[80px] w-full rounded-xl p-3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <label className="sm:col-span-2">
              <span className="mb-1 block text-xs font-medium text-content-muted">Rich Body (HTML)</span>
              <textarea className="input-premium min-h-[100px] w-full rounded-xl p-3 font-mono text-xs" value={form.bodyHtml} onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-content-muted">Type</span>
              <select className="input-premium h-10 w-full rounded-xl" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {ANNOUNCEMENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-content-muted">Priority</span>
              <select className="input-premium h-10 w-full rounded-xl" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-content-muted">Badge</span>
              <input className="input-premium h-10 w-full rounded-xl" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-content-muted">Tags (comma separated)</span>
              <input className="input-premium h-10 w-full rounded-xl" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-content-muted">Publish At</span>
              <input type="datetime-local" className="input-premium h-10 w-full rounded-xl" value={form.publishAt} onChange={(e) => setForm({ ...form, publishAt: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-content-muted">Expires At</span>
              <input type="datetime-local" className="input-premium h-10 w-full rounded-xl" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-content-muted">CTA Text</span>
              <input className="input-premium h-10 w-full rounded-xl" value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-content-muted">CTA URL</span>
              <input className="input-premium h-10 w-full rounded-xl" value={form.ctaUrl} onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-content-muted">Secondary CTA</span>
              <input className="input-premium h-10 w-full rounded-xl" value={form.secondaryCtaText} onChange={(e) => setForm({ ...form, secondaryCtaText: e.target.value })} />
            </label>
            <label>
              <span className="mb-1 block text-xs font-medium text-content-muted">Progress %</span>
              <input type="number" min="0" max="100" className="input-premium h-10 w-full rounded-xl" value={form.progressPercent} onChange={(e) => setForm({ ...form, progressPercent: e.target.value })} />
            </label>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-content-muted">Audience Roles</p>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => toggleRole(role.value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold',
                    form.audienceRoles.includes(role.value)
                      ? 'border-violet-500 bg-violet-500 text-white'
                      : 'border-subtle text-content-secondary'
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            {[
              ['pinToDashboard', 'Pin to Dashboard'],
              ['enablePopup', 'Enable Popup'],
              ['active', 'Active'],
            ].map(([key, label]) => (
              <label key={key} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-subtle pt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl">
              {saving ? 'Saving…' : editing ? 'Update' : 'Publish'}
            </Button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
