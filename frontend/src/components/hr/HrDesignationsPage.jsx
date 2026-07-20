import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';

export default function HrDesignationsPage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['hr', 'designations'], queryFn: () => hrApi.designations() });
  const { data: departments = [] } = useQuery({ queryKey: ['hr', 'departments'], queryFn: hrApi.departments });
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    await hrApi.createDesignation({ name, departmentId: departmentId || null });
    setName('');
    qc.invalidateQueries({ queryKey: ['hr', 'designations'] });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete designation?')) return;
    await hrApi.deleteDesignation(id);
    qc.invalidateQueries({ queryKey: ['hr', 'designations'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="Designations" description="Job titles and levels across departments" breadcrumbs={['HR', 'Designations']} />
      <div className="flex flex-col gap-2 rounded-2xl border border-subtle bg-white p-4 shadow-sm sm:flex-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Designation name" className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm" />
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="">Any department</option>
          {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <Button onClick={add} className="h-10 rounded-xl bg-[#5D5FEF] text-white"><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No designations yet</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id} className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}>
                <td className="px-4 py-3 font-semibold text-slate-800">{r.name}</td>
                <td className="px-4 py-3 text-slate-500">{r.departmentId?.name || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{r.level}</td>
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
