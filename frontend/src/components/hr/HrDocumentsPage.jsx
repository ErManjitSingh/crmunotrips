import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, FileText, AlertTriangle } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

const DOC_TYPES = [
  ['aadhar', 'Aadhar'],
  ['pan', 'PAN'],
  ['passport', 'Passport'],
  ['offer_letter', 'Offer Letter'],
  ['joining_letter', 'Joining Letter'],
  ['experience_letter', 'Experience Letter'],
  ['salary_slip', 'Salary Slip'],
  ['certificate', 'Certificate'],
  ['driving_license', 'Driving License'],
  ['education', 'Education'],
  ['police_verification', 'Police Verification'],
  ['medical', 'Medical'],
  ['nda', 'NDA'],
  ['bank_details', 'Bank Details'],
  ['other', 'Other'],
];

function fullName(e) {
  return [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.employeeCode || '—';
}

function isExpiringSoon(date) {
  if (!date) return false;
  const d = new Date(date);
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86400000);
  return d >= now && d <= in30;
}

export default function HrDocumentsPage() {
  const qc = useQueryClient();
  const [docType, setDocType] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'documents', docType],
    queryFn: () => hrApi.documents({ docType: docType || undefined, limit: 60 }),
  });
  const { data: employeesData } = useQuery({
    queryKey: ['hr', 'employees', 'doc-picker'],
    queryFn: () => hrApi.employees({ limit: 100, status: 'active' }),
  });
  const [form, setForm] = useState({
    employeeId: '',
    docType: 'aadhar',
    title: '',
    fileUrl: '',
    expiryDate: '',
    notes: '',
  });

  const rows = data?.rows || [];
  const employees = employeesData?.rows || [];

  const create = async () => {
    if (!form.employeeId || !form.title.trim()) return;
    await hrApi.createDocument(form);
    setForm({ employeeId: '', docType: 'aadhar', title: '', fileUrl: '', expiryDate: '', notes: '' });
    qc.invalidateQueries({ queryKey: ['hr', 'documents'] });
  };

  const remove = async (id) => {
    if (!window.confirm('Delete document?')) return;
    await hrApi.deleteDocument(id);
    qc.invalidateQueries({ queryKey: ['hr', 'documents'] });
  };

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Documents"
        description="Employee KYC, letters, certificates — with expiry reminders"
        breadcrumbs={['HR', 'Documents']}
      />

      <div className="grid gap-3 rounded-2xl border border-subtle bg-white p-4 shadow-sm md:grid-cols-3">
        <select value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          <option value="">Select employee</option>
          {employees.map((e) => <option key={e._id} value={e._id}>{fullName(e)}</option>)}
        </select>
        <select value={form.docType} onChange={(e) => setForm((f) => ({ ...f, docType: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
          {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Document title" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <input value={form.fileUrl} onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))} placeholder="File URL / drive link" className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-2" />
        <input type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
        <Button onClick={create} className="h-10 rounded-xl bg-[#5D5FEF] text-white md:col-span-3"><Plus className="mr-1 h-4 w-4" /> Add Document</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setDocType('')} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', !docType ? 'bg-[#5D5FEF] text-white' : 'border border-slate-200 bg-white text-slate-600')}>All</button>
        {DOC_TYPES.slice(0, 8).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setDocType(v)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold', docType === v ? 'bg-[#5D5FEF] text-white' : 'border border-slate-200 bg-white text-slate-600')}>{l}</button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Expiry</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No documents yet</td></tr>
            ) : rows.map((r, i) => (
              <tr key={r._id} className={i % 2 === 0 ? 'bg-sky-50' : 'bg-white'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-violet-500" />
                    <div>
                      <p className="font-semibold text-slate-800">{r.title}</p>
                      {r.fileUrl ? (
                        <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#5D5FEF] hover:underline">Open file</a>
                      ) : (
                        <p className="text-[11px] text-slate-400">No file link</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{fullName(r.employeeId)}</td>
                <td className="px-4 py-3 capitalize text-slate-500">{r.docType?.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3">
                  {r.expiryDate ? (
                    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', isExpiringSoon(r.expiryDate) ? 'text-amber-600' : 'text-slate-600')}>
                      {isExpiringSoon(r.expiryDate) && <AlertTriangle className="h-3.5 w-3.5" />}
                      {new Date(r.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  ) : '—'}
                </td>
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
