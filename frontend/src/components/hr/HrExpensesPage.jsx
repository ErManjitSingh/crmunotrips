import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Check, X, Banknote } from 'lucide-react';
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
  rejected: 'bg-rose-50 text-rose-700',
  reimbursed: 'bg-violet-50 text-violet-700',
};

export default function HrExpensesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'expenses', status],
    queryFn: () => hrApi.expenses({ status: status || undefined, limit: 50 }),
  });
  const { data: employeesData } = useQuery({
    queryKey: ['hr', 'employees', 'expense-picker'],
    queryFn: () => hrApi.employees({ limit: 100, status: 'active' }),
  });
  const [form, setForm] = useState({
    employeeId: '',
    category: 'travel',
    title: '',
    amount: '',
    expenseDate: '',
    description: '',
    receiptUrl: '',
  });

  const rows = data?.rows || [];
  const employees = employeesData?.rows || [];

  const create = async () => {
    if (!form.employeeId || !form.title.trim() || !form.amount || !form.expenseDate) return;
    await hrApi.createExpense({ ...form, amount: Number(form.amount) });
    setForm({ employeeId: '', category: 'travel', title: '', amount: '', expenseDate: '', description: '', receiptUrl: '' });
    qc.invalidateQueries({ queryKey: ['hr', 'expenses'] });
  };

  const review = async (id, next) => {
    await hrApi.reviewExpense(id, { status: next });
    qc.invalidateQueries({ queryKey: ['hr', 'expenses'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Expenses"
        description="Travel, hotel, fuel claims with approval and reimbursement"
        breadcrumbs={['HR', 'Expenses']}
      />

      <div className="grid gap-3 rounded-2xl border border-subtle bg-white p-4 shadow-sm md:grid-cols-3">
        <select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="">Select employee</option>
          {employees.map((e) => <option key={e._id} value={e._id}>{fullName(e)}</option>)}
        </select>
        <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="travel">Travel</option>
          <option value="hotel">Hotel</option>
          <option value="food">Food</option>
          <option value="fuel">Fuel</option>
          <option value="office">Office</option>
          <option value="other">Other</option>
        </select>
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Claim title" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Amount (₹)" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input type="date" value={form.expenseDate} onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={form.receiptUrl} onChange={(e) => setForm((f) => ({ ...f, receiptUrl: e.target.value }))} placeholder="Receipt URL" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <Button onClick={create} className="h-10 rounded-xl bg-[#5D5FEF] text-white md:col-span-3"><Plus className="mr-1 h-4 w-4" /> Submit Claim</Button>
      </div>

      <div className="flex gap-2">
        {['', 'pending', 'approved', 'rejected', 'reimbursed'].map((s) => (
          <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold capitalize', status === s ? 'bg-[#5D5FEF] text-white' : 'border border-slate-200 bg-white text-slate-600')}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Claim</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No expense claims</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id} className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{r.title}</p>
                  <p className="text-[11px] capitalize text-slate-400">{r.category}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">{fullName(r.employeeId)}</td>
                <td className="px-4 py-3 font-bold text-slate-800">{inr(r.amount)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(r.expenseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', STATUS_TONE[r.status])}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status === 'pending' && (
                    <div className="inline-flex gap-1">
                      <button type="button" onClick={() => review(r._id, 'approved')} className="rounded-lg bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100"><Check className="h-4 w-4" /></button>
                      <button type="button" onClick={() => review(r._id, 'rejected')} className="rounded-lg bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"><X className="h-4 w-4" /></button>
                    </div>
                  )}
                  {r.status === 'approved' && (
                    <button type="button" onClick={() => review(r._id, 'reimbursed')} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1.5 text-[11px] font-bold text-violet-700 hover:bg-violet-100">
                      <Banknote className="h-3.5 w-3.5" /> Reimburse
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
