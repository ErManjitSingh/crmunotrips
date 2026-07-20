import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';

export default function HrDepartmentsPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['hr', 'departments'],
    queryFn: hrApi.departments,
  });
  const rows = Array.isArray(data) ? data : [];
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await hrApi.createDepartment({ name: name.trim(), code: code.trim() });
      setName('');
      setCode('');
      await qc.invalidateQueries({ queryKey: ['hr', 'departments'] });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete department?')) return;
    await hrApi.deleteDepartment(id);
    qc.invalidateQueries({ queryKey: ['hr', 'departments'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="Departments" description="Organize teams and reporting structure" breadcrumbs={['HR', 'Departments']} />
      <div className="flex flex-col gap-2 rounded-2xl border border-subtle bg-white p-4 shadow-sm sm:flex-row">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Department name"
          className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Code"
          className="h-10 w-32 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <Button type="button" onClick={add} disabled={saving || !name.trim()} className="h-10 rounded-xl bg-[#5D5FEF] text-white">
          <Plus className="h-4 w-4 mr-1" /> {saving ? 'Saving…' : 'Add'}
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : isError ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center">
                  <p className="text-rose-600 text-sm mb-2">{error?.response?.data?.message || 'Failed to load departments'}</p>
                  <button type="button" onClick={() => refetch()} className="text-sm font-semibold text-[#5D5FEF] hover:underline">Retry</button>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No departments yet</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id} className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}>
                <td className="px-4 py-3 font-semibold text-slate-800">{r.name}</td>
                <td className="px-4 py-3 text-slate-500">{r.code || '—'}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{r.status}</td>
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
