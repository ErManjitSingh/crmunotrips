import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Flame,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  UtensilsCrossed,
  Plus,
  Search,
  SlidersHorizontal,
  UserCheck,
  RotateCcw,
} from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import { toast } from '../../context/ToastContext';
import { openCrmWhatsApp } from '../../lib/openCrmWhatsApp';
import {
  DESTINATIONS,
  LEAD_STATUSES,
  BUDGET_FILTER_OPTIONS,
  TRAVEL_MONTHS,
  PRIORITY_FILTER_OPTIONS,
  formatLeadId,
} from './constants';
import { INDIAN_STATES } from '../lead-wizard/constants';
import { LEAD_SOURCE_FILTER_OPTIONS } from '../../lib/leadSourceLabels';
import TrackedCallButton from './TrackedCallButton';
import LeadCallStats from './LeadCallStats';
import { LeadTimingLines, NextFollowUpLine, LeadListStatusIcon } from '../sales-manager/LeadListBadges';
import { getLeadListStatusDisplay, LIST_STATUS_FILTERS, listStatusTextClass } from '../../lib/executiveStatusDisplay';
import { TooltipProvider } from '../ui/tooltip';
import PeriodPresetChips from '../ui/PeriodPresetChips';
import { applyPeriodPreset } from '../../lib/periodFilters';
import API from '../../api/axios';
import { cn } from '../../lib/utils';

const AVATAR_TONES = [
  'from-violet-500 to-indigo-600',
  'from-emerald-400 to-teal-600',
  'from-orange-400 to-rose-500',
  'from-pink-500 to-fuchsia-600',
  'from-blue-400 to-indigo-600',
];

function initials(name) {
  return String(name || 'Lead')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function titleCase(value) {
  return String(value || 'New')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  if (!amount) return 'Budget pending';
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export default function MobileLeadList({
  title,
  subtitle,
  leads,
  total,
  loading,
  filters,
  onFiltersChange,
  onApplyFilters,
  onReset,
  onOpenLead,
  pagination,
  hasMore,
}) {
  const { toggleMobileOpen } = useSidebar();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { availableBranches = [] } = useSelector((s) => s.branch);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [search, setSearch] = useState(filters.search || '');
  const [executives, setExecutives] = useState([]);
  const [teams, setTeams] = useState([]);
  const moreFiltersRef = useRef(null);
  const canFilterBranch = ['admin', 'lead_provider', 'hr_admin'].includes(user?.role);
  const pageNumber = pagination.pageIndex + 1;
  const pageCount = total ? Math.max(1, Math.ceil(total / pagination.pageSize)) : null;

  useEffect(() => {
    API.get('/sales-manager/executives', { skipSuccessToast: true, skipErrorToast: true })
      .then((res) => setExecutives(Array.isArray(res.data) ? res.data : []))
      .catch(() => setExecutives([]));
    API.get('/teams', { skipSuccessToast: true, skipErrorToast: true })
      .then((res) => setTeams(Array.isArray(res.data) ? res.data : []))
      .catch(() => setTeams([]));
  }, []);

  const updateAndApply = (patch) => {
    const next = { ...filters, ...patch };
    onFiltersChange(next);
    onApplyFilters(next);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    updateAndApply({ search });
  };

  return (
    <TooltipProvider delayDuration={150}>
    <div className="min-h-full bg-[#f7f7fb] pb-5 lg:hidden">
      <header className="relative min-h-[160px] overflow-hidden rounded-b-[24px] bg-gradient-to-br from-[#080b4d] via-[#221173] to-[#5723a7] px-5 pt-5 text-white">
        <div className="absolute -right-10 -top-16 h-52 w-52 rounded-full bg-violet-400/25 blur-3xl" />
        <div className="relative flex items-center justify-between">
          <button type="button" onClick={toggleMobileOpen} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
          <h1 className="text-[15px] font-bold">Lead Management</h1>
          <button type="button" className="relative" aria-label="Notifications"><Bell className="h-5 w-5" /></button>
        </div>
        <div className="relative mt-6 flex items-end justify-between">
          <div>
            <h2 className="text-[19px] font-bold">{title || 'All Leads'}</h2>
            <p className="mt-1 text-[10px] text-white/70">{subtitle || 'Manage every customer inquiry in one place'}</p>
            <p className="mt-2 text-[11px] font-semibold text-violet-100">{total ?? leads.length} total leads</p>
          </div>
          <Link to="/leads/new" className="flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-[10px] font-bold text-violet-700 shadow-lg">
            <Plus className="h-4 w-4" />Add Lead
          </Link>
        </div>
      </header>

      <main className="-mt-5 space-y-3 px-5">
        <section className="relative z-10 rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_10px_30px_rgba(32,25,92,0.14)]">
          <form onSubmit={submitSearch} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone, email, lead ID..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-12 text-[10px] outline-none focus:border-violet-400"
            />
            <button type="submit" className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white" aria-label="Search">
              <ChevronRight className="h-4 w-4" />
            </button>
          </form>
          <div className="mt-2 flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => {
                const next = !filtersOpen;
                setFiltersOpen(next);
                if (next) {
                  requestAnimationFrame(() => {
                    moreFiltersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  });
                }
              }}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[9px] font-semibold ${
                filtersOpen ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
            </button>
            <button type="button" onClick={() => updateAndApply({ status: '', filter: '', listStatus: '' })} className={`h-9 shrink-0 rounded-xl px-3 text-[9px] font-semibold ${!filters.status && filters.filter !== 'arrivals' && !filters.listStatus ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>All</button>
            <button type="button" onClick={() => updateAndApply({ status: 'converted', filter: '', listStatus: '' })} className={`h-9 shrink-0 rounded-xl px-3 text-[9px] font-semibold ${filters.status === 'converted' && filters.filter !== 'arrivals' && !filters.listStatus ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>Booking</button>
            <button type="button" onClick={() => updateAndApply({ status: 'converted', filter: 'arrivals', listStatus: '' })} className={`h-9 shrink-0 rounded-xl px-3 text-[9px] font-semibold ${filters.filter === 'arrivals' ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>Arrivals</button>
            {LIST_STATUS_FILTERS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() =>
                  updateAndApply(
                    filters.listStatus === chip.value
                      ? { listStatus: '' }
                      : { listStatus: chip.value, status: '', filter: '' }
                  )
                }
                className={`h-9 shrink-0 rounded-xl px-3 text-[9px] font-semibold ${
                  filters.listStatus === chip.value ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <PeriodPresetChips
            className="mt-2"
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onSelect={(key) => updateAndApply(applyPeriodPreset(key))}
          />

          {filtersOpen && (
            <div ref={moreFiltersRef} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={filters.dateFrom || ''} onChange={(event) => onFiltersChange({ ...filters, dateFrom: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none" title="Date From" />
                <input type="date" value={filters.dateTo || ''} onChange={(event) => onFiltersChange({ ...filters, dateTo: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none" title="Date To" />
                <select value={filters.source} onChange={(event) => onFiltersChange({ ...filters, source: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none">
                  <option value="">Source</option>
                  {LEAD_SOURCE_FILTER_OPTIONS.filter((source) => source.value).map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
                </select>
                <select value={filters.destination} onChange={(event) => onFiltersChange({ ...filters, destination: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none">
                  <option value="">Destination</option>
                  {DESTINATIONS.map((destination) => <option key={destination} value={destination}>{destination}</option>)}
                </select>
                <select value={filters.agent || ''} onChange={(event) => onFiltersChange({ ...filters, agent: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none">
                  <option value="">Executive</option>
                  {executives.map((ex) => <option key={ex._id} value={ex._id}>{ex.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowMoreFilters((v) => !v)}
                  className={`inline-flex h-9 items-center justify-center gap-1 rounded-xl border px-2 text-[9px] font-semibold ${
                    showMoreFilters ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  More
                  <ChevronDown className={`h-3 w-3 transition-transform ${showMoreFilters ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showMoreFilters && (
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-violet-100 bg-violet-50/40 p-2">
                  <select
                    value={filters.listStatus || ''}
                    onChange={(event) =>
                      onFiltersChange({
                        ...filters,
                        listStatus: event.target.value,
                        status: '',
                        filter: '',
                      })
                    }
                    className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none"
                  >
                    <option value="">Lead Status</option>
                    {LEAD_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>{status.label}</option>
                    ))}
                  </select>
                  {canFilterBranch && (
                    <select value={filters.branchId || ''} onChange={(event) => onFiltersChange({ ...filters, branchId: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none">
                      <option value="">Branch</option>
                      {availableBranches.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                  )}
                  <select value={filters.teamId || ''} onChange={(event) => onFiltersChange({ ...filters, teamId: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none">
                    <option value="">Team</option>
                    {teams.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                  </select>
                  <select value={filters.state || ''} onChange={(event) => onFiltersChange({ ...filters, state: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none">
                    <option value="">State</option>
                    {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={filters.priority || ''} onChange={(event) => onFiltersChange({ ...filters, priority: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none">
                    {PRIORITY_FILTER_OPTIONS.map((p) => <option key={p.value || 'all'} value={p.value}>{p.label}</option>)}
                  </select>
                  <select
                    value={filters.budgetRange || ''}
                    onChange={(event) => {
                      const opt = BUDGET_FILTER_OPTIONS.find((o) => o.value === event.target.value);
                      onFiltersChange({
                        ...filters,
                        budgetRange: event.target.value,
                        budgetMin: opt?.min ?? '',
                        budgetMax: opt?.max ?? '',
                      });
                    }}
                    className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none"
                  >
                    {BUDGET_FILTER_OPTIONS.map((b) => (
                      <option key={b.value || 'all'} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                  <select value={filters.travelMonth} onChange={(event) => onFiltersChange({ ...filters, travelMonth: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none">
                    <option value="">Travel Month</option>
                    {TRAVEL_MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-1.5">
                <button type="button" onClick={() => onApplyFilters(filters)} className="h-9 flex-1 rounded-xl bg-violet-600 text-[9px] font-semibold text-white">Apply</button>
                <button type="button" onClick={() => { setSearch(''); onReset(); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500" aria-label="Reset filters"><RotateCcw className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          )}
        </section>

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-[132px] animate-pulse rounded-2xl bg-white" />)}
          </div>
        ) : (
          <div className="space-y-2.5">
            {leads.map((lead, index) => {
              const phoneDigits = String(lead.phone || '').replace(/\D/g, '');
              const whatsapp = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
              const statusDisplay = getLeadListStatusDisplay(lead);
              const isLost = statusDisplay.bucket === 'lost';
              const cardTone =
                lead.status === 'converted'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-slate-100 bg-white';
              return (
                <article key={lead._id} className={cn('overflow-hidden rounded-2xl border shadow-sm', cardTone)}>
                  <button type="button" onClick={() => onOpenLead(lead)} className="w-full p-3 text-left">
                    <div className="flex items-start gap-3">
                      <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white ${AVATAR_TONES[index % AVATAR_TONES.length]}`}>
                        {initials(lead.name)}
                        {lead.isHot && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-500 ring-2 ring-white"><Flame className="h-3 w-3" /></span>}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3
                            className={cn(
                              'min-w-0 flex-1 break-words text-[12px] font-bold text-slate-900',
                              isLost && 'rounded-md bg-red-100 px-2 py-0.5 ring-1 ring-inset ring-red-300',
                              lead.status === 'converted' && 'rounded-md bg-emerald-100 px-2 py-0.5 ring-1 ring-inset ring-emerald-300'
                            )}
                          >
                            {lead.name}
                          </h3>
                          <span
                            className={`max-w-[120px] truncate rounded-full px-2 py-0.5 text-[7px] font-semibold ring-1 ring-inset ${statusDisplay.className}`}
                            title={statusDisplay.title}
                          >
                            <span className={listStatusTextClass(statusDisplay)}>{statusDisplay.label}</span>
                          </span>
                        </div>
                        <NextFollowUpLine lead={lead} className="!text-[9px] mt-0.5" />
                        <p className="mt-0.5 text-[8px] font-medium text-violet-600">{lead.leadId || formatLeadId(lead._id)}</p>
                        <LeadListStatusIcon lead={lead} className="mt-0.5" />
                        <LeadTimingLines lead={lead} className="!text-[9px] mt-1" />
                        <LeadCallStats lead={lead} compact className="mt-1.5" />
                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5">
                          <p className="flex min-w-0 items-center gap-1 text-[8px] text-slate-500"><Phone className="h-3 w-3 shrink-0 text-blue-500" /><span className="truncate">{lead.phone || 'No phone'}</span></p>
                          <p className="flex min-w-0 items-center gap-1 text-[8px] text-slate-500"><MapPin className="h-3 w-3 shrink-0 text-orange-500" /><span className="truncate">{lead.destination || 'No destination'}</span></p>
                          <p className="flex min-w-0 items-center gap-1 text-[8px] text-slate-500"><UtensilsCrossed className="h-3 w-3 shrink-0 text-amber-500" /><span className="truncate">{String(lead.mealPlan || lead.mealPreference || 'map').toUpperCase()}</span></p>
                          <p className="flex min-w-0 items-center gap-1 text-[8px] text-slate-500"><UserCheck className="h-3 w-3 shrink-0 text-violet-500" /><span className="truncate">{lead.assignedTo?.name || 'Unassigned'}</span></p>
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
                    </div>
                  </button>
                  <div className="flex border-t border-slate-100">
                    <TrackedCallButton
                      lead={lead}
                      className="flex h-9 flex-1 items-center justify-center gap-1 border-r border-slate-100 text-[8px] font-semibold text-blue-600"
                    />
                    <button
                      type="button"
                      disabled={!whatsapp}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!whatsapp || !lead._id) return;
                        openCrmWhatsApp({
                          leadId: lead._id,
                          phone: lead.phone || lead.whatsapp,
                          navigate,
                          role: user?.role,
                          toast,
                        });
                      }}
                      className="flex h-9 flex-1 items-center justify-center gap-1 border-r border-slate-100 text-[8px] font-semibold text-emerald-600 disabled:opacity-40"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                    </button>
                    <button type="button" onClick={() => onOpenLead(lead)} className="flex h-9 flex-1 items-center justify-center gap-1 text-[8px] font-semibold text-violet-600">View Details<ChevronRight className="h-3.5 w-3.5" /></button>
                  </div>
                </article>
              );
            })}
            {!leads.length && <div className="rounded-2xl border border-slate-100 bg-white px-5 py-12 text-center text-xs text-slate-400">No leads found for these filters.</div>}
          </div>
        )}

        <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
          <button
            type="button"
            disabled={pagination.pageIndex === 0}
            onClick={() => pagination.onPageChange(pagination.pageIndex - 1)}
            className="flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-[9px] font-semibold text-slate-600 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />Previous
          </button>
          <span className="text-[9px] font-semibold text-slate-500">Page {pageNumber}{pageCount ? ` of ${pageCount}` : ''}</span>
          <button
            type="button"
            disabled={pageCount ? pageNumber >= pageCount : !hasMore}
            onClick={() => pagination.onPageChange(pagination.pageIndex + 1)}
            className="flex h-9 items-center gap-1 rounded-xl bg-violet-600 px-3 text-[9px] font-semibold text-white disabled:opacity-40"
          >
            Next<ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </main>
    </div>
    </TooltipProvider>
  );
}
