import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, CalendarClock, Check } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

function candName(c) {
  return [c?.firstName, c?.lastName].filter(Boolean).join(' ') || '—';
}

const STATUS_TONE = {
  scheduled: 'bg-violet-50 text-violet-700',
  completed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-slate-100 text-slate-600',
  no_show: 'bg-rose-50 text-rose-700',
};

export default function HrInterviewsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['hr', 'interviews', filter],
    queryFn: () =>
      filter === 'upcoming'
        ? hrApi.interviews({ upcoming: 'true' })
        : hrApi.interviews({ status: filter || undefined }),
  });
  const { data: candidates = [] } = useQuery({
    queryKey: ['hr', 'candidates', 'interview-picker'],
    queryFn: () => hrApi.candidates({ limit: 100 }),
  });
  const [form, setForm] = useState({
    candidateId: '',
    round: 'Round 1',
    scheduledAt: '',
    interviewer: '',
    mode: 'video',
  });

  const create = async () => {
    if (!form.candidateId || !form.scheduledAt) return;
    await hrApi.createInterview(form);
    setForm({ candidateId: '', round: 'Round 1', scheduledAt: '', interviewer: '', mode: 'video' });
    qc.invalidateQueries({ queryKey: ['hr', 'interviews'] });
    qc.invalidateQueries({ queryKey: ['hr', 'candidates'] });
    qc.invalidateQueries({ queryKey: ['hr', 'dashboard'] });
  };

  const complete = async (id) => {
    const rating = Number(window.prompt('Rating (1-5)', '4') || 0);
    const feedback = window.prompt('Feedback', '') || '';
    await hrApi.updateInterview(id, {
      status: 'completed',
      rating: rating >= 1 && rating <= 5 ? rating : 4,
      feedback,
      recommendation: 'hire',
    });
    qc.invalidateQueries({ queryKey: ['hr', 'interviews'] });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete interview?')) return;
    await hrApi.deleteInterview(id);
    qc.invalidateQueries({ queryKey: ['hr', 'interviews'] });
    qc.invalidateQueries({ queryKey: ['hr', 'dashboard'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Interviews"
        description="Schedule rounds and capture interviewer feedback"
        breadcrumbs={['HR', 'Interviews']}
      />

      <div className="grid gap-3 rounded-2xl border border-subtle bg-white p-4 shadow-sm md:grid-cols-3">
        <select value={form.candidateId} onChange={(e) => setForm((f) => ({ ...f, candidateId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2">
          <option value="">Select candidate</option>
          {candidates.map((c) => (
            <option key={c._id} value={c._id}>
              {candName(c)} — {c.jobOpeningId?.title || 'Role'}
            </option>
          ))}
        </select>
        <input value={form.round} onChange={(e) => setForm((f) => ({ ...f, round: e.target.value }))} placeholder="Round" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={form.interviewer} onChange={(e) => setForm((f) => ({ ...f, interviewer: e.target.value }))} placeholder="Interviewer" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="video">Video</option>
          <option value="in_person">In Person</option>
          <option value="phone">Phone</option>
        </select>
        <Button onClick={create} className="h-10 rounded-xl bg-[#5D5FEF] text-white md:col-span-3"><Plus className="mr-1 h-4 w-4" /> Schedule Interview</Button>
      </div>

      <div className="flex gap-2">
        {[
          ['', 'All'],
          ['upcoming', 'Upcoming'],
          ['scheduled', 'Scheduled'],
          ['completed', 'Completed'],
        ].map(([v, l]) => (
          <button key={v || 'all'} type="button" onClick={() => setFilter(v)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', filter === v ? 'bg-[#5D5FEF] text-white' : 'border border-slate-200 bg-white text-slate-600')}>
            {l}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Interview</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Interviewer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No interviews scheduled</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id} className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-violet-500" />
                    <div>
                      <p className="font-semibold text-slate-800">{candName(r.candidateId)}</p>
                      <p className="text-[11px] text-slate-400">{r.round} · {r.jobOpeningId?.title || '—'} · {r.mode?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(r.scheduledAt).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3 text-slate-600">{r.interviewer || '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', STATUS_TONE[r.status])}>{r.status?.replace(/_/g, ' ')}</span>
                  {r.rating ? <span className="ml-2 text-xs font-bold text-amber-600">{r.rating}/5</span> : null}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    {r.status === 'scheduled' && (
                      <button type="button" onClick={() => complete(r._id)} className="rounded-lg bg-emerald-50 p-2 text-emerald-600" title="Complete"><Check className="h-4 w-4" /></button>
                    )}
                    <button type="button" onClick={() => remove(r._id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
