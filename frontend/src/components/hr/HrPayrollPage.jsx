import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Wallet, CheckCircle2, Play, Trash2, IndianRupee } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function inr(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

const STATUS_TONE = {
  draft: 'bg-slate-100 text-slate-700',
  processing: 'bg-amber-50 text-amber-700',
  processed: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-violet-50 text-violet-700',
};

export default function HrPayrollPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedId, setSelectedId] = useState(null);
  const [running, setRunning] = useState(false);

  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['hr', 'payroll'],
    queryFn: () => hrApi.payrollRuns(),
  });

  const { data: detail } = useQuery({
    queryKey: ['hr', 'payroll', selectedId],
    queryFn: () => hrApi.payrollRun(selectedId),
    enabled: Boolean(selectedId),
  });

  const kpis = useMemo(() => {
    const latest = runs[0];
    return {
      runs: runs.length,
      pending: runs.filter((r) => r.status === 'draft' || r.status === 'processing').length,
      net: latest?.totals?.net || 0,
      employees: latest?.totals?.employees || 0,
    };
  }, [runs]);

  const runPayroll = async () => {
    setRunning(true);
    try {
      const row = await hrApi.createPayrollRun({ month, year });
      await qc.invalidateQueries({ queryKey: ['hr', 'payroll'] });
      await qc.invalidateQueries({ queryKey: ['hr', 'dashboard'] });
      setSelectedId(row._id);
    } finally {
      setRunning(false);
    }
  };

  const setStatus = async (id, status) => {
    await hrApi.updatePayrollStatus(id, { status });
    qc.invalidateQueries({ queryKey: ['hr', 'payroll'] });
    qc.invalidateQueries({ queryKey: ['hr', 'dashboard'] });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete draft payroll?')) return;
    await hrApi.deletePayrollRun(id);
    if (selectedId === id) setSelectedId(null);
    qc.invalidateQueries({ queryKey: ['hr', 'payroll'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Payroll"
        description="Generate monthly salary runs, review slips, and mark paid"
        breadcrumbs={['HR', 'Payroll']}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Payroll Runs', value: kpis.runs, icon: Wallet },
          { label: 'Pending', value: kpis.pending, icon: Play },
          { label: 'Latest Headcount', value: kpis.employees, icon: CheckCircle2 },
          { label: 'Latest Net Payout', value: inr(kpis.net), icon: IndianRupee },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl border border-subtle bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{k.label}</p>
                <Icon className="h-4 w-4 text-violet-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900">{k.value}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-subtle bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="block flex-1">
          <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Month</span>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <label className="block w-32">
          <span className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Year</span>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" />
        </label>
        <Button onClick={runPayroll} disabled={running} className="h-10 rounded-xl bg-[#5D5FEF] text-white">
          <Plus className="mr-1 h-4 w-4" /> {running ? 'Generating…' : 'Run Payroll'}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm xl:col-span-2">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-800">Runs</div>
          <div className="divide-y divide-slate-50">
            {isLoading ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">Loading…</p>
            ) : runs.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-400">No payroll runs yet</p>
            ) : runs.map((r) => (
              <button
                key={r._id}
                type="button"
                onClick={() => setSelectedId(r._id)}
                className={cn(
                  'flex w-full items-center justify-between px-4 py-3 text-left hover:bg-violet-50/50',
                  selectedId === r._id && 'bg-violet-50'
                )}
              >
                <div>
                  <p className="text-sm font-bold text-slate-800">{MONTHS[r.month - 1]} {r.year}</p>
                  <p className="text-xs text-slate-500">{r.totals?.employees || 0} employees · {inr(r.totals?.net)}</p>
                </div>
                <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', STATUS_TONE[r.status])}>
                  {r.status}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-subtle bg-white shadow-sm xl:col-span-3">
          {!detail ? (
            <p className="px-4 py-16 text-center text-sm text-slate-400">Select a payroll run to view payslips</p>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{MONTHS[detail.month - 1]} {detail.year} Payslips</p>
                  <p className="text-xs text-slate-500">Gross {inr(detail.totals?.gross)} · Deductions {inr(detail.totals?.deductions)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {detail.status === 'draft' && (
                    <Button size="sm" onClick={() => setStatus(detail._id, 'processed')} className="rounded-lg bg-emerald-600 text-white">Mark Processed</Button>
                  )}
                  {detail.status === 'processed' && (
                    <Button size="sm" onClick={() => setStatus(detail._id, 'paid')} className="rounded-lg bg-[#5D5FEF] text-white">Mark Paid</Button>
                  )}
                  {(detail.status === 'draft' || detail.status === 'processing') && (
                    <button type="button" onClick={() => remove(detail._id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                  )}
                </div>
              </div>
              <div className="max-h-[480px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Gross</th>
                      <th className="px-4 py-3">Deductions</th>
                      <th className="px-4 py-3">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.slips || []).map((s, i) => (
                      <motion.tr
                        key={`${s.employeeId}-${i}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}
                      >
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{s.name}</p>
                          <p className="text-[11px] text-slate-400">{s.employeeCode} · {s.designation || '—'}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold">{inr(s.gross)}</td>
                        <td className="px-4 py-3 text-rose-600">{inr(s.deductions)}</td>
                        <td className="px-4 py-3 font-bold text-emerald-700">{inr(s.net)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
