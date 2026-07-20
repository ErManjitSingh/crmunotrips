import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Search, Mail, Phone, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import AppDrawer from '../ui/AppDrawer';
import { Button } from '../ui/button';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  departmentId: '',
  designationId: '',
  employmentType: 'full_time',
  status: 'active',
  joiningDate: '',
  salary: '',
  shift: 'General',
};

function fullName(e) {
  return [e?.firstName, e?.lastName].filter(Boolean).join(' ') || '—';
}

export default function HrEmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const params = useMemo(
    () => ({ search: search || undefined, status: status || undefined, departmentId: departmentId || undefined, limit: 48 }),
    [search, status, departmentId]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'employees', params],
    queryFn: () => hrApi.employees(params),
  });
  const { data: departments = [] } = useQuery({ queryKey: ['hr', 'departments'], queryFn: hrApi.departments });
  const { data: designations = [] } = useQuery({ queryKey: ['hr', 'designations'], queryFn: () => hrApi.designations() });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDrawerOpen(true);
  };

  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      departmentId: emp.departmentId?._id || emp.departmentId || '',
      designationId: emp.designationId?._id || emp.designationId || '',
      employmentType: emp.employmentType || 'full_time',
      status: emp.status || 'active',
      joiningDate: emp.joiningDate ? String(emp.joiningDate).slice(0, 10) : '',
      salary: emp.salary ?? '',
      shift: emp.shift || 'General',
    });
    setDrawerOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        salary: Number(form.salary) || 0,
        departmentId: form.departmentId || null,
        designationId: form.designationId || null,
        joiningDate: form.joiningDate || null,
      };
      if (editing?._id) await hrApi.updateEmployee(editing._id, payload);
      else await hrApi.createEmployee(payload);
      setDrawerOpen(false);
      qc.invalidateQueries({ queryKey: ['hr', 'employees'] });
      qc.invalidateQueries({ queryKey: ['hr', 'dashboard'] });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Archive this employee?')) return;
    await hrApi.deleteEmployee(id);
    qc.invalidateQueries({ queryKey: ['hr', 'employees'] });
    qc.invalidateQueries({ queryKey: ['hr', 'dashboard'] });
  };

  const rows = data?.rows || [];

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Employees"
        description="Premium employee directory — search, filter, and manage workforce"
        breadcrumbs={['HR', 'Employees']}
        actions={(
          <Button onClick={openCreate} className="h-10 rounded-xl bg-[#5D5FEF] hover:bg-[#4F51E0] text-white shadow-md shadow-violet-500/25">
            <Plus className="h-4 w-4 mr-1.5" /> Add Employee
          </Button>
        )}
      />

      <div className="flex flex-col gap-2.5 rounded-2xl border border-subtle bg-white p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, EMP code…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="on_notice">On Notice</option>
          <option value="on_leave">On Leave</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d._id} value={d._id}>{d.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-subtle bg-white" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-700">No employees yet</p>
          <p className="mt-1 text-sm text-slate-400">Add your first team member to start HR records.</p>
          <Button onClick={openCreate} className="mt-4 rounded-xl bg-[#5D5FEF] text-white">Add Employee</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((emp, i) => (
            <motion.div
              key={emp._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="group rounded-2xl border border-subtle bg-white p-4 shadow-sm transition hover:border-violet-200 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5D5FEF] to-violet-600 text-sm font-bold text-white shadow-md shadow-violet-500/20">
                  {(emp.firstName || '?')[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/hr/employees/${emp._id}`} className="block truncate text-sm font-bold text-slate-900 hover:text-[#5D5FEF]">
                        {fullName(emp)}
                      </Link>
                      <p className="text-[11px] font-semibold text-violet-600">{emp.employeeCode}</p>
                    </div>
                    <DropdownMenuRoot>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem asChild>
                          <Link to={`/hr/employees/${emp._id}`} className="gap-2"><Eye className="h-3.5 w-3.5" /> View</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(emp)} className="gap-2"><Pencil className="h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => remove(emp._id)} className="gap-2 text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Archive</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenuRoot>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {emp.designationId?.name || '—'} · {emp.departmentId?.name || '—'}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                {emp.email && (
                  <p className="flex items-center gap-1.5 truncate"><Mail className="h-3.5 w-3.5 shrink-0" />{emp.email}</p>
                )}
                {emp.phone && (
                  <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0" />{emp.phone}</p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className={cn(
                  'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
                  emp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                )}>
                  {emp.status?.replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 capitalize">{emp.employmentType?.replace(/_/g, ' ')}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AppDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-lg font-bold text-slate-900">{editing ? 'Edit Employee' : 'Add Employee'}</h3>
            <p className="text-xs text-slate-500">Workforce profile details</p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {[
            ['firstName', 'First Name', 'text'],
            ['lastName', 'Last Name', 'text'],
            ['email', 'Email', 'email'],
            ['phone', 'Phone', 'tel'],
            ['joiningDate', 'Joining Date', 'date'],
            ['salary', 'Salary (₹)', 'number'],
            ['shift', 'Shift', 'text'],
          ].map(([key, label, type]) => (
            <label key={key} className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
              />
            </label>
          ))}
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Department</span>
            <select value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">
              <option value="">Select</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Designation</span>
            <select value={form.designationId} onChange={(e) => setForm((f) => ({ ...f, designationId: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">
              <option value="">Select</option>
              {designations.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Employment Type</span>
            <select value={form.employmentType} onChange={(e) => setForm((f) => ({ ...f, employmentType: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm">
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="intern">Intern</option>
              <option value="consultant">Consultant</option>
            </select>
          </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <Button variant="outline" onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button disabled={saving || !form.firstName.trim()} onClick={save} className="bg-[#5D5FEF] text-white hover:bg-[#4F51E0]">
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </AppDrawer>
    </div>
  );
}
