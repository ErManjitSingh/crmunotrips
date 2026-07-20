import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';

export default function HrHolidaysPage() {
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['hr', 'holidays', year],
    queryFn: () => hrApi.holidays({ year }),
  });
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('company');

  const add = async () => {
    if (!name.trim() || !date) return;
    await hrApi.createHoliday({ name, date, type });
    setName('');
    setDate('');
    qc.invalidateQueries({ queryKey: ['hr', 'holidays'] });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete holiday?')) return;
    await hrApi.deleteHoliday(id);
    qc.invalidateQueries({ queryKey: ['hr', 'holidays'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader title="Holidays" description={`${year} holiday calendar — national, festival & company`} breadcrumbs={['HR', 'Holidays']} />
      <div className="flex flex-col gap-2 rounded-2xl border border-subtle bg-white p-4 shadow-sm sm:flex-row">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Holiday name" className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="national">National</option>
          <option value="festival">Festival</option>
          <option value="company">Company</option>
          <option value="state">State</option>
          <option value="custom">Custom</option>
        </select>
        <Button onClick={add} className="h-10 rounded-xl bg-[#5D5FEF] text-white"><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-slate-400">No holidays for {year}</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id} className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}>
                <td className="px-4 py-3 font-semibold text-slate-800">
                  {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td className="px-4 py-3 text-slate-700">{r.name}</td>
                <td className="px-4 py-3 capitalize text-slate-500">{r.type}</td>
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
