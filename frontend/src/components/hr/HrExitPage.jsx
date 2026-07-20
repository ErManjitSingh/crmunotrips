import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, LogOut, Check } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

function fullName(e) {
  return [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.employeeCode || '—';
}

const STATUS_TONE = {
  initiated: 'bg-slate-100 text-slate-700',
  notice_period: 'bg-amber-50 text-amber-700',
  clearance: 'bg-sky-50 text-sky-700',
  settlement: 'bg-violet-50 text-violet-700',
  completed: 'bg-emerald-50 text-emerald-700',
  withdrawn: 'bg-rose-50 text-rose-700',
};

const NEXT = {
  notice_period: 'clearance',
  clearance: 'settlement',
  settlement: 'completed',
};

export default function HrExitPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['hr', 'exits', status],
    queryFn: () => hrApi.exits({ status: status || undefined }),
  });
  const { data: employeesData } = useQuery({
    queryKey: ['hr', 'employees', 'exit-picker'],
    queryFn: () => hrApi.employees({ limit: 100, status: 'active' }),
  });
  const [form, setForm] = useState({
    employeeId: '',
    resignationDate: '',
    lastWorkingDate: '',
    noticePeriodDays: 30,
    reason: '',
  });
  const employees = employeesData?.rows || [];

  const create = async () => {
    if (!form.employeeId || !form.resignationDate) return;
    await hrApi.createExit(form);
    setForm({ employeeId: '', resignationDate: '', lastWorkingDate: '', noticePeriodDays: 30, reason: '' });
    qc.invalidateQueries({ queryKey: ['hr', 'exits'] });
    qc.invalidateQueries({ queryKey: ['hr', 'employees'] });
  };

  const advance = async (row) => {
    const next = NEXT[row.status];
    if (!next) return;
    const patch = { status: next };
    if (next === 'clearance') patch.assetReturned = true;
    if (next === 'settlement') patch.clearanceDone = true;
    if (next === 'completed') patch.settlementDone = true;
    await hrApi.updateExit(row._id, patch);
    qc.invalidateQueries({ queryKey: ['hr', 'exits'] });
    qc.invalidateQueries({ queryKey: ['hr', 'employees'] });
  };

  const withdraw = async (id) => {
    if (!window.confirm('Withdraw resignation?')) return;
    await hrApi.updateExit(id, { status: 'withdrawn' });
    qc.invalidateQueries({ queryKey: ['hr', 'exits'] });
    qc.invalidateQueries({ queryKey: ['hr', 'employees'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Exit Management"
        description="Resignation, notice period, clearance and final settlement"
        breadcrumbs={['HR', 'Exit']}
      />

      <div className="grid gap-3 rounded-2xl border border-subtle bg-white p-4 shadow-sm md:grid-cols-3">
        <select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2">
          <option value="">Select employee</option>
          {employees.map((e) => <option key={e._id} value={e._id}>{fullName(e)}</option>)}
        </select>
        <input type="number" value={form.noticePeriodDays} onChange={(e) => setForm((f) => ({ ...f, noticePeriodDays: Number(e.target.value) }))} placeholder="Notice days" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input type="date" value={form.resignationDate} onChange={(e) => setForm((f) => ({ ...f, resignationDate: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input type="date" value={form.lastWorkingDate} onChange={(e) => setForm((f) => ({ ...f, lastWorkingDate: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Reason" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <Button onClick={create} className="h-10 rounded-xl bg-[#5D5FEF] text-white md:col-span-3"><Plus className="mr-1 h-4 w-4" /> Initiate Exit</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'notice_period', 'clearance', 'settlement', 'completed', 'withdrawn'].map((s) => (
          <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold capitalize', status === s ? 'bg-[#5D5FEF] text-white' : 'border border-slate-200 bg-white text-slate-600')}>
            {s?.replace(/_/g, ' ') || 'All'}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Checklist</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No exit cases</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id} className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <LogOut className="h-4 w-4 text-violet-500" />
                    <div>
                      <p className="font-semibold text-slate-800">{fullName(r.employeeId)}</p>
                      <p className="text-[11px] text-slate-400">{r.reason || 'No reason'} · {r.noticePeriodDays}d notice</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <p>Resigned {new Date(r.resignationDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  {r.lastWorkingDate && (
                    <p className="text-[11px] text-slate-400">LWD {new Date(r.lastWorkingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {[['Assets', r.assetReturned], ['Clearance', r.clearanceDone], ['Settlement', r.settlementDone]].map(([l, ok]) => (
                      <span key={l} className={cn('rounded-md px-1.5 py-0.5 text-[10px] font-bold', ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                        {ok ? '✓ ' : ''}{l}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', STATUS_TONE[r.status])}>{r.status?.replace(/_/g, ' ')}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    {NEXT[r.status] && (
                      <button type="button" onClick={() => advance(r)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-700">
                        <Check className="h-3.5 w-3.5" /> {NEXT[r.status].replace(/_/g, ' ')}
                      </button>
                    )}
                    {r.status !== 'completed' && r.status !== 'withdrawn' && (
                      <button type="button" onClick={() => withdraw(r._id)} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50">Withdraw</button>
                    )}
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
