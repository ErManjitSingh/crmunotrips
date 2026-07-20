import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Users,
  UserCheck,
  UserX,
  CalendarOff,
  Clock,
  UserPlus,
  Wallet,
  Megaphone,
  Plus,
  Cake,
  Gift,
  TrendingUp,
  TrendingDown,
  Briefcase,
  Video,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hrApi } from '../../services/hrApi';
import { cn } from '../../lib/utils';

const DEPT_COLORS = ['#5D5FEF', '#14B8A6', '#8B5CF6', '#F97316', '#22C55E', '#94A3B8'];

const QUICK = [
  { to: '/hr/employees', label: 'Add Employee', icon: UserPlus, tone: 'violet' },
  { to: '/hr/attendance', label: 'Mark Attendance', icon: Clock, tone: 'emerald' },
  { to: '/hr/leaves', label: 'Approve Leave', icon: CalendarOff, tone: 'amber' },
  { to: '/hr/payroll', label: 'Run Payroll', icon: Wallet, tone: 'sky' },
  { to: '/hr/holidays', label: 'Add Holiday', icon: Plus, tone: 'rose' },
  { to: '/hr/announcements', label: 'Announcement', icon: Megaphone, tone: 'indigo' },
];

const QUICK_TONES = {
  violet: 'bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100',
  sky: 'bg-sky-50 text-sky-600 border-sky-100 hover:bg-sky-100',
  rose: 'bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100',
};

function fullName(e) {
  if (!e) return '—';
  if (typeof e === 'string') return e;
  return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.employeeCode || 'Employee';
}

function formatCurrency(n) {
  const v = Number(n) || 0;
  return `₹ ${v.toLocaleString('en-IN')}`;
}

function formatInterviewDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatInterviewTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function yearsSince(date) {
  if (!date) return 0;
  const start = new Date(date);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  if (now.getMonth() < start.getMonth() || (now.getMonth() === start.getMonth() && now.getDate() < start.getDate())) {
    years -= 1;
  }
  return Math.max(0, years);
}

function KpiCard({ label, value, sub, trend, trendUp, progress, icon: Icon, iconBg, loading }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', iconBg)}>
          <Icon className="h-5 w-5" />
        </div>
        {trend != null && (
          <span className={cn(
            'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold',
            trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          )}>
            {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">
        {loading ? '—' : value}
      </p>
      <p className="text-xs font-semibold text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
      {progress != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#5D5FEF]" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      )}
    </div>
  );
}

export default function HrDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['hr', 'dashboard'],
    queryFn: hrApi.dashboard,
  });

  const kpis = data?.kpis || {};
  const overview = data?.overview || {};
  const growth = data?.employeeGrowth || [];
  const deptData = (data?.departmentDistribution || []).map((d, i) => ({
    ...d,
    color: DEPT_COLORS[i % DEPT_COLORS.length],
  }));
  const deptTotal = deptData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-5 pb-2">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-indigo-50 p-5 sm:p-6 shadow-sm">
        <div className="relative z-10 max-w-2xl">
          <p className="text-sm text-slate-600">
            Welcome back, <span className="font-semibold text-slate-800">{user?.name || 'HR Admin'}</span>! 👋
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">HR Dashboard</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-lg">
            Track workforce, attendance, leaves and more in real-time.
          </p>
        </div>
        <div className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 sm:block lg:right-8">
          <div className="relative h-28 w-40">
            <div className="absolute bottom-0 right-8 h-16 w-12 rounded-lg bg-[#5D5FEF]/20 border border-violet-200" />
            <div className="absolute bottom-0 right-0 h-20 w-14 rounded-lg bg-violet-100 border border-violet-200" />
            <div className="absolute top-2 right-12 h-10 w-10 rounded-full bg-emerald-400/30 border-2 border-emerald-300" />
            <div className="absolute top-0 right-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg border border-slate-100">
              <TrendingUp className="h-7 w-7 text-[#5D5FEF]" />
            </div>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          loading={isLoading}
          label="Total Employees"
          value={kpis.totalEmployees ?? 0}
          trend={`↑ ${kpis.newJoinings ?? 0} this month`}
          trendUp
          icon={Users}
          iconBg="bg-violet-100 text-[#5D5FEF]"
        />
        <KpiCard
          loading={isLoading}
          label="Present Today"
          value={kpis.presentToday ?? 0}
          sub={`${kpis.presentPct ?? 0}% of total`}
          progress={kpis.presentPct ?? 0}
          icon={UserCheck}
          iconBg="bg-emerald-100 text-emerald-600"
        />
        <KpiCard
          loading={isLoading}
          label="Absent"
          value={kpis.absent ?? 0}
          sub={`${kpis.absentPct ?? 0}% of total`}
          icon={UserX}
          iconBg="bg-rose-100 text-rose-600"
        />
        <KpiCard
          loading={isLoading}
          label="On Leave"
          value={kpis.onLeave ?? 0}
          sub={`${kpis.onLeavePct ?? 0}% of total`}
          icon={CalendarOff}
          iconBg="bg-amber-100 text-amber-600"
        />
        <KpiCard
          loading={isLoading}
          label="Today's Attendance"
          value={`${kpis.attendancePct ?? 0}%`}
          trend="↑ 4.2% vs yesterday"
          trendUp
          icon={Clock}
          iconBg="bg-sky-100 text-sky-600"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-7 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Employee Growth</h3>
              <p className="text-xs text-slate-500">New joinings over the last 6 months</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">Last 6 Months</span>
          </div>
          <div className="h-[240px]">
            {growth.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growth} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="shortLabel" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip
                    content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm shadow-lg">
                        <p className="text-xs text-slate-500 mb-1">{label}</p>
                        <p className="font-semibold text-[#5D5FEF]">{payload[0].value} employees</p>
                      </div>
                    ) : null}
                  />
                  <Line
                    type="monotone"
                    dataKey="employees"
                    stroke="#5D5FEF"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#5D5FEF', strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-slate-400">No growth data yet</p>
            )}
          </div>
        </div>

        <div className="xl:col-span-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">Department Distribution</h3>
            <p className="text-xs text-slate-500">Active headcount by team</p>
          </div>
          {deptData.length && deptTotal ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative h-[170px] w-[170px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={deptData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={76}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {deptData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xl font-bold text-slate-900">{deptTotal}</p>
                  <p className="text-[10px] text-slate-500">Total</p>
                </div>
              </div>
              <div className="flex-1 w-full space-y-2">
                {deptData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="flex-1 truncate text-slate-600">{d.name}</span>
                    <span className="font-semibold text-slate-800 tabular-nums">{d.value}</span>
                    <span className="text-xs text-slate-400 w-10 text-right tabular-nums">
                      {deptTotal ? Math.round((d.value / deptTotal) * 1000) / 10 : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-400">Add employees to see distribution</p>
          )}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {QUICK.map((q) => {
                const Icon = q.icon;
                return (
                  <Link
                    key={q.to}
                    to={q.to}
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-center text-xs font-semibold transition',
                      QUICK_TONES[q.tone]
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {q.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Upcoming Interviews</h3>
              <Link to="/hr/interviews" className="text-xs font-semibold text-[#5D5FEF] hover:underline">View all</Link>
            </div>
            {(data?.upcomingInterviews || []).length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No upcoming interviews scheduled</p>
            ) : (
              <div className="space-y-3">
                {data.upcomingInterviews.map((iv) => {
                  const candidate = iv.candidateId;
                  const job = iv.jobOpeningId?.title || iv.round || 'Interview';
                  return (
                    <div key={iv._id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#5D5FEF]/10 text-sm font-bold text-[#5D5FEF]">
                        {(candidate?.firstName || '?')[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800 truncate">{fullName(candidate)}</p>
                        <p className="text-xs text-slate-500 truncate">{job}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatInterviewDate(iv.scheduledAt)} · {formatInterviewTime(iv.scheduledAt)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-lg bg-violet-100 px-2 py-1 text-[10px] font-bold uppercase text-[#5D5FEF]">
                        {iv.round || 'Round'}
                      </span>
                      <Video className="h-4 w-4 text-slate-400 shrink-0 hidden sm:block" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 xl:col-span-4">
          <WidgetList
            title="Today's Birthdays"
            icon={Cake}
            iconTone="text-pink-500"
            empty="No birthdays today"
            items={data?.todayBirthdays}
          />
          <WidgetList
            title="Work Anniversaries"
            icon={Gift}
            iconTone="text-amber-500"
            empty="No anniversaries today"
            items={data?.todayAnniversaries}
            showYears
          />
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-3">Pending Leaves</h3>
            {(data?.pendingLeaveRequests || []).length === 0 ? (
              <p className="text-sm text-slate-400">All clear — no pending requests.</p>
            ) : (
              <div className="space-y-2">
                {data.pendingLeaveRequests.map((l) => (
                  <Link
                    key={l._id}
                    to="/hr/leaves"
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 hover:bg-violet-50 transition"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{fullName(l.employeeId)}</p>
                      <p className="text-[11px] capitalize text-slate-500">
                        {l.leaveType?.replace(/_/g, ' ')} · {l.days} day{l.days !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700 shrink-0">
                      Pending
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* HR Overview footer */}
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3 px-1">HR Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <OverviewTile label="New Joinings" value={overview.newJoinings ?? kpis.newJoinings ?? 0} />
          <OverviewTile label="Resignations" value={overview.resignations ?? 0} />
          <OverviewTile label="Avg. Attendance" value={`${overview.averageAttendance ?? kpis.attendancePct ?? 0}%`} />
          <OverviewTile label="Leaves Taken" value={overview.leavesTaken ?? 0} />
          <OverviewTile
            label="Payroll This Month"
            value={formatCurrency(overview.payrollThisMonth)}
            sub={overview.payrollProcessedOn ? `Processed ${new Date(overview.payrollProcessedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Not processed yet'}
            wide
          />
        </div>
      </div>
    </div>
  );
}

function WidgetList({ title, icon: Icon, iconTone, empty, items, showYears }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn('h-4 w-4', iconTone)} />
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
      </div>
      {!items?.length ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((e) => (
            <div key={e._id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#5D5FEF] to-violet-600 text-xs font-bold text-white shrink-0">
                {(e.firstName || '?')[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{fullName(e)}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {showYears
                    ? `${yearsSince(e.joiningDate)} year${yearsSince(e.joiningDate) !== 1 ? 's' : ''}`
                    : (e.departmentId?.name || e.employeeCode || '')}
                </p>
              </div>
              {showYears ? (
                <Briefcase className="h-4 w-4 text-amber-500 shrink-0" />
              ) : (
                <Gift className="h-4 w-4 text-pink-400 shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OverviewTile({ label, value, sub, wide }) {
  return (
    <div className={cn('rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3', wide && 'sm:col-span-2 lg:col-span-1')}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
