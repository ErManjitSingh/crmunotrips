import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Mail,
  Phone,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Filter,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Users,
  UserCheck,
  UserX,
  CalendarOff,
  Clock3,
  Upload,
} from 'lucide-react';
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

function initials(e) {
  return [e?.firstName?.[0], e?.lastName?.[0]].filter(Boolean).join('').toUpperCase() || 'HR';
}

function statusLabel(status) {
  return String(status || '').replace(/_/g, ' ');
}

function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 10000) / 100;
}

function KpiCard({ label, value, sub, icon: Icon, tone = 'violet', progress }) {
  const tones = {
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    sky: 'bg-sky-50 text-sky-600 border-sky-100',
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-[29px] font-bold leading-none tracking-tight text-slate-900">{value}</p>
          <p className="mt-2 text-[11px] text-slate-400">{sub}</p>
          {progress != null ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-[#5D5FEF]" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function HrEmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const params = useMemo(
    () => ({
      search: search || undefined,
      status: status || undefined,
      departmentId: departmentId || undefined,
      designationId: designationId || undefined,
      page,
      limit: 12,
    }),
    [search, status, departmentId, designationId, page]
  );

  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'employees', params],
    queryFn: () => hrApi.employees(params),
  });
  const { data: dashboard } = useQuery({
    queryKey: ['hr', 'dashboard'],
    queryFn: hrApi.dashboard,
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
      setPage(1);
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
  const total = data?.total || 0;
  const totalPages = data?.pages || 1;
  const currentPage = data?.page || page;
  const startRow = total ? ((currentPage - 1) * (data?.limit || 12)) + 1 : 0;
  const endRow = total ? Math.min(total, startRow + rows.length - 1) : 0;
  const kpis = dashboard?.kpis || {};
  const activeTotal = kpis.activeEmployees || Math.max(total, 1);

  const avatarTones = [
    'from-violet-100 to-fuchsia-100 text-violet-700',
    'from-amber-100 to-orange-100 text-amber-700',
    'from-emerald-100 to-teal-100 text-emerald-700',
    'from-sky-100 to-indigo-100 text-sky-700',
    'from-pink-100 to-rose-100 text-pink-700',
  ];

  return (
    <div className="animate-fade-up space-y-4">
      <div className="flex flex-col gap-4 rounded-[26px] border border-slate-100 bg-white/65 p-4 shadow-sm backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-400">
              <span>HR</span>
              <span>/</span>
              <span>Employees</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-[34px] font-bold leading-none tracking-tight text-slate-900">Employees</h1>
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-[#5D5FEF]">
                {total} Total
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">Manage your organization&apos;s most valuable asset</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={openCreate} className="h-11 rounded-xl bg-[#5D5FEF] px-4 text-white shadow-md shadow-violet-500/25 hover:bg-[#4F51E0]">
              <Plus className="mr-1.5 h-4 w-4" /> Add Employee
            </Button>
            <Button variant="outline" className="h-11 rounded-xl border-slate-200 bg-white px-4 text-slate-600">
              <Upload className="mr-1.5 h-4 w-4" /> Import Employees
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <KpiCard
            label="Total Employees"
            value={kpis.totalEmployees ?? total}
            sub={`↑ ${kpis.newJoinings ?? 0} this month`}
            icon={Users}
            tone="violet"
          />
          <KpiCard
            label="Present Today"
            value={kpis.presentToday ?? 0}
            sub={`${pct(kpis.presentToday ?? 0, activeTotal)}% of total`}
            progress={pct(kpis.presentToday ?? 0, activeTotal)}
            icon={UserCheck}
            tone="emerald"
          />
          <KpiCard
            label="Absent"
            value={kpis.absent ?? 0}
            sub={`${pct(kpis.absent ?? 0, activeTotal)}% of total`}
            progress={pct(kpis.absent ?? 0, activeTotal)}
            icon={UserX}
            tone="rose"
          />
          <KpiCard
            label="On Leave"
            value={kpis.onLeave ?? 0}
            sub={`${pct(kpis.onLeave ?? 0, activeTotal)}% of total`}
            progress={pct(kpis.onLeave ?? 0, activeTotal)}
            icon={CalendarOff}
            tone="amber"
          />
          <KpiCard
            label="Today's Attendance"
            value={`${kpis.attendancePct ?? 0}%`}
            sub="+ 4.32% vs yesterday"
            icon={Clock3}
            tone="sky"
          />
        </div>

        <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email, phone, or EMP code..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:items-center">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="h-11 min-w-[130px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="on_notice">On Notice</option>
              <option value="on_leave">On Leave</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </select>
            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
              className="h-11 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
            <select
              value={designationId}
              onChange={(e) => {
                setDesignationId(e.target.value);
                setPage(1);
              }}
              className="h-11 min-w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600"
            >
              <option value="">All Designations</option>
              {designations.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-600"
            >
              <Filter className="h-4 w-4" /> Filters
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 px-1 text-[10px] font-bold text-[#5D5FEF]">
                2
              </span>
            </button>
            <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-4 xl:col-span-1">
              <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-[#5D5FEF]">
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button type="button" className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl border border-slate-100 bg-white" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-700">No employees yet</p>
          <p className="mt-1 text-sm text-slate-400">Add your first team member to start HR records.</p>
          <Button onClick={openCreate} className="mt-4 rounded-xl bg-[#5D5FEF] text-white">Add Employee</Button>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-4">
          {rows.map((emp, i) => (
            <motion.div
              key={emp._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="group rounded-[26px] border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold shadow-sm',
                  avatarTones[i % avatarTones.length]
                )}>
                  {initials(emp)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/hr/employees/${emp._id}`} className="block truncate text-sm font-bold text-slate-900 hover:text-[#5D5FEF]">
                        {fullName(emp)}
                      </Link>
                      <p className="text-[11px] font-semibold text-slate-400">{emp.employeeCode}</p>
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
                  <div className="mt-1 flex items-center gap-2 text-[11px]">
                    <span className="truncate text-slate-500">{emp.designationId?.name || '—'}</span>
                    {emp.departmentId?.name ? (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-[#5D5FEF]">{emp.departmentId.name}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                {emp.email && (
                  <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 shrink-0 text-slate-300" />{emp.email}</p>
                )}
                {emp.phone && (
                  <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0 text-slate-300" />{emp.phone}</p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold capitalize',
                  emp.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                )}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', emp.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400')} />
                  {statusLabel(emp.status)}
                </span>
                <span className="text-[11px] font-medium text-slate-400 capitalize">{statusLabel(emp.employmentType)}</span>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-[22px] border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p>Showing {startRow} to {endRow} of {total} employees</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Rows per page</span>
              <select
                value={data?.limit || 12}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-600"
                disabled
              >
                <option value="12">12</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-slate-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 4) }).map((_, idx) => {
                  const pageNo = idx + 1;
                  return (
                    <button
                      key={pageNo}
                      type="button"
                      onClick={() => setPage(pageNo)}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-lg border text-sm',
                        currentPage === pageNo
                          ? 'border-violet-200 bg-violet-50 font-semibold text-[#5D5FEF]'
                          : 'border-slate-200 bg-white text-slate-500'
                      )}
                    >
                      {pageNo}
                    </button>
                  );
                })}
                {totalPages > 4 ? <span className="px-1 text-slate-400">...</span> : null}
              </div>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        </>
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
