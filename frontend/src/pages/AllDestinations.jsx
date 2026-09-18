import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Search, ArrowUpDown } from 'lucide-react';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import { useDashboardQuery } from '../features/dashboard/hooks/useDashboardQuery';

const COLUMNS = [
  { key: 'name', label: 'Destination', align: 'left' },
  { key: 'queries', label: 'Leads', align: 'right' },
  { key: 'percentage', label: 'Share', align: 'right' },
  { key: 'conversions', label: 'Conversions', align: 'right' },
  { key: 'conversionRate', label: 'Conv. Rate', align: 'right' },
];

// "Other"/"Others"/"Not specified" are the same missing-destination bucket under whichever
// label the backend chose for this call site (see destinationHierarchy.js's
// MISSING_DESTINATION_KEYS) — display-ordering/styling only, never used for filtering.
const isMissingDestination = (name) => /^(not specified|others?)$/i.test(String(name || '').trim());

/** Deterministic, professional accent per destination — same name always gets the same color,
 * regardless of sort order/filtering, so the palette reads as stable rather than random. */
const DESTINATION_ACCENTS = [
  { icon: 'text-blue-500', hoverBg: 'hover:bg-blue-50/50' },
  { icon: 'text-violet-500', hoverBg: 'hover:bg-violet-50/50' },
  { icon: 'text-teal-500', hoverBg: 'hover:bg-teal-50/50' },
  { icon: 'text-orange-500', hoverBg: 'hover:bg-orange-50/50' },
  { icon: 'text-pink-500', hoverBg: 'hover:bg-pink-50/50' },
  { icon: 'text-sky-500', hoverBg: 'hover:bg-sky-50/50' },
  { icon: 'text-amber-500', hoverBg: 'hover:bg-amber-50/50' },
  { icon: 'text-emerald-500', hoverBg: 'hover:bg-emerald-50/50' },
];
const NOT_SPECIFIED_ACCENT = { icon: 'text-slate-400', hoverBg: 'hover:bg-slate-50' };

function hashDestinationName(name) {
  let hash = 0;
  const str = String(name || '');
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDestinationAccent(name) {
  if (isMissingDestination(name)) return NOT_SPECIFIED_ACCENT;
  return DESTINATION_ACCENTS[hashDestinationName(name) % DESTINATION_ACCENTS.length];
}

/**
 * Complete Top Destinations breakdown — first-class Admin page (not a modal/drawer), fetching
 * the uncapped GET /dashboard/destinations endpoint (see dashboardService.buildAllDestinations).
 * No aggregation logic here or anywhere in this file — this is purely a filterable, sortable
 * presentation of what the backend already returns, plus a drill-down into the existing Admin
 * Leads Management page via the existing destinationNames → resolveDestinationGroupValues flow.
 */
export default function AllDestinations() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'queries', dir: 'desc' });

  // Period/source context — carried in via the URL from the Dashboard's "View all destinations"
  // link, and stays in the URL as the admin adjusts it here, so the page works the same on a
  // fresh load/refresh as it does when navigated to.
  const filters = useMemo(
    () => ({
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      source: searchParams.get('source') || '',
    }),
    [searchParams]
  );

  const handleFiltersChange = (next) => {
    const params = new URLSearchParams();
    if (next.dateFrom) params.set('dateFrom', next.dateFrom);
    if (next.dateTo) params.set('dateTo', next.dateTo);
    if (next.source) params.set('source', next.source);
    setSearchParams(params, { replace: true });
  };

  const { data, isLoading, isFetching } = useDashboardQuery('/dashboard/destinations', filters);

  const destinations = data?.destinations || [];
  const totalLeads = data?.totalLeads ?? 0;
  const periodLabel = data?.period?.label;

  const filtered = search.trim()
    ? destinations.filter((d) => d.name.toLowerCase().includes(search.trim().toLowerCase()))
    : destinations;

  // "Not specified" always sorts to the bottom, regardless of which column/direction is active
  // or whether it matches the current search — it isn't a geographic destination, it represents
  // missing data, so it never competes with real destinations for rank. Real destinations are
  // sorted normally among themselves.
  const sorted = useMemo(() => {
    const compare = (a, b) => {
      const dir = sort.dir === 'asc' ? 1 : -1;
      if (sort.key === 'name') return dir * String(a.name).localeCompare(String(b.name));
      return dir * ((Number(a[sort.key]) || 0) - (Number(b[sort.key]) || 0));
    };
    const real = filtered.filter((d) => !isMissingDestination(d.name)).sort(compare);
    const missing = filtered.filter((d) => isMissingDestination(d.name));
    return [...real, ...missing];
  }, [filtered, sort]);

  const toggleSort = (key) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }
    );
  };

  // Same drill-down mechanism the Leads List already supports (buildLeadListFilter's
  // `destinationNames` param, resolved via resolveDestinationGroupValues) — opens the real Admin
  // Leads Management page with its own filters/KPIs/pagination, carrying this page's CURRENT
  // period/source context (not whatever the Dashboard originally had, if it's since changed here).
  const goToLeads = (name) => {
    const params = new URLSearchParams();
    params.set('destinationNames', name);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.source) params.set('source', filters.source);
    navigate(`/leads?${params.toString()}`);
  };

  const loading = isLoading && !data;

  return (
    <div className="animate-fade-up">
      <Link
        to="/admin/dashboard"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <DashboardHeader
        filters={filters}
        onFiltersChange={handleFiltersChange}
        badgeLabel="Destinations"
        title="All Destinations"
        subtitle="Complete destination-level breakdown for the selected period"
        periodLabel={periodLabel}
      />

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          {loading
            ? 'Loading…'
            : `${sorted.length.toLocaleString('en-IN')} of ${destinations.length.toLocaleString('en-IN')} destinations · ${totalLeads.toLocaleString('en-IN')} leads total`}
        </p>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search destination…"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
          />
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-subtle bg-white shadow-sm">
        {loading ? (
          <div className="space-y-2 p-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-elevated" />
            ))}
          </div>
        ) : !sorted.length ? (
          <div className="flex h-48 flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-content-muted">
              {search ? 'No destinations match your search' : 'No destinations in this period'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-elevated/60">
                <tr className="border-b border-subtle text-left text-[11px] font-semibold uppercase tracking-wide text-content-muted">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`px-5 py-3 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={`inline-flex items-center gap-1 hover:text-content-primary ${col.align === 'right' ? 'flex-row-reverse' : ''}`}
                      >
                        {col.label}
                        <ArrowUpDown className={`h-3 w-3 ${sort.key === col.key ? 'text-violet-600' : 'text-content-muted/50'}`} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => {
                  const accent = getDestinationAccent(row.name);
                  const missing = isMissingDestination(row.name);
                  const hasConversions = Number(row.conversions || 0) > 0;
                  return (
                    <tr
                      key={row.name}
                      className={`cursor-pointer border-b border-subtle/60 last:border-0 transition-colors ${accent.hoverBg}`}
                      onClick={() => goToLeads(row.name)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          goToLeads(row.name);
                        }
                      }}
                    >
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-2 font-medium ${missing ? 'text-content-muted' : 'text-content-primary'}`}
                        >
                          <MapPin className={`h-3.5 w-3.5 shrink-0 ${accent.icon}`} />
                          {row.name}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-[15px] font-bold tabular-nums text-content-primary">
                        {Number(row.queries || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-content-muted">
                        {row.percentage ?? 0}%
                      </td>
                      <td
                        className={`px-5 py-3 text-right tabular-nums ${hasConversions ? 'font-semibold text-emerald-600' : 'text-content-muted'}`}
                      >
                        {Number(row.conversions || 0).toLocaleString('en-IN')}
                      </td>
                      <td
                        className={`px-5 py-3 text-right tabular-nums ${hasConversions ? 'font-semibold text-emerald-600' : 'text-content-muted'}`}
                      >
                        {row.conversionRate ?? 0}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
