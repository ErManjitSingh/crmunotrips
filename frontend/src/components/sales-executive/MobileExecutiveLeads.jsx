import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  FileText,
  Filter,
  Flame,
  Link2,
  List,
  MapPin,
  Menu,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Target,
  Trophy,
  User,
  Loader,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { useSidebarCounts } from '../../hooks/useSidebarCounts';
import { beginLeadCall } from '../../lib/callSession';
import { LEAD_SOURCE_FILTER_OPTIONS } from '../../lib/leadSourceLabels';
import { DESTINATIONS, INDIAN_STATES } from '../leads/constants';
import { LEAD_FOLLOW_UP_OUTCOMES } from '../../constants/leadFollowUpOutcomes';
import { SourceBadge } from '../sales-manager/LeadListBadges';
import { cn } from '../../lib/utils';
import { toast } from '../../context/ToastContext';
import PeriodPresetChips from '../ui/PeriodPresetChips';

const KPI_CARDS = [
  {
    key: 'all',
    title: 'Total Leads',
    hint: 'All your active leads',
    path: '/sales-executive/leads/all',
    icon: List,
    wrap: 'from-slate-50 to-violet-50 border-slate-100',
    iconBg: 'bg-slate-700 text-white',
    valueClass: 'text-slate-800',
    arrow: 'bg-slate-700 text-white',
  },
  {
    key: 'new',
    title: 'Fresh / Today',
    hint: 'Created or assigned today',
    path: '/sales-executive/leads/new',
    icon: FileText,
    wrap: 'from-violet-50 to-indigo-50 border-violet-100',
    iconBg: 'bg-violet-600 text-white',
    valueClass: 'text-violet-700',
    arrow: 'bg-violet-600 text-white',
  },
  {
    key: 'contacted',
    title: 'Connected',
    hint: 'Call picked leads',
    path: '/sales-executive/leads/contacted',
    icon: Phone,
    wrap: 'from-emerald-50 to-teal-50 border-emerald-100',
    iconBg: 'bg-emerald-500 text-white',
    valueClass: 'text-emerald-700',
    arrow: 'bg-emerald-500 text-white',
  },
  {
    key: 'workingProgress',
    title: 'Work in Progress',
    hint: 'Requirements in motion',
    path: '/sales-executive/leads/working-progress',
    icon: Loader,
    wrap: 'from-orange-50 to-amber-50 border-orange-100',
    iconBg: 'bg-orange-500 text-white',
    valueClass: 'text-orange-700',
    arrow: 'bg-orange-500 text-white',
  },
  {
    key: 'converted',
    title: 'Converted',
    hint: 'Successful conversions',
    path: '/sales-executive/leads/converted',
    icon: Trophy,
    wrap: 'from-amber-50 to-orange-50 border-amber-100',
    iconBg: 'bg-amber-500 text-white',
    valueClass: 'text-amber-700',
    arrow: 'bg-amber-500 text-white',
  },
];

const TABS = [
  { key: 'all', label: 'All Leads', countKey: 'all', path: '/sales-executive/leads/all' },
  { key: 'all-mine', label: 'My Leads', countKey: 'all', path: '/sales-executive/leads/all' },
  { key: 'lost', label: 'Archived', countKey: 'lost', path: '/sales-executive/leads/lost' },
];

const STATUS_PILL = {
  new: 'bg-violet-100 text-violet-700',
  contacted: 'bg-emerald-100 text-emerald-700',
  working_progress: 'bg-cyan-100 text-cyan-700',
  follow_up: 'bg-sky-100 text-sky-700',
  quotation_sent: 'bg-amber-100 text-amber-700',
  negotiation: 'bg-orange-100 text-orange-700',
  converted: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-rose-100 text-rose-700',
  reactivated: 'bg-teal-100 text-teal-700',
  booked_from_another_company: 'bg-rose-100 text-rose-700',
};

const AVATAR_TONES = [
  'bg-rose-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-orange-500',
];

const INTENT_OPTIONS = [
  { value: '', label: 'All Intents' },
  { value: 'hot', label: 'Hot leads' },
  { value: 'high', label: 'High intent' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function initials(name) {
  return String(name || 'L')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function avatarTone(name = '') {
  return AVATAR_TONES[(name.charCodeAt(0) || 0) % AVATAR_TONES.length];
}

function titleCaseStatus(status) {
  if (status === 'new') return 'New Lead';
  if (status === 'contacted') return 'Connected';
  if (status === 'follow_up') return 'Follow-up';
  return String(status || 'New')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatMealPlan(lead) {
  const key = String(lead?.mealPlan || lead?.mealPreference || 'map')
    .trim()
    .toLowerCase();
  return ['ep', 'cp', 'map', 'ap'].includes(key) ? key.toUpperCase() : 'MAP';
}

function formatTravelers(lead) {
  const adults = Number(lead?.adults ?? lead?.travelers ?? 0);
  const children = Number(lead?.children || 0);
  if (!adults && !children) return '—';
  const parts = [];
  if (adults) parts.push(`${adults} Adult${adults === 1 ? '' : 's'}`);
  if (children) parts.push(`${children} Child${children === 1 ? '' : 'ren'}`);
  return parts.join(', ');
}

function pad2(n) {
  return String(Math.max(0, Number(n) || 0)).padStart(2, '0');
}

function isFollowUpDue(lead) {
  if (!lead?.nextFollowUp) return false;
  return new Date(lead.nextFollowUp).getTime() <= Date.now();
}

function isHot(lead) {
  return lead?.isHot || lead?.priority === 'hot' || lead?.temperature === 'hot';
}

function FilterSelect({ icon: Icon, value, onChange, children, className }) {
  return (
    <div className={cn('relative', className)}>
      <Icon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none truncate rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-7 text-[11px] font-semibold text-slate-700 shadow-sm"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

export default function MobileExecutiveLeads({
  filter = 'all',
  title = 'All Leads',
  subtitle = 'Complete pipeline — every lead assigned to you',
  leads = [],
  loading = false,
  search = '',
  onSearchChange,
  statusFilter = '',
  onStatusChange,
  destinationFilter = '',
  onDestinationChange,
  stateFilter = '',
  onStateChange,
  priorityFilter = '',
  onPriorityChange,
  sourceFilter = '',
  onSourceChange,
  dateFrom = '',
  dateTo = '',
  onPeriodSelect,
  onRefresh,
  onOpenLead,
  onOpenMenu,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toggleMobileOpen } = useSidebar();
  const counts = useSidebarCounts();
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(true);
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false);
  const [menuLeadId, setMenuLeadId] = useState(null);

  const kpiValues = useMemo(
    () => ({
      all: counts?.leads?.all ?? 0,
      new: counts?.leads?.new ?? 0,
      contacted: counts?.leads?.contacted ?? 0,
      workingProgress: counts?.leads?.workingProgress ?? 0,
      converted: counts?.leads?.converted ?? 0,
    }),
    [counts],
  );

  const tabCounts = useMemo(
    () => ({
      all: counts?.leads?.all ?? 0,
      lost: counts?.leads?.lost ?? 0,
    }),
    [counts],
  );

  const clearAll = () => {
    onSearchChange?.('');
    onStatusChange?.('');
    onDestinationChange?.('');
    onStateChange?.('');
    onPriorityChange?.('');
    onSourceChange?.('');
  };

  const hasFilters = Boolean(search || statusFilter || destinationFilter || stateFilter || priorityFilter || sourceFilter);
  const userInitial = initials(user?.name || 'A').slice(0, 1);

  const visibleLeads = useMemo(() => {
    if (!sourceFilter) return leads;
    return leads.filter((l) => String(l.source || '') === sourceFilter);
  }, [leads, sourceFilter]);

  return (
    <div className="min-h-full bg-[#f7f7fb] pb-28 lg:hidden">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleMobileOpen}
            aria-label="Open menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1" />
          <button
            type="button"
            aria-label="Search"
            onClick={() => setHeaderSearchOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Refresh"
            onClick={onRefresh}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
          >
            <RefreshCw className="h-[18px] w-[18px]" />
          </button>
          <Link
            to="/sales-executive/leads/add"
            aria-label="New lead"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6D5EF5] text-white shadow-md shadow-violet-500/30"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </Link>
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white shadow-sm">
            {userInitial}
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400" />
          </div>
        </div>
        {headerSearchOpen ? (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search by name, destination, phone, email..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
            />
          </div>
        ) : null}
      </header>

      <main className="space-y-4 px-4 pt-4">
        <div className="space-y-3">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-1 text-[13px] text-slate-500">{subtitle}</p>
          </div>
          <Link
            to="/sales-executive/leads/add"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#6D5EF5] px-4 text-sm font-semibold text-white shadow-md shadow-violet-500/25"
          >
            <Plus className="h-4 w-4" />
            New Lead
            <ChevronDown className="h-4 w-4 opacity-80" />
          </Link>
        </div>

        <section className="grid grid-cols-2 gap-2.5">
          {KPI_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.key}
                to={card.path}
                className={cn(
                  'relative overflow-hidden rounded-2xl border bg-gradient-to-br p-3 shadow-sm',
                  card.wrap,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', card.iconBg)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', card.arrow)}>
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
                <p className={cn('mt-3 text-[28px] font-black leading-none metric-tabular', card.valueClass)}>
                  {pad2(kpiValues[card.key])}
                </p>
                <p className="mt-1.5 text-[12px] font-bold text-slate-800">{card.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{card.hint}</p>
              </Link>
            );
          })}
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search by name, destination, phone, email..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-[13px] outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
              />
            </div>
            <button
              type="button"
              onClick={() => setMoreFiltersOpen((v) => !v)}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-sm',
                moreFiltersOpen
                  ? 'border-violet-300 bg-violet-50 text-violet-700'
                  : 'border-slate-200 bg-white text-slate-600',
              )}
              aria-label="Toggle filters"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>

          {moreFiltersOpen ? (
            <>
              {onPeriodSelect && (
                <PeriodPresetChips
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onSelect={onPeriodSelect}
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <FilterSelect
                  icon={MapPin}
                  value={destinationFilter}
                  onChange={onDestinationChange}
                >
                  <option value="">All Destinations</option>
                  {DESTINATIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </FilterSelect>
                <FilterSelect icon={MapPin} value={stateFilter} onChange={onStateChange}>
                  <option value="">All States</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </FilterSelect>
                <FilterSelect icon={List} value={statusFilter} onChange={onStatusChange}>
                  <option value="">Lead follow up</option>
                  {LEAD_FOLLOW_UP_OUTCOMES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </FilterSelect>
                <FilterSelect icon={Target} value={priorityFilter} onChange={onPriorityChange}>
                  {INTENT_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                  ))}
                </FilterSelect>
                <FilterSelect icon={Link2} value={sourceFilter} onChange={onSourceChange}>
                  {LEAD_SOURCE_FILTER_OPTIONS.map((o) => (
                    <option key={o.value || 'all'} value={o.value}>{o.label === 'All sources' ? 'All Sources' : o.label}</option>
                  ))}
                </FilterSelect>
                <FilterSelect icon={User} value="" onChange={() => {}}>
                  <option value="">All Executives</option>
                  <option value="me">{user?.name || 'Me'}</option>
                </FilterSelect>
                <FilterSelect icon={Calendar} value="" onChange={() => {}}>
                  <option value="">Any Date</option>
                </FilterSelect>
              </div>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setMoreFiltersOpen(true)}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-600"
                >
                  <Filter className="h-3.5 w-3.5" />
                  More Filters
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-[12px] font-bold text-violet-600"
                  >
                    Clear All
                  </button>
                ) : (
                  <span className="text-[12px] font-medium text-slate-400">Clear All</span>
                )}
              </div>
            </>
          ) : null}
        </section>

        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
          {TABS.map((tab) => {
            const isActive =
              tab.key === 'all'
                ? filter === 'all'
                : tab.key === 'all-mine'
                  ? false
                  : filter === tab.key;
            const count = tabCounts[tab.countKey] ?? 0;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => navigate(tab.path)}
                className={cn(
                  'relative shrink-0 px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap',
                  isActive ? 'text-[#6D5EF5]' : 'text-slate-500',
                )}
              >
                {tab.label} ({pad2(count)})
                {isActive ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#6D5EF5]" />
                ) : null}
              </button>
            );
          })}
        </div>

        <section className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              Loading leads…
            </div>
          ) : visibleLeads.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-700">No leads found</p>
              <p className="mt-1 text-xs text-slate-500">Try another filter or add a new lead</p>
            </div>
          ) : (
            visibleLeads.map((lead) => {
              const status = lead.status || 'new';
              const hot = isHot(lead);
              const due = isFollowUpDue(lead);
              const open = menuLeadId === lead._id;
              return (
                <article
                  key={lead._id}
                  className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => onOpenLead?.(lead)}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white', avatarTone(lead.name))}>
                      {initials(lead.name).slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-[15px] font-bold text-slate-900">{lead.name}</p>
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_PILL[status] || STATUS_PILL.new)}>
                              {titleCaseStatus(status)}
                            </span>
                          </div>
                          {lead.nextFollowUp ? (
                            <p className={cn(
                              'mt-0.5 flex items-center gap-1 truncate text-[11px]',
                              new Date(lead.nextFollowUp).getTime() < Date.now() ? 'text-rose-600' : 'text-slate-500'
                            )}>
                              <CalendarClock className="h-3 w-3 shrink-0" />
                              Next F/U · {formatDateTime(lead.nextFollowUp)}
                            </p>
                          ) : (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-400">
                              <CalendarClock className="h-3 w-3 shrink-0" />
                              No next follow-up
                            </p>
                          )}
                          <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-slate-500">
                            <MapPin className="h-3 w-3 shrink-0 text-violet-500" />
                            {lead.destination || '—'}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-slate-500">
                            <Phone className="h-3 w-3 shrink-0 text-violet-500" />
                            {lead.contactMasked ? 'XXXX' : (lead.phone || '—')}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[10px] leading-tight text-slate-500">
                            <span className="font-semibold text-slate-600">Created</span>
                            <br />
                            {formatDateTime(lead.createdAt)}
                          </p>
                          {lead.assignedAt ? (
                            <p className="mt-1 text-[10px] leading-tight text-slate-500">
                              <span className="font-semibold text-slate-600">Assigned</span>
                              <br />
                              {formatDateTime(lead.assignedAt)}
                            </p>
                          ) : null}
                          <div className="mt-1.5 flex flex-col items-end gap-1">
                            {hot ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                                <Flame className="h-3 w-3" /> Hot Lead
                              </span>
                            ) : null}
                            {due ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                                <CalendarClock className="h-3 w-3" /> Follow-up Due
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-label="More"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuLeadId(open ? null : lead._id);
                      onOpenMenu?.(lead);
                    }}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>

                  {open ? (
                    <div className="absolute right-2 top-10 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-violet-50"
                        onClick={() => {
                          setMenuLeadId(null);
                          onOpenLead?.(lead);
                        }}
                      >
                        View lead
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-end gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="min-w-0 flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Meal Plan</p>
                        <p className="mt-0.5 truncate text-[11px] font-bold text-slate-800">{formatMealPlan(lead)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Travelers</p>
                        <p className="mt-0.5 truncate text-[11px] font-bold text-slate-800">{formatTravelers(lead)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Source</p>
                        <div className="mt-0.5 truncate text-[11px] font-bold text-slate-800">
                          <SourceBadge
                            source={lead.source}
                            label={lead.sourceLabel}
                            sourceShort={lead.sourceShort}
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Call"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!lead.phone || lead.contactMasked) {
                          toast.error('Phone not available');
                          return;
                        }
                        beginLeadCall({ leadId: lead._id, leadName: lead.name, phone: lead.phone });
                      }}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-600 shadow-sm"
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
