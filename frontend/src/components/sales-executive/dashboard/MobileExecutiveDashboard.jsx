import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Download,
  IndianRupee,
  Menu,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Upload,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { toast } from '../../../context/ToastContext';
import { useSidebar } from '../../../context/SidebarContext';
import { formatCurrency } from '../executiveUtils';
import QuotationBuilderPromoBanner from './QuotationBuilderPromoBanner';

const KPI_CARDS = [
  { key: 'myLeads', label: 'Total Leads', icon: Users, tone: 'bg-blue-500', spark: '#7c3aed' },
  { key: 'totalLeadValue', label: 'Total Value', icon: IndianRupee, tone: 'bg-emerald-500', spark: '#10b981', currency: true },
  { key: 'convertedLeads', label: 'Converted', icon: UserRoundCheck, tone: 'bg-orange-500', spark: '#f97316' },
  { key: 'conversionRate', label: 'Conversion Rate', icon: TrendingUp, tone: 'bg-violet-500', spark: '#8b5cf6', suffix: '%' },
  { key: 'todayFollowups', label: 'Follow-ups', icon: Phone, tone: 'bg-blue-500', spark: '#3b82f6' },
  { key: 'monthlyRevenue', label: 'Revenue', icon: IndianRupee, tone: 'bg-rose-500', spark: '#f43f5e', currency: true },
];

const STATUS_STYLES = {
  new: 'bg-violet-50 text-violet-600',
  contacted: 'bg-emerald-50 text-emerald-600',
  follow_up: 'bg-blue-50 text-blue-600',
  negotiation: 'bg-blue-50 text-blue-600',
  quotation_sent: 'bg-amber-50 text-amber-600',
  converted: 'bg-emerald-50 text-emerald-600',
};

function titleCase(value) {
  return String(value || 'New')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function initials(name) {
  return String(name || 'Lead')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function Sparkline({ color, index }) {
  const paths = [
    'M1 18 C9 17 10 11 17 13 S29 20 37 14 S49 7 58 12 S70 20 79 11 S91 5 99 9',
    'M1 18 C11 19 14 9 23 12 S37 20 45 13 S56 6 66 12 S80 18 99 8',
    'M1 17 C12 17 15 8 24 12 S37 19 47 14 S61 7 71 12 S84 18 99 10',
  ];
  return (
    <svg viewBox="0 0 100 24" className="h-7 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={`${paths[index % paths.length]} L99 24 L1 24 Z`} fill={color} opacity="0.08" />
      <path d={paths[index % paths.length]} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function QuickAction({ icon: Icon, label, tone, to, onClick, primary = false }) {
  const content = (
    <>
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${primary ? 'bg-gradient-to-br from-violet-500 to-blue-500 text-white shadow-lg shadow-violet-400/30' : tone}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[10px] font-medium text-slate-700">{label}</span>
    </>
  );
  const className = "flex min-w-0 flex-1 flex-col items-center gap-1.5";

  if (to) return <Link to={to} className={className}>{content}</Link>;
  return <button type="button" onClick={onClick} className={className}>{content}</button>;
}

function exportRecentLeads(leads) {
  if (!leads.length) {
    toast.info('No recent leads available to export.');
    return;
  }
  const rows = [
    ['Lead ID', 'Customer', 'Destination', 'Status', 'Budget'],
    ...leads.map((lead) => [lead.leadId || '', lead.name || '', lead.destination || '', lead.status || '', lead.budget || 0]),
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `recent-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function MobileExecutiveDashboard({
  data,
  hero,
  firstName,
  greeting,
  now,
  unreadCount = 0,
}) {
  const navigate = useNavigate();
  const { toggleMobileOpen } = useSidebar();
  const kpis = data?.kpis || {};
  const leads = data?.recentLeads || [];
  const conversionRate = kpis.myLeads
    ? Math.round(((kpis.convertedLeads || 0) / kpis.myLeads) * 1000) / 10
    : 0;
  const values = { ...kpis, conversionRate };
  const progress = Math.min(100, Number(data?.target?.progress || 0));

  const submitSearch = (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('search')?.trim();
    navigate(value ? `/sales-executive/leads/all?search=${encodeURIComponent(value)}` : '/sales-executive/leads/all');
  };

  return (
    <div className="min-h-full bg-[#f7f7fb] pb-4 lg:hidden">
      <section className="relative overflow-hidden rounded-b-[24px] bg-gradient-to-br from-[#1738a5] via-[#5b21b6] to-[#8b2bd0] px-5 pb-9 pt-4 text-white">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <button type="button" onClick={toggleMobileOpen} className="rounded-xl p-1.5 text-white/90" aria-label="Open menu">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-md">✈️</span>
            <span className="text-[17px] font-bold">UNO Trips CRM</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/sales-executive/leads/all" aria-label="Search leads">
              <Search className="h-5 w-5" />
            </Link>
            <button type="button" className="relative" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="relative mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[16px] font-bold leading-snug">{greeting}</h1>
            <p className="mt-0.5 text-[11px] text-white/75">Hi {firstName} — here&apos;s what&apos;s happening with your leads today.</p>
          </div>
          <button type="button" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-lg">
            <CalendarDays className="h-4 w-4 text-violet-600" />
            {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </section>

      <div className="-mt-5 px-5">
        <div className="relative flex items-start justify-between rounded-2xl bg-white px-3 py-3 shadow-[0_8px_24px_rgba(63,40,120,0.12)]">
          <QuickAction icon={Upload} label="Import" tone="bg-violet-50 text-violet-600" onClick={() => toast.info('Lead CSV import is being prepared.')} />
          <QuickAction icon={Download} label="Export" tone="bg-emerald-50 text-emerald-600" onClick={() => exportRecentLeads(leads)} />
          <QuickAction icon={Plus} label="Add Lead" primary to="/sales-executive/leads/add" />
          <QuickAction icon={Phone} label="Follow-up" tone="bg-orange-50 text-orange-500" to="/sales-executive/follow-ups" />
          <QuickAction icon={MoreHorizontal} label="More" tone="bg-slate-50 text-slate-500" to="/sales-executive/profile" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {KPI_CARDS.map((card, index) => {
            const Icon = card.icon;
            const trendKey = card.key === 'conversionRate' ? 'convertedLeads' : card.key;
            const trend = data?.kpiTrends?.[trendKey]?.change;
            const rawValue = values[card.key] || 0;
            return (
              <Link
                key={card.key}
                to={card.key === 'todayFollowups' ? '/sales-executive/follow-ups' : '/sales-executive/leads/all'}
                className="min-w-0 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm"
              >
                <div className="flex items-start gap-1.5">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${card.tone}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[8px] font-bold uppercase tracking-wide text-slate-500">{card.label}</p>
                    <p className="truncate text-[15px] font-bold leading-tight text-slate-900">
                      {card.currency ? formatCurrency(rawValue) : `${rawValue}${card.suffix || ''}`}
                    </p>
                    <p className={`text-[8px] font-semibold ${(trend || 0) < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {(trend || 0) < 0 ? '↓' : '↑'} {Math.abs(trend || 0)}%
                    </p>
                  </div>
                </div>
                <div className="mt-1"><Sparkline color={card.spark} index={index} /></div>
              </Link>
            );
          })}
        </div>

        <QuotationBuilderPromoBanner compact to="/sales-executive/quotations/new" />

        <section className="relative mt-4 overflow-hidden rounded-2xl bg-gradient-to-r from-violet-700 via-fuchsia-600 to-rose-500 p-4 text-white shadow-lg shadow-fuchsia-500/15">
          <button type="button" className="absolute right-3 top-2 text-white/65" aria-label="Dismiss offer">×</button>
          <div className="flex gap-3">
            <span className="text-4xl" aria-hidden>🎁</span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-semibold text-amber-200">🔥 {hero?.badge || 'Monthly Goal'}</p>
              <h2 className="mt-0.5 line-clamp-1 text-sm font-bold">{hero?.title || 'Close more leads and unlock your monthly reward'}</h2>
              <p className="mt-1 line-clamp-2 text-[10px] text-white/80">
                {hero?.description || `You have completed ${progress}% of your monthly sales target.`}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/20">
                  <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
                </div>
                <span className="text-[9px] font-semibold">{progress}%</span>
                <button type="button" className="rounded-lg bg-amber-300 px-2.5 py-1 text-[9px] font-bold text-slate-900">Join Now</button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
          <form onSubmit={submitSearch} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              name="search"
              type="search"
              placeholder="Search customer, phone, email, lead ID..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none focus:border-violet-400"
            />
          </form>
          <div className="mt-2 flex gap-2 overflow-x-auto">
            <Link to="/sales-executive/leads/all" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[10px] font-semibold text-slate-600">
              <SlidersHorizontal className="h-3.5 w-3.5 text-violet-500" /> All Statuses <ChevronDown className="h-3 w-3" />
            </Link>
            <Link to="/sales-executive/leads/all" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[10px] font-semibold text-slate-600">
              All Sources <ChevronDown className="h-3 w-3" />
            </Link>
            <Link to="/sales-executive/leads/all" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-[10px] font-semibold text-slate-600">
              All Destinations <ChevronDown className="h-3 w-3" />
            </Link>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-xs font-bold text-slate-900">Recent Leads</h2>
            <Link to="/sales-executive/leads/all" className="text-[10px] font-semibold text-violet-600">View All</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {leads.slice(0, 5).map((lead, index) => (
              <Link key={lead._id} to={`/sales-executive/leads/${lead._id}/view`} className="flex items-center gap-2.5 px-4 py-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                  ['bg-violet-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500'][index % 4]
                }`}>
                  {initials(lead.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-slate-900">{lead.name}</p>
                  <p className="truncate text-[9px] text-slate-400">{lead.destination || 'Destination not selected'}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${STATUS_STYLES[lead.status] || 'bg-slate-100 text-slate-600'}`}>
                      {titleCase(lead.status)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-800">{formatCurrency(lead.budget || 0)}</span>
                  </div>
                  <p className="mt-1 text-[8px] text-slate-400">
                    {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Recent'}
                  </p>
                </div>
              </Link>
            ))}
            {!leads.length && <p className="px-4 py-8 text-center text-xs text-slate-400">No recent leads found</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
