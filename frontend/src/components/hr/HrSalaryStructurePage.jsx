import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Star } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

const DEFAULT_COMPONENTS = [
  { key: 'basic', label: 'Basic', type: 'earning', calcType: 'percent', amount: 50, percentOf: 'ctc' },
  { key: 'hra', label: 'HRA', type: 'earning', calcType: 'percent', amount: 40, percentOf: 'basic' },
  { key: 'special', label: 'Special Allowance', type: 'earning', calcType: 'percent', amount: 10, percentOf: 'ctc' },
  { key: 'pf', label: 'PF', type: 'deduction', calcType: 'percent', amount: 12, percentOf: 'basic' },
];

export default function HrSalaryStructurePage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['hr', 'salary-structures'],
    queryFn: hrApi.salaryStructures,
  });
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    await hrApi.createSalaryStructure({
      name,
      code,
      isDefault,
      components: DEFAULT_COMPONENTS,
    });
    setName('');
    setCode('');
    setIsDefault(false);
    qc.invalidateQueries({ queryKey: ['hr', 'salary-structures'] });
  };

  const makeDefault = async (id) => {
    await hrApi.updateSalaryStructure(id, { isDefault: true });
    qc.invalidateQueries({ queryKey: ['hr', 'salary-structures'] });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete salary structure?')) return;
    await hrApi.deleteSalaryStructure(id);
    qc.invalidateQueries({ queryKey: ['hr', 'salary-structures'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Salary Structure"
        description="Component templates for Basic, HRA, allowances, PF and deductions"
        breadcrumbs={['HR', 'Salary Structure']}
      />

      <div className="flex flex-col gap-2 rounded-2xl border border-subtle bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Structure name (e.g. Standard CTC)" className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" className="h-10 w-28 rounded-xl border border-slate-200 px-3 text-sm" />
        <label className="inline-flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded border-slate-300" />
          Default
        </label>
        <Button onClick={add} className="h-10 rounded-xl bg-[#5D5FEF] text-white"><Plus className="mr-1 h-4 w-4" /> Create</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400 md:col-span-2">
            No structures yet — create one to power payroll calculations
          </div>
        ) : rows.map((r) => (
          <div key={r._id} className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">{r.name}</h3>
                  {r.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">
                      <Star className="h-3 w-3" /> Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{r.code || 'No code'} · {r.components?.length || 0} components</p>
              </div>
              <div className="flex gap-1">
                {!r.isDefault && (
                  <button type="button" onClick={() => makeDefault(r._id)} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-violet-600 hover:bg-violet-50">
                    Set default
                  </button>
                )}
                <button type="button" onClick={() => remove(r._id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <ul className="space-y-2">
              {(r.components || []).map((c) => (
                <li key={c.key} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-700">{c.label}</span>
                  <span className={cn('text-xs font-bold uppercase', c.type === 'earning' ? 'text-emerald-600' : 'text-rose-600')}>
                    {c.calcType === 'percent' ? `${c.amount}% of ${c.percentOf}` : `₹${c.amount}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
