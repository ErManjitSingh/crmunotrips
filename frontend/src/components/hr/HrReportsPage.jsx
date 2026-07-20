import { useQuery } from '@tanstack/react-query';
import { Users, Clock, Wallet, UserPlus, Receipt, Laptop, LogOut, GraduationCap } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { hrApi } from '../../services/hrApi';

function inr(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function Card({ title, icon: Icon, children }) {
  return (
    <div className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function HrReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'reports'],
    queryFn: hrApi.reports,
  });

  if (isLoading) {
    return <div className="py-20 text-center text-slate-400">Loading reports…</div>;
  }

  const d = data || {};
  const maxDept = Math.max(1, ...(d.departments || []).map((x) => x.value));
  const maxFunnel = Math.max(1, ...(d.hiring?.funnel || []).map((x) => x.count));

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="HR Reports"
        description="Attendance, salary, hiring, attrition and department analytics"
        breadcrumbs={['HR', 'Reports']}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Workforce" icon={Users}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Total" value={d.workforce?.totalEmployees ?? 0} />
            <Stat label="Active" value={d.workforce?.activeEmployees ?? 0} />
            <Stat label="On Notice" value={d.workforce?.onNotice ?? 0} />
            <Stat label="Attrition %" value={d.workforce?.attritionRate ?? 0} />
          </div>
        </Card>

        <Card title="Attendance" icon={Clock}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Present Today" value={d.attendance?.presentToday ?? 0} />
            <Stat label="Attendance %" value={`${d.attendance?.attendancePct ?? 0}%`} />
            <Stat label="Pending Leaves" value={d.leaves?.pending ?? 0} />
            <Stat label="Approved (Month)" value={d.leaves?.approvedThisMonth ?? 0} />
          </div>
        </Card>

        <Card title="Salary" icon={Wallet}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Latest Run" value={d.salary?.latestMonth || '—'} />
            <Stat label="Headcount" value={d.salary?.headcount ?? 0} />
            <Stat label="Gross" value={inr(d.salary?.latestGross)} />
            <Stat label="Net" value={inr(d.salary?.latestNet)} />
          </div>
        </Card>

        <Card title="Hiring" icon={UserPlus}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Open Jobs" value={d.hiring?.openJobs ?? 0} />
            <Stat label="Hired (Month)" value={d.hiring?.hiredThisMonth ?? 0} />
            <Stat label="Expenses Pending" value={d.expenses?.pending ?? 0} />
            <Stat label="Expense Paid" value={inr(d.expenses?.approvedTotal)} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Department Distribution" icon={Users}>
          <ul className="space-y-2">
            {(d.departments || []).length === 0 ? (
              <p className="text-sm text-slate-400">No data</p>
            ) : (d.departments || []).map((row) => (
              <li key={row.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">{row.name}</span>
                  <span className="text-slate-500">{row.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#5D5FEF]" style={{ width: `${(row.value / maxDept) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Recruitment Funnel" icon={UserPlus}>
          <ul className="space-y-2">
            {(d.hiring?.funnel || []).map((row) => (
              <li key={row.stage}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold capitalize text-slate-700">{row.stage}</span>
                  <span className="text-slate-500">{row.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-violet-400" style={{ width: `${(row.count / maxFunnel) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Operations Snapshot" icon={Receipt}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Assets Assigned" value={d.assets?.assigned ?? 0} />
            <Stat label="Open Exits" value={d.exits?.open ?? 0} />
            <Stat label="Training Done" value={d.training?.completed ?? 0} />
            <Stat label="Terminated" value={d.workforce?.terminated ?? 0} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1"><Laptop className="h-3.5 w-3.5" /> Assets</span>
            <span className="inline-flex items-center gap-1"><LogOut className="h-3.5 w-3.5" /> Exits</span>
            <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> Training</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
