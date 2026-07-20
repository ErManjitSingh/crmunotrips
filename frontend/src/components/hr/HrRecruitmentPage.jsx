import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];

const STAGE_TONE = {
  applied: 'bg-sky-50 text-sky-700',
  screening: 'bg-amber-50 text-amber-700',
  interview: 'bg-violet-50 text-violet-700',
  offer: 'bg-emerald-50 text-emerald-700',
  hired: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-rose-50 text-rose-700',
};

function candName(c) {
  return [c?.firstName, c?.lastName].filter(Boolean).join(' ') || '—';
}

export default function HrRecruitmentPage() {
  const qc = useQueryClient();
  const [stage, setStage] = useState('');
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['hr', 'candidates', stage],
    queryFn: () => hrApi.candidates({ stage: stage || undefined }),
  });
  const { data: funnel = [] } = useQuery({
    queryKey: ['hr', 'funnel'],
    queryFn: hrApi.recruitmentFunnel,
  });
  const { data: jobs = [] } = useQuery({
    queryKey: ['hr', 'jobs', 'open'],
    queryFn: () => hrApi.jobs({ status: 'open' }),
  });
  const [form, setForm] = useState({
    jobOpeningId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    resumeUrl: '',
    source: 'direct',
  });

  const maxFunnel = useMemo(() => Math.max(1, ...funnel.map((f) => f.count || 0)), [funnel]);

  const create = async () => {
    if (!form.jobOpeningId || !form.firstName.trim()) return;
    await hrApi.createCandidate(form);
    setForm({ jobOpeningId: '', firstName: '', lastName: '', email: '', phone: '', resumeUrl: '', source: 'direct' });
    qc.invalidateQueries({ queryKey: ['hr', 'candidates'] });
    qc.invalidateQueries({ queryKey: ['hr', 'funnel'] });
  };

  const moveStage = async (id, next) => {
    await hrApi.updateCandidate(id, { stage: next });
    qc.invalidateQueries({ queryKey: ['hr', 'candidates'] });
    qc.invalidateQueries({ queryKey: ['hr', 'funnel'] });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete candidate?')) return;
    await hrApi.deleteCandidate(id);
    qc.invalidateQueries({ queryKey: ['hr', 'candidates'] });
    qc.invalidateQueries({ queryKey: ['hr', 'funnel'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Recruitment"
        description="Candidate pipeline from application to offer"
        breadcrumbs={['HR', 'Recruitment']}
      />

      <div className="grid gap-2 rounded-2xl border border-subtle bg-white p-4 shadow-sm sm:grid-cols-3 lg:grid-cols-6">
        {funnel.map((f) => (
          <div key={f.stage} className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{f.stage}</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{f.count}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-[#5D5FEF]" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 rounded-2xl border border-subtle bg-white p-4 shadow-sm md:grid-cols-3">
        <select value={form.jobOpeningId} onChange={(e) => setForm((f) => ({ ...f, jobOpeningId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-3">
          <option value="">Select job opening</option>
          {jobs.map((j) => <option key={j._id} value={j._id}>{j.title}</option>)}
        </select>
        <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="First name" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Last name" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={form.resumeUrl} onChange={(e) => setForm((f) => ({ ...f, resumeUrl: e.target.value }))} placeholder="Resume URL" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <Button onClick={create} className="h-10 rounded-xl bg-[#5D5FEF] text-white"><Plus className="mr-1 h-4 w-4" /> Add Candidate</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setStage('')} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', !stage ? 'bg-[#5D5FEF] text-white' : 'border border-slate-200 bg-white text-slate-600')}>All</button>
        {STAGES.map((s) => (
          <button key={s} type="button" onClick={() => setStage(s)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold capitalize', stage === s ? 'bg-[#5D5FEF] text-white' : 'border border-slate-200 bg-white text-slate-600')}>{s}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Candidate</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3 text-right">Move / Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No candidates — add a job opening first</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id} className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{candName(r)}</p>
                  <p className="text-[11px] text-slate-400">{r.email || r.phone || '—'}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.jobOpeningId?.title || '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', STAGE_TONE[r.stage])}>{r.stage}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex flex-wrap items-center justify-end gap-1">
                    {STAGES.filter((s) => s !== r.stage).slice(0, 3).map((s) => (
                      <button key={s} type="button" onClick={() => moveStage(r._id, s)} className="rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-semibold capitalize text-slate-600 hover:bg-white">
                        {s}
                      </button>
                    ))}
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
