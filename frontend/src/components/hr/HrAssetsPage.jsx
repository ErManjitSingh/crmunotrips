import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Laptop, UserPlus, RotateCcw } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

const CATEGORIES = [
  ['laptop', 'Laptop'],
  ['mobile', 'Mobile'],
  ['sim', 'SIM'],
  ['id_card', 'ID Card'],
  ['camera', 'Camera'],
  ['tablet', 'Tablet'],
  ['vehicle', 'Vehicle'],
  ['other', 'Other'],
];

function fullName(e) {
  return [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.employeeCode || '—';
}

const STATUS_TONE = {
  available: 'bg-emerald-50 text-emerald-700',
  assigned: 'bg-violet-50 text-violet-700',
  returned: 'bg-slate-100 text-slate-600',
  lost: 'bg-rose-50 text-rose-700',
  retired: 'bg-amber-50 text-amber-700',
};

export default function HrAssetsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['hr', 'assets', status, category],
    queryFn: () => hrApi.assets({ status: status || undefined, category: category || undefined }),
  });
  const { data: employeesData } = useQuery({
    queryKey: ['hr', 'employees', 'asset-picker'],
    queryFn: () => hrApi.employees({ limit: 100, status: 'active' }),
  });
  const [form, setForm] = useState({ name: '', category: 'laptop', serialNumber: '', brand: '' });
  const [assign, setAssign] = useState({ assetId: '', employeeId: '' });
  const employees = employeesData?.rows || [];

  const create = async () => {
    if (!form.name.trim()) return;
    await hrApi.createAsset(form);
    setForm({ name: '', category: 'laptop', serialNumber: '', brand: '' });
    qc.invalidateQueries({ queryKey: ['hr', 'assets'] });
  };

  const doAssign = async () => {
    if (!assign.assetId || !assign.employeeId) return;
    await hrApi.assignAsset(assign.assetId, { employeeId: assign.employeeId });
    setAssign({ assetId: '', employeeId: '' });
    qc.invalidateQueries({ queryKey: ['hr', 'assets'] });
  };

  const doReturn = async (id, lost = false) => {
    await hrApi.returnAsset(id, { lost });
    qc.invalidateQueries({ queryKey: ['hr', 'assets'] });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete asset?')) return;
    await hrApi.deleteAsset(id);
    qc.invalidateQueries({ queryKey: ['hr', 'assets'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Assets"
        description="Track laptops, phones, SIMs and company equipment"
        breadcrumbs={['HR', 'Assets']}
      />

      <div className="grid gap-3 rounded-2xl border border-subtle bg-white p-4 shadow-sm md:grid-cols-4">
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Asset name" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} placeholder="Serial no." className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <Button onClick={create} className="h-10 rounded-xl bg-[#5D5FEF] text-white"><Plus className="mr-1 h-4 w-4" /> Add Asset</Button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-violet-100 bg-violet-50/40 p-4 md:grid-cols-3">
        <select value={assign.assetId} onChange={(e) => setAssign((a) => ({ ...a, assetId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">Select available asset</option>
          {rows.filter((r) => r.status === 'available').map((r) => (
            <option key={r._id} value={r._id}>{r.assetCode} — {r.name}</option>
          ))}
        </select>
        <select value={assign.employeeId} onChange={(e) => setAssign((a) => ({ ...a, employeeId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">Assign to employee</option>
          {employees.map((e) => <option key={e._id} value={e._id}>{fullName(e)}</option>)}
        </select>
        <Button onClick={doAssign} variant="outline" className="h-10 rounded-xl border-violet-200 bg-white text-violet-700">
          <UserPlus className="mr-1 h-4 w-4" /> Assign
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {['', 'available', 'assigned', 'lost'].map((s) => (
          <button key={s || 'all'} type="button" onClick={() => setStatus(s)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', status === s ? 'bg-[#5D5FEF] text-white' : 'border border-slate-200 bg-white text-slate-600')}>
            {s || 'All'}
          </button>
        ))}
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 rounded-lg border border-slate-200 px-2 text-xs">
          <option value="">All categories</option>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Assigned To</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No assets yet</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id} className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-violet-500" />
                    <div>
                      <p className="font-semibold text-slate-800">{r.name}</p>
                      <p className="text-[11px] text-slate-400">{r.assetCode}{r.serialNumber ? ` · ${r.serialNumber}` : ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 capitalize text-slate-600">{r.category?.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-slate-600">{r.assignedTo ? fullName(r.assignedTo) : '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase', STATUS_TONE[r.status])}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    {r.status === 'assigned' && (
                      <>
                        <button type="button" title="Return" onClick={() => doReturn(r._id, false)} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><RotateCcw className="h-4 w-4" /></button>
                        <button type="button" title="Mark lost" onClick={() => doReturn(r._id, true)} className="rounded-lg px-2 text-[10px] font-bold uppercase text-rose-600 hover:bg-rose-50">Lost</button>
                      </>
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
