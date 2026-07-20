import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Settings } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function HrSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'settings'],
    queryFn: hrApi.settings,
  });
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ ...data });
  }, [data]);

  const toggleDay = (day, field) => {
    setForm((f) => {
      const list = new Set(f[field] || []);
      if (list.has(day)) list.delete(day);
      else list.add(day);
      return { ...f, [field]: Array.from(list) };
    });
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      await hrApi.updateSettings(form);
      qc.invalidateQueries({ queryKey: ['hr', 'settings'] });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !form) {
    return <div className="py-20 text-center text-slate-400">Loading settings…</div>;
  }

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="HR Settings"
        description="Working days, office timings, leave quotas and payroll rules"
        breadcrumbs={['HR', 'Settings']}
        actions={(
          <Button onClick={save} disabled={saving} className="h-10 rounded-xl bg-[#5D5FEF] text-white">
            <Save className="mr-1 h-4 w-4" /> {saving ? 'Saving…' : 'Save Settings'}
          </Button>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Settings className="h-4 w-4 text-violet-500" />
            <h3 className="text-sm font-bold text-slate-900">Company & Timings</h3>
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Company Name</span>
              <input value={form.companyName || ''} onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Office Start</span>
                <input type="time" value={form.officeStart || '10:00'} onChange={(e) => setForm((f) => ({ ...f, officeStart: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Office End</span>
                <input type="time" value={form.officeEnd || '19:00'} onChange={(e) => setForm((f) => ({ ...f, officeEnd: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Late After (min)</span>
                <input type="number" value={form.lateAfterMinutes ?? 15} onChange={(e) => setForm((f) => ({ ...f, lateAfterMinutes: Number(e.target.value) }))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Half Day Hours</span>
                <input type="number" value={form.halfDayHours ?? 4} onChange={(e) => setForm((f) => ({ ...f, halfDayHours: Number(e.target.value) }))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-900">Working Days</h3>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const active = (form.workingDays || []).includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day, 'workingDays')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${active ? 'bg-[#5D5FEF] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <h3 className="mb-3 mt-5 text-sm font-bold text-slate-900">Weekend</h3>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const active = (form.weekend || []).includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day, 'weekend')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${active ? 'bg-amber-500 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-900">Leave Quotas (per year)</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              ['casualLeavePerYear', 'Casual'],
              ['sickLeavePerYear', 'Sick'],
              ['earnedLeavePerYear', 'Earned'],
            ].map(([key, label]) => (
              <label key={key} className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">{label}</span>
                <input type="number" value={form[key] ?? 0} onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-slate-900">Payroll & Notifications</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
              <span>PF Enabled</span>
              <input type="checkbox" checked={Boolean(form.pfEnabled)} onChange={(e) => setForm((f) => ({ ...f, pfEnabled: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
              <span>ESIC Enabled</span>
              <input type="checkbox" checked={Boolean(form.esicEnabled)} onChange={(e) => setForm((f) => ({ ...f, esicEnabled: e.target.checked }))} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">PF %</span>
              <input type="number" value={form.pfPercent ?? 12} onChange={(e) => setForm((f) => ({ ...f, pfPercent: Number(e.target.value) }))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
            </label>
            <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
              <span>Email Notifications</span>
              <input type="checkbox" checked={Boolean(form.emailNotifications)} onChange={(e) => setForm((f) => ({ ...f, emailNotifications: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
              <span>Birthday Reminders</span>
              <input type="checkbox" checked={Boolean(form.birthdayReminders)} onChange={(e) => setForm((f) => ({ ...f, birthdayReminders: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
              <span>Document Expiry Reminders</span>
              <input type="checkbox" checked={Boolean(form.documentExpiryReminders)} onChange={(e) => setForm((f) => ({ ...f, documentExpiryReminders: e.target.checked }))} />
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
