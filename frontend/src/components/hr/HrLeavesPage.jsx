import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, Plus } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';

function fullName(e) {
  return [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.employeeCode || '—';
}

export default function HrLeavesPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'leaves', status],
    queryFn: () => hrApi.leaves({ status: status || undefined, limit: 50 }),
  });
  const { data: employeesData } = useQuery({
    queryKey: ['hr', 'employees', 'leave-picker'],
    queryFn: () => hrApi.employees({ limit: 100, status: 'active' }),
  });
  const [form, setForm] = useState({ employeeId: '', leaveType: 'casual', fromDate: '', toDate: '', reason: '' });

  const rows = data?.rows || [];
  const employees = employeesData?.rows || [];

  const create = async () => {
    if (!form.employeeId || !form.fromDate || !form.toDate) return;
    await hrApi.createLeave(form);
    setForm({ employeeId: '', leaveType: 'casual', fromDate: '', toDate: '', reason: '' });
    qc.invalidateQueries({ queryKey: ['hr', 'leaves'] });
    qc.invalidateQueries({ queryKey: ['hr', 'dashboard'] });
  };

  const review = async (id, next) => {
    await hrApi.reviewLeave(id, { status: next });
    qc.invalidateQueries({ queryKey: ['hr', 'leaves'] });
    qc.invalidateQueries({ queryKey: ['hr', 'dashboard'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="Leave Management" description="Apply, approve, and track leave requests" breadcrumbs={['HR', 'Leaves']} />

      <div className="grid gap-3 rounded-2xl border border-subtle bg-white p-4 shadow-sm md:grid-cols-5">
        <select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2">
          <option value="">Select employee</option>
          {employees.map((e) => <option key={e._id} value={e._id}>{fullName(e)}</option>)}
        </select>
        <select value={form.leaveType} onChange={(e) => setForm((f) => ({ ...f, leaveType: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="casual">Casual</option>
          <option value="sick">Sick</option>
          <option value="earned">Earned</option>
          <option value="comp_off">Comp Off</option>
          <option value="unpaid">Unpaid</option>
          <option value="maternity">Maternity</option>
          <option value="paternity">Paternity</option>
        </select>
        <input type="date" value={form.fromDate} onChange={(e) => setForm((f) => ({ ...f, fromDate: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input type="date" value={form.toDate} onChange={(e) => setForm((f) => ({ ...f, toDate: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Reason" className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-4" />
        <Button onClick={create} className="h-10 rounded-xl bg-[#5D5FEF] text-white"><Plus className="h-4 w-4 mr-1" /> Apply</Button>
      </div>

      <div className="flex gap-2">
        {['', 'pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${status === s ? 'bg-[#5D5FEF] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
          >
            {s ? s : 'All'}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Days</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No leave requests</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id} className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}>
                <td className="px-4 py-3 font-semibold text-slate-800">{fullName(r.employeeId)}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{r.leaveType?.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(r.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {' – '}
                  {new Date(r.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </td>
                <td className="px-4 py-3 font-semibold">{r.days}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                    r.status === 'approved' ? 'bg-emerald-50 text-emerald-700'
                      : r.status === 'rejected' ? 'bg-rose-50 text-rose-700'
                        : 'bg-amber-50 text-amber-700'
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status === 'pending' && (
                    <div className="inline-flex gap-1">
                      <button type="button" onClick={() => review(r._id, 'approved')} className="rounded-lg bg-emerald-50 p-2 text-emerald-600 hover:bg-emerald-100"><Check className="h-4 w-4" /></button>
                      <button type="button" onClick={() => review(r._id, 'rejected')} className="rounded-lg bg-rose-50 p-2 text-rose-600 hover:bg-rose-100"><X className="h-4 w-4" /></button>
                    </div>
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
