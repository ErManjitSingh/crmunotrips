import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Trash2, TrendingUp } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

function fullName(e) {
  return [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.employeeCode || '—';
}

export default function HrPerformancePage() {
  const qc = useQueryClient();
  const [periodType, setPeriodType] = useState('');
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['hr', 'performance', periodType],
    queryFn: () => hrApi.performance({ periodType: periodType || undefined }),
  });
  const { data: employeesData } = useQuery({
    queryKey: ['hr', 'employees', 'perf-picker'],
    queryFn: () => hrApi.employees({ limit: 100, status: 'active' }),
  });
  const [form, setForm] = useState({
    employeeId: '',
    periodType: 'quarterly',
    periodLabel: '',
    rating: 3,
    achievements: '',
    managerFeedback: '',
    promotionSuggested: false,
    status: 'completed',
  });
  const employees = employeesData?.rows || [];

  const create = async () => {
    if (!form.employeeId || !form.periodLabel.trim()) return;
    await hrApi.createPerformance(form);
    setForm({
      employeeId: '',
      periodType: 'quarterly',
      periodLabel: '',
      rating: 3,
      achievements: '',
      managerFeedback: '',
      promotionSuggested: false,
      status: 'completed',
    });
    qc.invalidateQueries({ queryKey: ['hr', 'performance'] });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete review?')) return;
    await hrApi.deletePerformance(id);
    qc.invalidateQueries({ queryKey: ['hr', 'performance'] });
  };

  const avg =
    rows.length > 0
      ? Math.round((rows.reduce((s, r) => s + (Number(r.rating) || 0), 0) / rows.length) * 10) / 10
      : 0;

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Performance"
        description="Reviews, ratings, feedback and promotion suggestions"
        breadcrumbs={['HR', 'Performance']}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-subtle bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-slate-400">Reviews</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-subtle bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-slate-400">Avg Rating</p>
          <p className="mt-1 flex items-center gap-1 text-2xl font-bold text-amber-600">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" /> {avg || '—'}
          </p>
        </div>
        <div className="rounded-2xl border border-subtle bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase text-slate-400">Promotion Suggested</p>
          <p className="mt-1 flex items-center gap-1 text-2xl font-bold text-emerald-600">
            <TrendingUp className="h-5 w-5" /> {rows.filter((r) => r.promotionSuggested).length}
          </p>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-subtle bg-white p-4 shadow-sm md:grid-cols-3">
        <select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="">Select employee</option>
          {employees.map((e) => <option key={e._id} value={e._id}>{fullName(e)}</option>)}
        </select>
        <select value={form.periodType} onChange={(e) => setForm((f) => ({ ...f, periodType: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input value={form.periodLabel} onChange={(e) => setForm((f) => ({ ...f, periodLabel: e.target.value }))} placeholder="Period (e.g. Q2 2026)" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Rating
          <input type="range" min={1} max={5} value={form.rating} onChange={(e) => setForm((f) => ({ ...f, rating: Number(e.target.value) }))} className="flex-1" />
          <span className="font-bold text-amber-600">{form.rating}</span>
        </label>
        <input value={form.achievements} onChange={(e) => setForm((f) => ({ ...f, achievements: e.target.value }))} placeholder="Key achievements" className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" />
        <input value={form.managerFeedback} onChange={(e) => setForm((f) => ({ ...f, managerFeedback: e.target.value }))} placeholder="Manager feedback" className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" />
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.promotionSuggested} onChange={(e) => setForm((f) => ({ ...f, promotionSuggested: e.target.checked }))} />
          Suggest promotion
        </label>
        <Button onClick={create} className="h-10 rounded-xl bg-[#5D5FEF] text-white md:col-span-3"><Plus className="mr-1 h-4 w-4" /> Add Review</Button>
      </div>

      <div className="flex gap-2">
        {['', 'monthly', 'quarterly', 'yearly'].map((p) => (
          <button key={p || 'all'} type="button" onClick={() => setPeriodType(p)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold capitalize', periodType === p ? 'bg-[#5D5FEF] text-white' : 'border border-slate-200 bg-white text-slate-600')}>
            {p || 'All'}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Period</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Feedback</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No performance reviews yet</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id} className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}>
                <td className="px-4 py-3 font-semibold text-slate-800">
                  {fullName(r.employeeId)}
                  {r.promotionSuggested && (
                    <span className="ml-2 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Promo</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-700">{r.periodLabel}</p>
                  <p className="text-[11px] capitalize text-slate-400">{r.periodType}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {r.rating}
                  </span>
                </td>
                <td className="max-w-xs truncate px-4 py-3 text-slate-500">{r.managerFeedback || r.achievements || '—'}</td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => remove(r._id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
