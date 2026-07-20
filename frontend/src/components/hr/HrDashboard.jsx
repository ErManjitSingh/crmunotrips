import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  UserCheck,
  UserX,
  CalendarOff,
  Cake,
  Award,
  ClipboardList,
  UserPlus,
  Clock,
  Wallet,
  Megaphone,
  Plus,
  ArrowRight,
} from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

const KPI = [
  { key: 'totalEmployees', label: 'Total Employees', icon: Users, tone: 'violet' },
  { key: 'presentToday', label: 'Present Today', icon: UserCheck, tone: 'emerald' },
  { key: 'absent', label: 'Absent', icon: UserX, tone: 'rose' },
  { key: 'onLeave', label: 'On Leave', icon: CalendarOff, tone: 'amber' },
  { key: 'pendingLeaves', label: 'Pending Leaves', icon: ClipboardList, tone: 'orange' },
  { key: 'newJoinings', label: 'New Joinings', icon: UserPlus, tone: 'sky' },
  { key: 'birthdays', label: 'Birthdays', icon: Cake, tone: 'pink' },
  { key: 'workAnniversaries', label: 'Anniversaries', icon: Award, tone: 'teal' },
  { key: 'attendancePct', label: "Today's Attendance %", icon: Clock, tone: 'blue', suffix: '%' },
];

const TONES = {
  violet: 'from-violet-50 to-white border-violet-100 text-violet-700',
  emerald: 'from-emerald-50 to-white border-emerald-100 text-emerald-700',
  rose: 'from-rose-50 to-white border-rose-100 text-rose-700',
  amber: 'from-amber-50 to-white border-amber-100 text-amber-700',
  orange: 'from-orange-50 to-white border-orange-100 text-orange-700',
  sky: 'from-sky-50 to-white border-sky-100 text-sky-700',
  pink: 'from-pink-50 to-white border-pink-100 text-pink-700',
  teal: 'from-teal-50 to-white border-teal-100 text-teal-700',
  blue: 'from-blue-50 to-white border-blue-100 text-blue-700',
};

const QUICK = [
  { to: '/hr/employees', label: 'Add Employee', icon: UserPlus },
  { to: '/hr/attendance', label: 'Mark Attendance', icon: Clock },
  { to: '/hr/leaves', label: 'Approve Leave', icon: CalendarOff },
  { to: '/hr/payroll', label: 'Run Payroll', icon: Wallet },
  { to: '/hr/holidays', label: 'Add Holiday', icon: Plus },
  { to: '/hr/announcements', label: 'Announcement', icon: Megaphone },
];

function fullName(e) {
  return [e?.firstName, e?.lastName].filter(Boolean).join(' ') || e?.employeeCode || 'Employee';
}

export default function HrDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'dashboard'],
    queryFn: hrApi.dashboard,
  });

  const kpis = data?.kpis || {};

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="HR Dashboard"
        description="People analytics, attendance pulse, and workforce actions"
        breadcrumbs={['HR', 'Dashboard']}
        actions={(
          <Link
            to="/hr/employees"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#5D5FEF] px-4 text-sm font-semibold text-white shadow-md shadow-violet-500/25 hover:bg-[#4F51E0]"
          >
            <Plus className="h-4 w-4" />
            Add Employee
          </Link>
        )}
      />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        {KPI.map((cfg, i) => {
          const Icon = cfg.icon;
          const raw = kpis[cfg.key] ?? 0;
          const value = cfg.suffix ? `${raw}${cfg.suffix}` : Number(raw).toLocaleString('en-IN');
          return (
            <motion.div
              key={cfg.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={cn(
                'rounded-2xl border bg-gradient-to-br p-3.5 shadow-sm',
                TONES[cfg.tone]
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <Icon className="h-4 w-4 opacity-80" />
                {isLoading && <span className="h-3 w-8 animate-pulse rounded bg-black/5" />}
              </div>
              <p className="text-xl font-bold tracking-tight metric-tabular text-slate-900">{value}</p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide opacity-70">{cfg.label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <div className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
                <p className="text-xs text-slate-500">Everyday HR workflows</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {QUICK.map((q) => {
                const Icon = q.icon;
                return (
                  <Link
                    key={q.to}
                    to={q.to}
                    className="group flex items-center gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#5D5FEF] shadow-sm ring-1 ring-slate-100 group-hover:ring-violet-200">
                      <Icon className="h-4 w-4" />
                    </span>
                    {q.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Department Distribution</h3>
                <p className="text-xs text-slate-500">Active headcount by team</p>
              </div>
              <Link to="/hr/departments" className="text-xs font-semibold text-[#5D5FEF] hover:underline inline-flex items-center gap-1">
                Manage <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {(data?.departmentDistribution || []).length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No department data yet — add employees to see distribution.</p>
            ) : (
              <div className="space-y-3">
                {(data?.departmentDistribution || []).map((d) => {
                  const max = Math.max(...(data.departmentDistribution.map((x) => x.value) || [1]));
                  const pct = max ? Math.round((d.value / max) * 100) : 0;
                  return (
                    <div key={d.name}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-semibold text-slate-700">{d.name}</span>
                        <span className="font-bold text-slate-900 metric-tabular">{d.value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-[#5D5FEF] to-violet-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <SideList title="Today's Birthdays" empty="No birthdays today" items={data?.todayBirthdays} />
          <SideList title="Work Anniversaries" empty="No anniversaries today" items={data?.todayAnniversaries} />
          <div className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-900">Pending Leaves</h3>
            {(data?.pendingLeaveRequests || []).length === 0 ? (
              <p className="text-sm text-slate-400">All clear — no pending requests.</p>
            ) : (
              <div className="space-y-2">
                {data.pendingLeaveRequests.map((l) => (
                  <Link
                    key={l._id}
                    to="/hr/leaves"
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 hover:bg-violet-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{fullName(l.employeeId)}</p>
                      <p className="text-[11px] capitalize text-slate-500">{l.leaveType?.replace(/_/g, ' ')} · {l.days}d</p>
                    </div>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">Pending</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SideList({ title, empty, items }) {
  return (
    <div className="rounded-2xl border border-subtle bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-slate-900">{title}</h3>
      {!items?.length ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((e) => (
            <div key={e._id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#5D5FEF] to-violet-600 text-xs font-bold text-white">
                {(e.firstName || '?')[0]}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{fullName(e)}</p>
                <p className="truncate text-[11px] text-slate-500">{e.departmentId?.name || e.employeeCode}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
