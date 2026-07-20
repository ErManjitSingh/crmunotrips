import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Briefcase } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

const STATUS_TONE = {
  open: 'bg-emerald-50 text-emerald-700',
  on_hold: 'bg-amber-50 text-amber-700',
  closed: 'bg-slate-100 text-slate-600',
  filled: 'bg-violet-50 text-violet-700',
};

export default function HrJobOpeningsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['hr', 'jobs', status],
    queryFn: () => hrApi.jobs({ status: status || undefined }),
  });
  const { data: departments = [] } = useQuery({ queryKey: ['hr', 'departments'], queryFn: hrApi.departments });
  const [form, setForm] = useState({
    title: '',
    departmentId: '',
    openings: 1,
    location: '',
    employmentType: 'full_time',
    description: '',
  });

  const create = async () => {
    if (!form.title.trim()) return;
    await hrApi.createJob(form);
    setForm({ title: '', departmentId: '', openings: 1, location: '', employmentType: 'full_time', description: '' });
    qc.invalidateQueries({ queryKey: ['hr', 'jobs'] });
  };

  const setJobStatus = async (id, next) => {
    await hrApi.updateJob(id, { status: next });
    qc.invalidateQueries({ queryKey: ['hr', 'jobs'] });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete job opening?')) return;
    await hrApi.deleteJob(id);
    qc.invalidateQueries({ queryKey: ['hr', 'jobs'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Job Openings"
        description="Publish roles and track open headcount"
        breadcrumbs={['HR', 'Job Openings']}
      />

      <div className="grid gap-3 rounded-2xl border border-subtle bg-white p-4 shadow-sm md:grid-cols-3">
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Job title" className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" />
        <input type="number" min={1} value={form.openings} onChange={(e) => setForm((f) => ({ ...f, openings: Number(e.target.value) }))} placeholder="Openings" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <select value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="">Department</option>
          {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Location" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <select value={form.employmentType} onChange={(e) => setForm((f) => ({ ...f, employmentType: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="full_time">Full Time</option>
          <option value="part_time">Part Time</option>
          <option value="contract">Contract</option>
          <option value="intern">Intern</option>
        </select>
        <Button onClick={create} className="h-10 rounded-xl bg-[#5D5FEF] text-white md:col-span-3"><Plus className="mr-1 h-4 w-4" /> Post Opening</Button>
      </div>

      <div className="flex gap-2">
        {['', 'open', 'on_hold', 'filled', 'closed'].map((s) => (
          <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold capitalize', status === s ? 'bg-[#5D5FEF] text-white' : 'border border-slate-200 bg-white text-slate-600')}>
            {s?.replace(/_/g, ' ') || 'All'}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400 md:col-span-2">No job openings yet</div>
        ) : rows.map((r) => (
          <div key={r._id} className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{r.title}</h3>
                  <p className="text-xs text-slate-500">
                    {r.departmentId?.name || 'Any dept'} · {r.location || 'Remote/Hybrid'} · {r.openings} seat{r.openings > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', STATUS_TONE[r.status])}>{r.status?.replace(/_/g, ' ')}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {r.status === 'open' && (
                <>
                  <button type="button" onClick={() => setJobStatus(r._id, 'on_hold')} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">Hold</button>
                  <button type="button" onClick={() => setJobStatus(r._id, 'filled')} className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Mark Filled</button>
                </>
              )}
              {r.status === 'on_hold' && (
                <button type="button" onClick={() => setJobStatus(r._id, 'open')} className="rounded-lg bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">Reopen</button>
              )}
              <button type="button" onClick={() => remove(r._id)} className="ml-auto rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
