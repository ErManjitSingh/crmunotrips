import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { hrApi } from '../../services/hrApi';

export default function HrEmployeeProfilePage() {
  const { id } = useParams();
  const { data: emp, isLoading } = useQuery({
    queryKey: ['hr', 'employee', id],
    queryFn: () => hrApi.employee(id),
    enabled: Boolean(id),
  });

  if (isLoading) return <div className="py-20 text-center text-slate-400">Loading profile…</div>;
  if (!emp) return <div className="py-20 text-center text-slate-400">Employee not found</div>;

  const name = [emp.firstName, emp.lastName].filter(Boolean).join(' ');

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title={name}
        description={`${emp.employeeCode} · ${emp.designationId?.name || '—'} · ${emp.departmentId?.name || '—'}`}
        breadcrumbs={['HR', 'Employees', name]}
        actions={(
          <Link to="/hr/employees" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        )}
      />

      <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-[#5D5FEF] via-violet-600 to-indigo-700 p-6 text-white shadow-lg shadow-violet-500/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold backdrop-blur">
            {(emp.firstName || '?')[0]}
          </div>
          <div>
            <p className="text-2xl font-bold">{name}</p>
            <p className="text-sm text-white/80">{emp.employeeCode} · {emp.status?.replace(/_/g, ' ')}</p>
            <p className="mt-1 text-sm text-white/70 capitalize">{emp.employmentType?.replace(/_/g, ' ')} · Shift: {emp.shift || '—'}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <InfoCard title="Contact" rows={[
          { icon: Mail, label: 'Email', value: emp.email || '—' },
          { icon: Phone, label: 'Phone', value: emp.phone || '—' },
          { icon: MapPin, label: 'Location', value: emp.workLocation || emp.address?.city || '—' },
        ]} />
        <InfoCard title="Role" rows={[
          { icon: Briefcase, label: 'Designation', value: emp.designationId?.name || '—' },
          { icon: Briefcase, label: 'Department', value: emp.departmentId?.name || '—' },
          { icon: Calendar, label: 'Joined', value: emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN') : '—' },
        ]} />
        <InfoCard title="Compensation" rows={[
          { icon: Briefcase, label: 'Salary', value: emp.salary ? `₹${Number(emp.salary).toLocaleString('en-IN')}` : '—' },
          { icon: Briefcase, label: 'Manager', value: emp.reportingManagerId ? [emp.reportingManagerId.firstName, emp.reportingManagerId.lastName].filter(Boolean).join(' ') : '—' },
          { icon: Briefcase, label: 'Branch', value: emp.branchId?.name || '—' },
        ]} />
      </div>
    </div>
  );
}

function InfoCard({ title, rows }) {
  return (
    <div className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-900">{title}</h3>
      <div className="space-y-3">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.label} className="flex items-start gap-2.5">
              <Icon className="mt-0.5 h-4 w-4 text-violet-500" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{r.label}</p>
                <p className="text-sm font-semibold text-slate-800">{r.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
