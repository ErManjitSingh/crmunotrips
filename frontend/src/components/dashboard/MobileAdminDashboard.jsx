import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Download,
  Filter,
  IndianRupee,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  TrendingUp,
  Upload,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { toast } from '../../context/ToastContext';
import { useTimeGreeting } from '../../lib/greeting';

const KPI_CONFIG = [
  { key: 'totalLeads', reportKey: 'totalLeads', label: 'Total Leads', icon: Users, tone: 'from-indigo-500 to-violet-600', color: '#7c3aed' },
  { key: 'totalBudget', label: 'Total Value', icon: IndianRupee, tone: 'from-emerald-400 to-teal-600', color: '#10b981', currency: true },
  { key: 'convertedLeads', reportKey: 'conversions', label: 'Converted Leads', icon: UserRoundCheck, tone: 'from-orange-400 to-orange-600', color: '#f97316' },
  { key: 'conversionRate', reportKey: 'conversionRate', label: 'Conversion Rate', icon: TrendingUp, tone: 'from-violet-400 to-purple-600', color: '#8b5cf6', suffix: '%' },
  { key: 'pendingFollowups', reportKey: 'followUpPending', label: 'Follow-ups', icon: Bell, tone: 'from-blue-400 to-blue-600', color: '#3b82f6' },
  { key: 'revenue', reportKey: 'revenue', label: 'Revenue', icon: IndianRupee, tone: 'from-pink-500 to-rose-600', color: '#ec4899', currency: true },
];

const STATUS_STYLES = {
  new: 'bg-violet-50 text-violet-600',
  contacted: 'bg-emerald-50 text-emerald-600',
  follow_up: 'bg-blue-50 text-blue-600',
  negotiation: 'bg-blue-50 text-blue-600',
  quotation_sent: 'bg-amber-50 text-amber-600',
  converted: 'bg-emerald-50 text-emerald-600',
};

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2)} Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

function titleCase(value) {
  return String(value || 'New')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name) {
  return String(name || 'User')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function sparkPath(values = []) {
  const points = values.length > 1 ? values : [0, Number(values[0] || 0), 0, Number(values[0] || 0)];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const spread = max - min || 1;
  return points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 22 - ((value - min) / spread) * 17;
      return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function KpiSparkline({ values, color }) {
  const path = sparkPath(values);
  return (
    <svg viewBox="0 0 100 25" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <path d={`${path} L100 25 L0 25 Z`} fill={color} opacity="0.08" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function QuickAction({ icon: Icon, label, to, onClick, primary = false, tone = 'text-violet-600' }) {
  const children = (
    <>
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${
        primary
          ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30'
          : `bg-white ${tone}`
      }`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className={`text-[9px] font-medium ${primary ? 'text-white' : 'text-slate-700'}`}>{label}</span>
    </>
  );
  const className = `flex min-w-0 flex-1 flex-col items-center gap-0.5 ${primary ? '-mt-4 rounded-xl bg-gradient-to-b from-violet-500 to-indigo-600 px-1 pb-1.5 pt-2 shadow-xl shadow-violet-500/30' : ''}`;

  if (to) return <Link to={to} className={className}>{children}</Link>;
  return <button type="button" onClick={onClick} className={className}>{children}</button>;
}

function exportRecentLeads(leads) {
  if (!leads.length) {
    toast.info('No recent leads available to export.');
    return;
  }
  const rows = [
    ['Lead ID', 'Customer', 'Phone', 'Destination', 'Status', 'Budget', 'Executive'],
    ...leads.map((lead) => [
      lead.leadId || '',
      lead.name || '',
      lead.phone || '',
      lead.destination || '',
      lead.status || '',
      lead.budget || 0,
      lead.assignedTo?.name || 'Unassigned',
    ]),
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `admin-recent-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function presetRange(preset) {
  const today = new Date();
  if (preset === 'today') {
    const day = toDateInput(today);
    return { dateFrom: day, dateTo: day };
  }
  if (preset === 'month') {
    return {
      dateFrom: toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
      dateTo: toDateInput(today),
    };
  }
  return { dateFrom: '', dateTo: '' };
}

export default function MobileAdminDashboard({
  stats,
  filters,
  onFiltersChange,
  isFetching,
}) {
  const { user } = useAuth();
  const { toggleMobileOpen } = useSidebar();
  const greeting = useTimeGreeting();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const report = stats?.report || {};
  const recentLeads = stats?.recentLeads || [];
  const executives = stats?.executivePerformance?.executives || [];
  const sources = report.leadsBySource || [];
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'Admin';
  const now = new Date();

  const revenueData = useMemo(() => {
    const rows = report.revenueVsBookings || [];
    return rows.map((row, index) => ({
      ...row,
      current: Number(row.revenue || 0),
      previous: Number(rows[index - 1]?.revenue || row.revenue * 0.72 || 0),
    }));
  }, [report.revenueVsBookings]);

  const currentRevenue = Number(stats?.revenue || 0);
  const previousRevenue = Number(revenueData.at(-2)?.current || 0);
  const growth = previousRevenue ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : Number(stats?.revenueChange || 0);
  const sourceTotal = sources.reduce((sum, row) => sum + Number(row.value || 0), 0) || Number(stats?.totalLeads || 0);
  const sourceColors = ['#7c3aed', '#3b82f6', '#10b981', '#f97316', '#ec4899'];

  return (
    <div className="min-h-full bg-[#f6f6fb] pb-4 lg:hidden">
      <section className="relative min-h-[222px] overflow-hidden rounded-b-[24px] bg-[#070b48] px-5 pb-10 pt-4 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_50%,rgba(105,45,230,0.48),transparent_48%)]" />
        <img
          src="/admin-mobile-dashboard-hero.png"
          alt=""
          className="pointer-events-none absolute bottom-0 right-[-38px] h-[155px] w-[270px] object-contain object-right-bottom opacity-95"
        />

        <div className="relative z-10 flex items-center justify-between">
          <button type="button" onClick={toggleMobileOpen} className="rounded-xl p-1 text-white/90" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <Link to="/leads" aria-label="Search leads"><Search className="h-5 w-5" /></Link>
            <button type="button" className="relative" aria-label="Notifications">
              <Bell className="h-5 w-5" />
            </button>
            <Link to="/profile" className="relative flex h-8 w-8 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold">
              {initials(user?.name)}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#070b48] bg-emerald-400" />
            </Link>
          </div>
        </div>

        <div className="relative z-10 mt-5 max-w-[62%]">
          <h1 className="text-[16px] font-bold leading-snug">{greeting}</h1>
          <p className="mt-0.5 text-[11px] text-white/80">Hi {firstName}</p>
          <p className="mt-1 text-[10px] text-white/75">Here&apos;s what&apos;s happening in your business today.</p>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 text-[10px] font-semibold backdrop-blur-sm"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </section>

      <div className="-mt-5 px-5">
        <div className="relative z-10 flex min-h-[64px] items-center justify-between rounded-2xl bg-white px-3 py-2 shadow-[0_10px_30px_rgba(32,25,92,0.14)]">
          <QuickAction icon={Upload} label="Import" tone="text-violet-600" onClick={() => toast.info('Lead CSV import is being prepared.')} />
          <QuickAction icon={Download} label="Export" tone="text-emerald-600" onClick={() => exportRecentLeads(recentLeads)} />
          <QuickAction icon={Plus} label="Add Lead" primary to="/leads/new" />
          <QuickAction icon={Filter} label="Filter" tone="text-blue-500" onClick={() => setFiltersOpen((open) => !open)} />
          <QuickAction icon={MoreHorizontal} label="More" tone="text-slate-500" to="/profile" />
        </div>

        {filtersOpen && (
          <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-lg">
            <div className="flex gap-2">
              {[
                ['all', 'All Time'],
                ['today', 'Today'],
                ['month', 'This Month'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, ...presetRange(key) })}
                  className="flex-1 rounded-xl border border-slate-200 px-2 py-2 text-[10px] font-semibold text-slate-600 hover:border-violet-300 hover:bg-violet-50"
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              value={filters.source || ''}
              onChange={(event) => onFiltersChange({ ...filters, source: event.target.value })}
              className="mt-2 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 outline-none"
            >
              <option value="">All Lead Sources</option>
              {sources.map((source) => <option key={source.key || source.name} value={source.key || source.name}>{source.name}</option>)}
            </select>
          </div>
        )}

        {isFetching && <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-violet-100"><div className="h-full w-1/3 animate-pulse bg-violet-500" /></div>}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {KPI_CONFIG.map((card) => {
            const Icon = card.icon;
            const meta = report.kpis?.[card.reportKey] || {};
            const change = Number(meta.change || 0);
            const sparkKey = card.key === 'convertedLeads'
              ? 'converted'
              : card.key === 'pendingFollowups'
                ? 'followUps'
                : card.key;
            return (
              <div key={card.key} className="min-w-0 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
                <div className="flex items-start gap-1.5">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white ${card.tone}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[7px] font-bold uppercase tracking-wide text-slate-500">{card.label}</p>
                    <p className="truncate text-[15px] font-bold leading-tight text-slate-900">
                      {card.currency ? formatCurrency(stats?.[card.key]) : `${stats?.[card.key] || 0}${card.suffix || ''}`}
                    </p>
                    <p className={`text-[8px] font-semibold ${change < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {change < 0 ? '↓' : '↑'} {Math.abs(change).toFixed(1)}%
                    </p>
                    <p className="text-[7px] text-slate-400">vs last period</p>
                  </div>
                </div>
                <div className="mt-1">
                  <KpiSparkline values={stats?.kpiSparklines?.[sparkKey] || []} color={card.color} />
                </div>
              </div>
            );
          })}
        </div>

        <section className="mt-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-bold text-slate-900">Revenue Overview</h2>
            <span className="rounded-lg border border-slate-200 px-2 py-1 text-[8px] font-semibold text-slate-600">This Month⌄</span>
          </div>
          <div className="mt-3 flex gap-2">
            <div className="w-[78px] shrink-0 space-y-3">
              <div><p className="text-sm font-bold text-slate-900">{formatCurrency(currentRevenue)}</p><p className="text-[8px] text-violet-600">This Month</p></div>
              <div><p className="text-xs font-bold text-slate-600">{formatCurrency(previousRevenue)}</p><p className="text-[8px] text-slate-400">Last Month</p></div>
              <div><p className={`text-sm font-bold ${growth < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{growth < 0 ? '↓' : '↑'} {Math.abs(growth).toFixed(1)}%</p><p className="text-[8px] text-slate-400">Growth</p></div>
            </div>
            <div className="h-[145px] min-w-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 12, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="admin-mobile-revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 7, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 7, fill: '#94a3b8' }} tickFormatter={formatCurrency} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: 10, fontSize: 9 }} />
                  <Area type="monotone" dataKey="previous" stroke="#d8b4fe" strokeWidth={1.5} fill="transparent" dot={false} />
                  <Area type="monotone" dataKey="current" stroke="#7c3aed" strokeWidth={2} fill="url(#admin-mobile-revenue)" dot={{ r: 2, fill: '#7c3aed' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <section className="min-w-0 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[9px] font-bold text-slate-900">Top Performing Executives</h2>
              <Link to="/team" className="text-[7px] font-semibold text-violet-600">View All</Link>
            </div>
            <div className="space-y-2">
              {executives.slice(0, 3).map((executive, index) => (
                <div key={executive._id || executive.name} className="flex items-center gap-1.5">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[7px] font-bold ${
                    index === 0 ? 'bg-violet-50 text-violet-600' : index === 1 ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-orange-600'
                  }`}>{index + 1}</span>
                  <p className="min-w-0 flex-1 truncate text-[8px] font-semibold text-slate-800">{executive.name}</p>
                  <span className="text-[7px] font-bold text-slate-700">{formatCurrency(executive.revenue)}</span>
                  <span className="text-[8px]">{index === 0 ? '👑' : index === 1 ? '🥈' : '🥉'}</span>
                </div>
              ))}
              {!executives.length && <p className="py-5 text-center text-[9px] text-slate-400">No executive data</p>}
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[9px] font-bold text-slate-900">Leads by Source</h2>
              <Link to="/leads" className="text-[7px] font-semibold text-violet-600">View All</Link>
            </div>
            <div className="flex items-center">
              <div className="relative h-[88px] w-[88px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sources} dataKey="value" innerRadius={24} outerRadius={39} paddingAngle={2} stroke="none">
                      {sources.map((source, index) => <Cell key={source.key || source.name} fill={source.color || sourceColors[index % sourceColors.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[12px] font-bold text-slate-900">{sourceTotal}</span>
                  <span className="text-[6px] text-slate-400">Total</span>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                {sources.slice(0, 4).map((source, index) => (
                  <div key={source.key || source.name} className="flex items-center gap-1 text-[7px]">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: source.color || sourceColors[index % sourceColors.length] }} />
                    <span className="min-w-0 flex-1 truncate text-slate-500">{source.name}</span>
                    <span className="font-bold text-slate-700">{source.pct ?? Math.round((source.value / sourceTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <section className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-[10px] font-bold text-slate-900">Recent Leads</h2>
            <Link to="/leads" className="text-[8px] font-semibold text-violet-600">View All</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentLeads.slice(0, 5).map((lead, index) => (
              <Link key={lead._id} to={`/leads/${lead._id}`} className="flex items-center gap-2.5 px-4 py-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white ${
                  ['bg-violet-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500'][index % 4]
                }`}>{initials(lead.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-semibold text-slate-900">{lead.name}</p>
                  <p className="truncate text-[8px] text-slate-400">{lead.destination || 'No destination'} · {lead.assignedTo?.name || 'Unassigned'}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[7px] font-semibold ${STATUS_STYLES[lead.status] || 'bg-slate-100 text-slate-600'}`}>{titleCase(lead.status)}</span>
                    <span className="text-[9px] font-bold text-slate-800">{formatCurrency(lead.budget)}</span>
                  </div>
                  <p className="mt-1 text-[7px] text-slate-400">
                    {lead.createdAt ? new Date(lead.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                  </p>
                </div>
              </Link>
            ))}
            {!recentLeads.length && <p className="px-4 py-8 text-center text-[10px] text-slate-400">No recent leads</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
