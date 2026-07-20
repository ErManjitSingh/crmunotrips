import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, PartyPopper, CalendarDays } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

const TYPES = [
  ['company', 'Company'],
  ['office', 'Office'],
  ['townhall', 'Townhall'],
  ['achievement', 'Achievement'],
  ['policy', 'Policy'],
  ['birthday', 'Birthday'],
  ['other', 'Other'],
];

export default function HrEventsPage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['hr', 'events'],
    queryFn: () => hrApi.events(),
  });
  const [form, setForm] = useState({
    title: '',
    type: 'company',
    startAt: '',
    location: '',
    description: '',
  });

  const create = async () => {
    if (!form.title.trim() || !form.startAt) return;
    await hrApi.createEvent(form);
    setForm({ title: '', type: 'company', startAt: '', location: '', description: '' });
    qc.invalidateQueries({ queryKey: ['hr', 'events'] });
  };

  const complete = async (id) => {
    await hrApi.updateEvent(id, { status: 'completed' });
    qc.invalidateQueries({ queryKey: ['hr', 'events'] });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete event?')) return;
    await hrApi.deleteEvent(id);
    qc.invalidateQueries({ queryKey: ['hr', 'events'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Events"
        description="Office events, celebrations and townhalls"
        breadcrumbs={['HR', 'Events']}
      />

      <div className="grid gap-3 rounded-2xl border border-subtle bg-white p-4 shadow-sm md:grid-cols-3">
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Event title" className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" />
        <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input type="datetime-local" value={form.startAt} onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Location" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <Button onClick={create} className="h-10 rounded-xl bg-[#5D5FEF] text-white md:col-span-3"><Plus className="mr-1 h-4 w-4" /> Create Event</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400 md:col-span-2">No events yet</div>
        ) : rows.map((r) => (
          <div key={r._id} className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <PartyPopper className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{r.title}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {new Date(r.startAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {r.location ? ` · ${r.location}` : ''}
                  </p>
                  <p className="mt-1 text-[11px] capitalize text-slate-400">{r.type}</p>
                </div>
              </div>
              <span className={cn(
                'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                r.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-50 text-violet-700'
              )}>{r.status}</span>
            </div>
            <div className="mt-3 flex gap-2">
              {r.status !== 'completed' && (
                <button type="button" onClick={() => complete(r._id)} className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Complete</button>
              )}
              <button type="button" onClick={() => remove(r._id)} className="ml-auto rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
