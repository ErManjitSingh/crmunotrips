import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, X, Banknote, Trash2, Gift } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

function fullName(e) {
  return [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.employeeCode || '—';
}

function inr(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

const STATUS_TONE = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-violet-50 text-violet-700',
  rejected: 'bg-rose-50 text-rose-700',
};

export default function HrIncentivesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['hr', 'incentives', status],
    queryFn: () => hrApi.incentives({ status: status || undefined }),
  });
  const { data: employeesData } = useQuery({
    queryKey: ['hr', 'employees', 'inc-picker'],
    queryFn: () => hrApi.employees({ limit: 100, status: 'active' }),
  });
  const [form, setForm] = useState({
    employeeId: '',
    type: 'sales',
    title: '',
    amount: '',
    periodLabel: '',
    notes: '',
  });
  const employees = employeesData?.rows || [];
  const totalPending = rows.filter((r) => r.status === 'pending').reduce((s, r) => s + (r.amount || 0), 0);

  const create = async () => {
    if (!form.employeeId || !form.title.trim() || !form.amount) return;
    await hrApi.createIncentive({ ...form, amount: Number(form.amount) });
    setForm({ employeeId: '', type: 'sales', title: '', amount: '', periodLabel: '', notes: '' });
    qc.invalidateQueries({ queryKey: ['hr', 'incentives'] });
  };

  const review = async (id, next) => {
    await hrApi.reviewIncentive(id, { status: next });
    qc.invalidateQueries({ queryKey: ['hr', 'incentives'] });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete incentive?')) return;
    await hrApi.deleteIncentive(id);
    qc.invalidateQueries({ queryKey: ['hr', 'incentives'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Incentives"
        description="Sales incentives, bonuses and commissions"
        breadcrumbs={['HR', 'Incentives']}
        actions={(
          <div className="inline-flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700">
            <Gift className="h-4 w-4" /> Pending {inr(totalPending)}
          </div>
        )}
      />

      <div className="grid gap-3 rounded-2xl border border-subtle bg-white p-4 shadow-sm md:grid-cols-3">
        <select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="">Select employee</option>
          {employees.map((e) => <option key={e._id} value={e._id}>{fullName(e)}</option>)}
        </select>
        <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="sales">Sales Incentive</option>
          <option value="bonus">Bonus</option>
          <option value="commission">Commission</option>
          <option value="referral">Referral</option>
          <option value="other">Other</option>
        </select>
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Amount (₹)" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={form.periodLabel} onChange={(e) => setForm((f) => ({ ...f, periodLabel: e.target.value }))} placeholder="Period (e.g. Jun 2026)" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <Button onClick={create} className="h-10 rounded-xl bg-[#5D5FEF] text-white"><Plus className="mr-1 h-4 w-4" /> Add</Button>
      </div>

      <div className="flex gap-2">
        {['', 'pending', 'approved', 'paid', 'rejected'].map((s) => (
          <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold capitalize', status === s ? 'bg-[#5D5FEF] text-white' : 'border border-slate-200 bg-white text-slate-600')}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Incentive</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No incentives yet</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id} className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{r.title}</p>
                  <p className="text-[11px] capitalize text-slate-400">{r.type}{r.periodLabel ? ` · ${r.periodLabel}` : ''}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{fullName(r.employeeId)}</td>
                <td className="px-4 py-3 font-bold">{inr(r.amount)}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', STATUS_TONE[r.status])}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status === 'pending' && (
                    <div className="inline-flex gap-1">
                      <button type="button" onClick={() => review(r._id, 'approved')} className="rounded-lg bg-emerald-50 p-2 text-emerald-600"><Check className="h-4 w-4" /></button>
                      <button type="button" onClick={() => review(r._id, 'rejected')} className="rounded-lg bg-rose-50 p-2 text-rose-600"><X className="h-4 w-4" /></button>
                      <button type="button" onClick={() => remove(r._id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                  {r.status === 'approved' && (
                    <button type="button" onClick={() => review(r._id, 'paid')} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1.5 text-[11px] font-bold text-violet-700">
                      <Banknote className="h-3.5 w-3.5" /> Mark Paid
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
