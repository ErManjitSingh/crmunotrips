import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  MapPin,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  XCircle,
} from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';
import { formatCurrency } from './executiveUtils';
import { cn } from '../../lib/utils';

const HERO_IMG = '/quotations-hero-document-coin.png';

const KPI_CARDS = [
  {
    key: 'total',
    label: 'Total Quotations',
    hint: 'All time',
    image: '/quote-kpi-total.png',
    fallbackIcon: FileText,
    tone: 'from-violet-50 to-indigo-50 border-violet-100',
    valueClass: 'text-violet-700',
    hintClass: 'text-violet-500',
  },
  {
    key: 'sent',
    label: 'Sent',
    hint: 'Waiting for response',
    image: '/quote-kpi-sent.png',
    fallbackIcon: Send,
    tone: 'from-sky-50 to-cyan-50 border-sky-100',
    valueClass: 'text-sky-700',
    hintClass: 'text-sky-500',
  },
  {
    key: 'approved',
    label: 'Approved',
    hint: 'Ready to send',
    image: '/quote-kpi-approved.png',
    fallbackIcon: CheckCircle2,
    tone: 'from-emerald-50 to-teal-50 border-emerald-100',
    valueClass: 'text-emerald-700',
    hintClass: 'text-emerald-500',
  },
  {
    key: 'pending_approval',
    label: 'Pending Approval',
    hint: 'With team leader',
    image: '/quote-kpi-pending.png',
    fallbackIcon: Clock,
    tone: 'from-orange-50 to-amber-50 border-orange-100',
    valueClass: 'text-orange-700',
    hintClass: 'text-orange-500',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    hint: 'This month',
    image: '/quote-kpi-rejected.png',
    fallbackIcon: XCircle,
    tone: 'from-rose-50 to-red-50 border-rose-100',
    valueClass: 'text-rose-700',
    hintClass: 'text-rose-500',
  },
];

const MOBILE_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'pending_approval', label: 'Pending Approval' },
  { key: 'approved', label: 'Approved' },
];

const STATUS_PILL = {
  draft: {
    label: 'Draft',
    className: 'bg-slate-100 text-slate-600',
    icon: FileText,
  },
  pending_approval: {
    label: 'Pending Approval',
    className: 'bg-violet-100 text-violet-700',
    icon: Clock,
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-100 text-emerald-700',
    icon: CheckCircle2,
  },
  sent: {
    label: 'Sent',
    className: 'bg-sky-100 text-sky-700',
    icon: Send,
  },
  viewed: {
    label: 'Viewed',
    className: 'bg-sky-100 text-sky-700',
    icon: Send,
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-rose-100 text-rose-700',
    icon: XCircle,
  },
  negotiation: {
    label: 'Negotiation',
    className: 'bg-amber-100 text-amber-700',
    icon: Clock,
  },
};

const STATUS_ICON_TONE = {
  draft: 'bg-slate-100 text-slate-600',
  pending_approval: 'bg-violet-100 text-violet-600',
  approved: 'bg-emerald-100 text-emerald-600',
  sent: 'bg-sky-100 text-sky-600',
  viewed: 'bg-sky-100 text-sky-600',
  rejected: 'bg-rose-100 text-rose-600',
  negotiation: 'bg-amber-100 text-amber-600',
};

const AMOUNT_TONE = {
  draft: 'text-slate-700',
  pending_approval: 'text-violet-700',
  approved: 'text-emerald-700',
  sent: 'text-sky-700',
  viewed: 'text-sky-700',
  rejected: 'text-rose-700',
  negotiation: 'text-amber-700',
};

function formatShortDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatHeroDate() {
  return new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function quoteAmount(q) {
  return formatCurrency(q?.pricing?.total);
}

export default function MobileExecutiveQuotations({
  quotes = [],
  kpiCounts = {},
  statusTab = 'all',
  onStatusTabChange,
  search = '',
  onSearchChange,
  destination = '',
  destinations = [],
  onDestinationChange,
  onRefresh,
  onOpenQuote,
  loading = false,
  flash,
  onDismissFlash,
}) {
  const { toggleMobileOpen } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuId, setMenuId] = useState(null);

  const uniqueDestinations = useMemo(() => {
    if (destinations?.length) return destinations;
    const set = new Set();
    for (const q of quotes) {
      const d = q.lead?.destination || q.packageSnapshot?.destination;
      if (d) set.add(d);
    }
    return [...set].sort();
  }, [destinations, quotes]);

  return (
    <div className="min-h-full bg-[#f7f7fb] pb-28 lg:hidden">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleMobileOpen}
            aria-label="Open menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-bold tracking-tight text-slate-900">Quotations</h1>
            <p className="truncate text-[11px] text-slate-500">Manage and track all your quotations</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
            >
              <Search className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Refresh"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
            >
              <RefreshCw className="h-[18px] w-[18px]" />
            </button>
            <Link
              to="/sales-executive/quotations/new"
              aria-label="Create quotation"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6D5EF5] text-white shadow-md shadow-violet-500/35"
            >
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
        {searchOpen ? (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="search"
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search quote #, customer..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
            />
          </div>
        ) : null}
      </header>

      <main className="space-y-4 px-4 pt-4">
        {flash ? (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-[13px]">{flash}</p>
            <button type="button" className="text-xs font-semibold text-emerald-700" onClick={onDismissFlash}>
              Dismiss
            </button>
          </div>
        ) : null}

        {/* Hero banner */}
        <section className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#4B7CF5] via-[#5B5FEF] to-[#7B4FE0] px-4 py-4 shadow-lg shadow-indigo-500/25">
          <div className="pointer-events-none absolute -right-6 -top-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-sky-300/20 blur-2xl" />
          <div className="relative flex items-stretch gap-2">
            <div className="min-w-0 flex-1 space-y-3 py-0.5">
              <p className="text-[13px] font-medium leading-snug text-white/95">
                Your quotes — submitted to Team Leader for approval before sending to customers
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-violet-700 shadow-sm">
                  <CalendarDays className="h-3.5 w-3.5 text-violet-500" />
                  {formatHeroDate()}
                </span>
                <Link
                  to="/sales-executive/quotations/new"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-violet-700 shadow-sm"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-white">
                    <Plus className="h-3 w-3" strokeWidth={3} />
                  </span>
                  Create Quotation
                </Link>
              </div>
            </div>
            <div className="relative w-[112px] shrink-0 self-center sm:w-[128px]">
              <img
                src={HERO_IMG}
                alt=""
                className="h-[108px] w-full object-contain drop-shadow-xl sm:h-[120px]"
                loading="eager"
              />
            </div>
          </div>
        </section>

        {/* KPI cards */}
        <section className="space-y-2.5">
          {KPI_CARDS.map((card) => {
            const value = kpiCounts[card.key] ?? 0;
            const active =
              (card.key === 'total' && (statusTab === 'all' || !statusTab)) ||
              statusTab === card.key;
            const Icon = card.fallbackIcon;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => onStatusTabChange?.(card.key === 'total' ? 'all' : card.key)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border bg-gradient-to-r px-3 py-3 text-left shadow-sm transition',
                  card.tone,
                  active && 'ring-2 ring-violet-400/40',
                )}
              >
                <img
                  src={card.image}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl object-cover shadow-sm"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.classList.add('hidden');
                    const fallback = e.currentTarget.nextElementSibling;
                    if (fallback) {
                      fallback.classList.remove('hidden');
                      fallback.classList.add('flex');
                    }
                  }}
                />
                <span className={cn('hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm', card.valueClass)}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-[22px] font-black leading-none tracking-tight metric-tabular', card.valueClass)}>
                    {value}
                  </p>
                  <p className="mt-1 text-[13px] font-bold text-slate-800">{card.label}</p>
                  <p className={cn('mt-0.5 text-[11px] font-medium', card.hintClass)}>{card.hint}</p>
                </div>
                <ChevronRight className={cn('h-5 w-5 shrink-0 opacity-50', card.valueClass)} />
              </button>
            );
          })}
        </section>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 pb-px">
          {MOBILE_TABS.map((tab) => {
            const active = statusTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onStatusTabChange?.(tab.key)}
                className={cn(
                  'relative shrink-0 px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap',
                  active ? 'text-[#6D5EF5]' : 'text-slate-500',
                )}
              >
                {tab.label}
                {active ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#6D5EF5]" />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <select
              value={statusTab}
              onChange={(e) => onStatusTabChange?.(e.target.value)}
              className="h-10 appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-7 text-[11px] font-semibold text-slate-700 shadow-sm"
              aria-label="Status filter"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending</option>
              <option value="approved">Approved</option>
              <option value="sent">Sent</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search quote #, customer..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-[12px] outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"
            />
          </div>
          <div className="relative shrink-0 max-w-[38%]">
            <select
              value={destination}
              onChange={(e) => onDestinationChange?.(e.target.value)}
              className="h-10 w-full appearance-none truncate rounded-xl border border-slate-200 bg-white py-2 pl-2.5 pr-6 text-[11px] font-semibold text-slate-700 shadow-sm"
              aria-label="Destination filter"
            >
              <option value="">All destinations</option>
              {uniqueDestinations.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quote cards */}
        <section className="space-y-2.5">
          {loading ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
              Loading quotations…
            </div>
          ) : quotes.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-700">No quotations found</p>
              <p className="mt-1 text-xs text-slate-500">Try another filter or create a new quote</p>
              <Link
                to="/sales-executive/quotations/new"
                className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#6D5EF5] px-4 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" /> Create Quotation
              </Link>
            </div>
          ) : (
            quotes.map((q) => {
              const status = q.status || 'draft';
              const pill = STATUS_PILL[status] || STATUS_PILL.draft;
              const PillIcon = pill.icon;
              const customer = q.lead?.name || 'Customer';
              const destinationLabel =
                q.lead?.destination || q.packageSnapshot?.destination || '—';
              const open = menuId === q._id;

              return (
                <article
                  key={q._id}
                  className="relative rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => onOpenQuote?.(q)}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                        STATUS_ICON_TONE[status] || STATUS_ICON_TONE.draft,
                      )}
                    >
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-bold text-slate-900">
                            {q.quoteNumber || 'QT'}
                          </p>
                          <p className="mt-0.5 truncate text-[13px] font-semibold text-slate-800">
                            {customer}
                          </p>
                          <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-medium text-violet-600">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {destinationLabel}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[11px] text-slate-500">{formatShortDate(q.createdAt)}</p>
                          <p className={cn('mt-0.5 text-[14px] font-black metric-tabular', AMOUNT_TONE[status] || AMOUNT_TONE.draft)}>
                            {quoteAmount(q)}
                          </p>
                          <span
                            className={cn(
                              'mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                              pill.className,
                            )}
                          >
                            <PillIcon className="h-3 w-3" />
                            {pill.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="More actions"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuId(open ? null : q._id);
                    }}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                  {open ? (
                    <div className="absolute right-2 top-10 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-violet-50"
                        onClick={() => {
                          setMenuId(null);
                          onOpenQuote?.(q);
                        }}
                      >
                        View details
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
