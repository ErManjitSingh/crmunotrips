import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Flame,
  IndianRupee,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  UserCheck,
} from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';
import { DESTINATIONS, LEAD_STATUSES, BUDGET_FILTER_OPTIONS, formatLeadId } from './constants';
import { LEAD_SOURCE_FILTER_OPTIONS } from '../../lib/leadSourceLabels';
import TrackedCallButton from './TrackedCallButton';
import LeadCallStats from './LeadCallStats';

const STATUS_STYLES = {
  new: 'bg-violet-50 text-violet-600',
  contacted: 'bg-emerald-50 text-emerald-600',
  working_progress: 'bg-cyan-50 text-cyan-600',
  follow_up: 'bg-blue-50 text-blue-600',
  quotation_sent: 'bg-amber-50 text-amber-600',
  negotiation: 'bg-orange-50 text-orange-600',
  converted: 'bg-emerald-50 text-emerald-600',
  lost: 'bg-rose-50 text-rose-600',
};

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState(filters.search || '');
  const pageNumber = pagination.pageIndex + 1;
  const pageCount = total ? Math.max(1, Math.ceil(total / pagination.pageSize)) : null;

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
              onClick={() => setFiltersOpen((open) => !open)}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-[9px] font-semibold ${
                filtersOpen ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />Filters
            </button>
            <button type="button" onClick={() => updateAndApply({ status: '' })} className={`h-9 shrink-0 rounded-xl px-3 text-[9px] font-semibold ${!filters.status ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>All</button>
            <button type="button" onClick={() => updateAndApply({ status: 'new' })} className={`h-9 shrink-0 rounded-xl px-3 text-[9px] font-semibold ${filters.status === 'new' ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>New</button>
            <button type="button" onClick={() => updateAndApply({ status: 'follow_up' })} className={`h-9 shrink-0 rounded-xl px-3 text-[9px] font-semibold ${filters.status === 'follow_up' ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>Follow-up</button>
            <button type="button" onClick={() => updateAndApply({ status: 'converted' })} className={`h-9 shrink-0 rounded-xl px-3 text-[9px] font-semibold ${filters.status === 'converted' ? 'bg-violet-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>Converted</button>
          </div>

          {filtersOpen && (
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
              <select value={filters.status} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none">
                <option value="">All Statuses</option>
                {LEAD_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
              <select value={filters.source} onChange={(event) => onFiltersChange({ ...filters, source: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none">
                <option value="">All Sources</option>
                {LEAD_SOURCE_FILTER_OPTIONS.filter((source) => source.value).map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
              </select>
              <select value={filters.destination} onChange={(event) => onFiltersChange({ ...filters, destination: event.target.value })} className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[9px] text-slate-600 outline-none">
                <option value="">All Destinations</option>
                {DESTINATIONS.map((destination) => <option key={destination} value={destination}>{destination}</option>)}
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
              <div className="flex gap-1.5">
                <button type="button" onClick={() => onApplyFilters(filters)} className="h-9 flex-1 rounded-xl bg-violet-600 text-[9px] font-semibold text-white">Apply</button>
                <button type="button" onClick={() => { setSearch(''); onReset(); }} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500" aria-label="Reset filters"><Filter className="h-3.5 w-3.5" /></button>
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
              return (
                <article key={lead._id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                  <button type="button" onClick={() => onOpenLead(lead)} className="w-full p-3 text-left">
                    <div className="flex items-start gap-3">
                      <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white ${AVATAR_TONES[index % AVATAR_TONES.length]}`}>
                        {initials(lead.name)}
                        {lead.isHot && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-500 ring-2 ring-white"><Flame className="h-3 w-3" /></span>}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-900">{lead.name}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[7px] font-semibold ${STATUS_STYLES[lead.status] || 'bg-slate-100 text-slate-600'}`}>{titleCase(lead.status)}</span>
                        </div>
                        <p className="mt-0.5 text-[8px] font-medium text-violet-600">{lead.leadId || formatLeadId(lead._id)}</p>
                        <LeadCallStats lead={lead} compact className="mt-1.5" />
                        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5">
                          <p className="flex min-w-0 items-center gap-1 text-[8px] text-slate-500"><Phone className="h-3 w-3 shrink-0 text-blue-500" /><span className="truncate">{lead.phone || 'No phone'}</span></p>
                          <p className="flex min-w-0 items-center gap-1 text-[8px] text-slate-500"><MapPin className="h-3 w-3 shrink-0 text-orange-500" /><span className="truncate">{lead.destination || 'No destination'}</span></p>
                          <p className="flex min-w-0 items-center gap-1 text-[8px] text-slate-500"><IndianRupee className="h-3 w-3 shrink-0 text-emerald-500" /><span className="truncate">{formatCurrency(lead.budget)}</span></p>
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
                    <a href={whatsapp ? `https://wa.me/${whatsapp}` : undefined} target="_blank" rel="noreferrer" className="flex h-9 flex-1 items-center justify-center gap-1 border-r border-slate-100 text-[8px] font-semibold text-emerald-600"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>
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
  );
}
