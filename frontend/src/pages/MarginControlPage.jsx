import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Search,
  Info,
  MapPin,
  ShieldCheck,
  Pencil,
  BarChart3,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  TrendingUp,
  Eye,
  Play,
  Check,
  HardDrive,
} from 'lucide-react';
import API from '../api/axios';
import { Button } from '../components/ui/button';
import Switch from '../components/ui/switch';
import { toast } from '../context/ToastContext';
import { useDataRefresh } from '../hooks/useDataRefresh';
import { cn } from '../lib/utils';

const PREVIEW_BASE = 10000;

const DEST_META = {
  andamanandnicobar: {
    country: 'India',
    image:
      'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=120&h=120&fit=crop&q=80',
  },
  andaman: {
    country: 'India',
    image:
      'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=120&h=120&fit=crop&q=80',
  },
  dubai: {
    country: 'UAE',
    image:
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=120&h=120&fit=crop&q=80',
  },
  goa: {
    country: 'India',
    image:
      'https://images.unsplash.com/photo-1512343879784-a9609093eab0?w=120&h=120&fit=crop&q=80',
  },
  himachalpradesh: {
    country: 'India',
    image:
      'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=120&h=120&fit=crop&q=80',
  },
  thailand: {
    country: 'Thailand',
    image:
      'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=120&h=120&fit=crop&q=80',
  },
  kerala: {
    country: 'India',
    image:
      'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=120&h=120&fit=crop&q=80',
  },
  jammuandkashmir: {
    country: 'India',
    image:
      'https://images.unsplash.com/photo-1595815771614-ade9d652a65d?w=120&h=120&fit=crop&q=80',
  },
  kashmir: {
    country: 'India',
    image:
      'https://images.unsplash.com/photo-1595815771614-ade9d652a65d?w=120&h=120&fit=crop&q=80',
  },
  ladakh: {
    country: 'India',
    image:
      'https://images.unsplash.com/photo-1589818862057-289763182eee?w=120&h=120&fit=crop&q=80',
  },
  maldives: {
    country: 'Maldives',
    image:
      'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=120&h=120&fit=crop&q=80',
  },
  singapore: {
    country: 'Singapore',
    image:
      'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=120&h=120&fit=crop&q=80',
  },
  bali: {
    country: 'Indonesia',
    image:
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=120&h=120&fit=crop&q=80',
  },
  rajasthan: {
    country: 'India',
    image:
      'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=120&h=120&fit=crop&q=80',
  },
  sikkim: {
    country: 'India',
    image:
      'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=120&h=120&fit=crop&q=80',
  },
  uttarakhand: {
    country: 'India',
    image:
      'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=120&h=120&fit=crop&q=80',
  },
  meghalaya: {
    country: 'India',
    image:
      'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=120&h=120&fit=crop&q=80',
  },
};

const AVATAR_TONES = [
  'from-violet-500 to-fuchsia-500',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-violet-600',
];

function normalizeKey(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getDestMeta(name = '') {
  const key = normalizeKey(name);
  if (DEST_META[key]) return DEST_META[key];
  for (const [k, meta] of Object.entries(DEST_META)) {
    if (key.includes(k) || k.includes(key)) return meta;
  }
  return { country: 'Destination', image: null };
}

function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function previewUplift(base, percent) {
  const pct = Number(percent) || 0;
  const amount = Number(base) || 0;
  return Math.round(amount * (1 + pct / 100));
}

function formatLastUpdated(date) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

function MarginIllustration() {
  return (
    <div className="pointer-events-none relative hidden h-28 w-40 shrink-0 md:block lg:h-32 lg:w-48">
      <svg viewBox="0 0 192 128" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="mc-mtn-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="mc-mtn-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="mc-pct" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ddd6fe" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <filter id="mc-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#7c3aed" floodOpacity="0.35" />
          </filter>
        </defs>
        <ellipse cx="96" cy="112" rx="70" ry="10" fill="#ede9fe" />
        <path d="M18 108 L58 42 L78 72 L98 28 L142 108 Z" fill="url(#mc-mtn-a)" opacity="0.95" />
        <path d="M70 108 L110 48 L128 78 L148 38 L178 108 Z" fill="url(#mc-mtn-b)" opacity="0.9" />
        <path d="M58 42 L68 58 L78 72 L70 72 Z" fill="#ede9fe" opacity="0.85" />
        <path d="M148 38 L156 52 L168 72 L158 72 Z" fill="#f5f3ff" opacity="0.8" />
        <g filter="url(#mc-shadow)" transform="translate(118 18)">
          <circle cx="28" cy="28" r="26" fill="url(#mc-pct)" />
          <text
            x="28"
            y="34"
            textAnchor="middle"
            fontSize="22"
            fontWeight="800"
            fill="white"
            fontFamily="system-ui,sans-serif"
          >
            %
          </text>
        </g>
      </svg>
    </div>
  );
}

function DestAvatar({ name, index }) {
  const [imgFailed, setImgFailed] = useState(false);
  const meta = getDestMeta(name);
  const tone = AVATAR_TONES[index % AVATAR_TONES.length];
  const initial = String(name || '?').charAt(0).toUpperCase();

  if (meta.image && !imgFailed) {
    return (
      <img
        src={meta.image}
        alt=""
        className="h-10 w-10 rounded-xl object-cover shadow-sm ring-1 ring-black/5"
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-sm',
        tone
      )}
    >
      {initial}
    </span>
  );
}

function KpiCard({ label, value, hint, icon: Icon, gradient, className }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-4 text-white shadow-lg',
        gradient,
        className
      )}
    >
      <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-6 right-6 h-16 w-16 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/80">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-white/75">{hint}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export default function MarginControlPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [marginFilter, setMarginFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [dirtyIds, setDirtyIds] = useState(() => new Set());
  const [focusedId, setFocusedId] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await API.get('/margin-control', { skipSuccessToast: true });
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      const next = {};
      list.forEach((row) => {
        next[String(row.destinationId)] = {
          marginPercent: String(row.marginPercent ?? 0),
          notes: row.notes || '',
          active: row.active !== false,
        };
      });
      setDrafts(next);
      setDirtyIds(new Set());
    } catch {
      setRows([]);
      toast.error('Failed to load state margins');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useDataRefresh(['packages', 'destinations'], load);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const id = String(row.destinationId);
      const draft = drafts[id] || { marginPercent: '0', active: true };
      const pct = Number(draft.marginPercent) || 0;
      const active = draft.active !== false;

      if (statusFilter === 'active' && !active) return false;
      if (statusFilter === 'inactive' && active) return false;
      if (marginFilter === 'with' && pct <= 0) return false;
      if (marginFilter === 'zero' && pct > 0) return false;

      if (!q) return true;
      const hay = `${row.destinationName || row.stateName} ${(row.aliases || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, drafts, statusFilter, marginFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, marginFilter, pageSize]);

  const dirtyCount = dirtyIds.size;
  const activeMarginCount = rows.filter((r) => {
    const d = drafts[String(r.destinationId)];
    const pct = Number(d?.marginPercent ?? r.marginPercent) || 0;
    const active = (d?.active ?? r.active) !== false;
    return pct > 0 && active;
  }).length;

  const averageMargin = useMemo(() => {
    if (!rows.length) return 0;
    const vals = rows.map((r) => {
      const d = drafts[String(r.destinationId)];
      return Number(d?.marginPercent ?? r.marginPercent) || 0;
    });
    const sum = vals.reduce((a, b) => a + b, 0);
    return Math.round((sum / vals.length) * 10) / 10;
  }, [rows, drafts]);

  const lastUpdated = useMemo(() => {
    const times = rows.map((r) => r.updatedAt).filter(Boolean).map((t) => new Date(t).getTime());
    if (!times.length) return null;
    return new Date(Math.max(...times));
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(pageStart, pageStart + pageSize);
  const showingFrom = filtered.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + pageSize, filtered.length);

  const updateDraft = (destinationId, patch) => {
    const id = String(destinationId);
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
    setDirtyIds((prev) => new Set(prev).add(id));
  };

  const bumpMargin = (destinationId, delta) => {
    const id = String(destinationId);
    const current = Number(drafts[id]?.marginPercent) || 0;
    const next = Math.max(0, Math.min(500, Math.round((current + delta) * 10) / 10));
    updateDraft(id, { marginPercent: String(next) });
  };

  const saveAll = async () => {
    const items = [...dirtyIds].map((id) => {
      const draft = drafts[id] || {};
      return {
        destinationId: id,
        marginPercent: Number(draft.marginPercent) || 0,
        notes: draft.notes || '',
        active: draft.active !== false,
      };
    });
    if (!items.length) {
      toast.info('No changes to save');
      return;
    }
    setSaving(true);
    try {
      await API.put('/margin-control/bulk', { items }, { skipSuccessToast: true });
      toast.success(`Saved margins for ${items.length} state${items.length === 1 ? '' : 's'}`);
      await load();
    } catch {
      toast.error('Failed to save margins');
    } finally {
      setSaving(false);
      setBulkOpen(false);
    }
  };

  const saveOne = async (destinationId) => {
    const id = String(destinationId);
    const draft = drafts[id] || {};
    setSaving(true);
    try {
      await API.put(
        `/margin-control/${id}`,
        {
          marginPercent: Number(draft.marginPercent) || 0,
          notes: draft.notes || '',
          active: draft.active !== false,
        },
        { skipSuccessToast: true }
      );
      toast.success('Margin saved');
      await load();
    } catch {
      toast.error('Failed to save margin');
    } finally {
      setSaving(false);
    }
  };

  const resetDirty = () => {
    const next = {};
    rows.forEach((row) => {
      next[String(row.destinationId)] = {
        marginPercent: String(row.marginPercent ?? 0),
        notes: row.notes || '',
        active: row.active !== false,
      };
    });
    setDrafts(next);
    setDirtyIds(new Set());
    setBulkOpen(false);
    toast.info('Discarded unsaved changes');
  };

  const pageNumbers = useMemo(() => {
    const max = Math.min(totalPages, 5);
    const start = Math.max(1, Math.min(safePage - 2, totalPages - max + 1));
    return Array.from({ length: max }, (_, i) => start + i).filter((n) => n >= 1 && n <= totalPages);
  }, [safePage, totalPages]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-violet-100/80 bg-gradient-to-br from-white via-violet-50/40 to-indigo-50/50 p-5 shadow-sm dark:border-violet-900/40 dark:from-slate-950 dark:via-violet-950/20 dark:to-slate-950 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-violet-400/10 blur-3xl" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-content-primary sm:text-3xl">
                Margin Control
              </h1>
              <Sparkles className="h-5 w-5 text-violet-500" />
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <p className="mt-1.5 max-w-xl text-sm text-content-secondary">
              Set state-wise package margin. Related packages auto-match by state name or city
              alias (e.g. Manali → Himachal Pradesh) and get this % added to cost.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-slate-200 bg-white shadow-sm"
                onClick={load}
                disabled={loading || saving}
              >
                <RefreshCw className={cn('mr-1.5 h-4 w-4', loading && 'animate-spin')} />
                Refresh
              </Button>
              <Button
                type="button"
                className="h-10 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-white shadow-md shadow-violet-500/25 hover:from-violet-500 hover:to-indigo-500"
                onClick={saveAll}
                disabled={saving || dirtyCount === 0}
              >
                <HardDrive className="mr-1.5 h-4 w-4" />
                Save All Changes{dirtyCount ? ` (${dirtyCount})` : ''}
              </Button>
            </div>
            <p className="mt-2 text-xs text-content-muted">
              Last updated: {formatLastUpdated(lastUpdated)}
            </p>
          </div>
          <MarginIllustration />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total States"
          value={rows.length}
          hint="Margin States"
          icon={MapPin}
          gradient="bg-gradient-to-br from-violet-500 to-purple-700 shadow-violet-500/25"
        />
        <KpiCard
          label="Active Margins"
          value={activeMarginCount}
          hint="Currently Active"
          icon={ShieldCheck}
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25"
        />
        <KpiCard
          label="Unsaved Changes"
          value={dirtyCount}
          hint="Pending to Save"
          icon={Pencil}
          gradient="bg-gradient-to-br from-orange-500 to-amber-600 shadow-orange-500/25"
        />
        <KpiCard
          label="Average Margin %"
          value={`${averageMargin}%`}
          hint="Across All States"
          icon={BarChart3}
          gradient="bg-gradient-to-br from-sky-500 to-blue-600 shadow-sky-500/25"
          className="sm:col-span-2 xl:col-span-1"
        />
      </div>

      {/* Info banner */}
      <div className="flex flex-col gap-3 rounded-2xl border border-sky-200/80 bg-sky-50/90 px-4 py-3.5 dark:border-sky-900 dark:bg-sky-950/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5 text-sm text-sky-950 dark:text-sky-100">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
            <Info className="h-3.5 w-3.5" />
          </span>
          <p>
            Example: Goa margin <span className="font-semibold">10%</span> → a package listed at{' '}
            <span className="font-semibold">{formatINR(PREVIEW_BASE)}</span> becomes{' '}
            <span className="font-semibold">{formatINR(11000)}</span> in catalog and quotation costing.
            Margins are state-wise — packages auto-match via state name or city alias (e.g. Manali →
            Himachal Pradesh).
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 rounded-xl border-sky-300 bg-white text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200"
          onClick={() => setShowHowItWorks((v) => !v)}
        >
          <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
          How it works?
        </Button>
      </div>

      {showHowItWorks && (
        <div className="rounded-2xl border border-violet-100 bg-white p-4 text-sm text-content-secondary shadow-sm dark:border-violet-900/50 dark:bg-slate-950">
          <p className="font-semibold text-content-primary">How state margin works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Set a margin % for each state (e.g. Goa = 10%). Cities are not listed here.</li>
            <li>
              Packages whose destination matches the state name or a city alias get the %
              automatically (Manali → Himachal Pradesh).
            </li>
            <li>Preview uses a base of {formatINR(PREVIEW_BASE)} so you can see uplift instantly.</li>
            <li>Toggle Active off to pause a margin without deleting the value.</li>
          </ol>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-subtle bg-surface p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search state..."
              className="h-10 w-full rounded-xl border border-subtle bg-white pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:bg-slate-950"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 appearance-none rounded-xl border border-subtle bg-white py-2 pl-3 pr-9 text-sm outline-none focus:border-violet-400 dark:bg-slate-950"
            >
              <option value="all">Status: All States</option>
              <option value="active">Status: Active</option>
              <option value="inactive">Status: Inactive</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-muted" />
          </div>
          <div className="relative">
            <select
              value={marginFilter}
              onChange={(e) => setMarginFilter(e.target.value)}
              className="h-10 appearance-none rounded-xl border border-subtle bg-white py-2 pl-3 pr-9 text-sm outline-none focus:border-violet-400 dark:bg-slate-950"
            >
              <option value="all">Margin Status: All</option>
              <option value="with">With Margin</option>
              <option value="zero">Zero Margin</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-muted" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => setBulkOpen((v) => !v)}
            >
              Bulk Actions
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            {bulkOpen && (
              <div className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-xl border border-subtle bg-white py-1 shadow-lg dark:bg-slate-950">
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm hover:bg-violet-50 dark:hover:bg-violet-950/40"
                  onClick={saveAll}
                  disabled={dirtyCount === 0 || saving}
                >
                  Save all changes
                </button>
                <button
                  type="button"
                  className="flex w-full px-3 py-2 text-left text-sm hover:bg-violet-50 dark:hover:bg-violet-950/40"
                  onClick={resetDirty}
                  disabled={dirtyCount === 0}
                >
                  Discard changes
                </button>
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-violet-200 text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300"
            onClick={() =>
              toast.info(
                `Preview uses a catalog base of ${formatINR(PREVIEW_BASE)}. Final package prices use real starting cost + state margin.`
              )
            }
          >
            <Eye className="mr-1.5 h-4 w-4" />
            Preview Catalog Price
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-subtle bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-subtle bg-slate-50/90 text-[11px] font-bold uppercase tracking-wide text-content-muted dark:bg-slate-900/60">
              <tr>
                <th className="w-10 px-2 py-3" />
                <th className="px-3 py-3">State</th>
                <th className="w-36 px-3 py-3">Margin %</th>
                <th className="w-44 px-3 py-3">Preview Price ({formatINR(PREVIEW_BASE)})</th>
                <th className="w-36 px-3 py-3">Margin Impact</th>
                <th className="w-28 px-3 py-3">Status</th>
                <th className="w-28 px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-content-muted">
                    Loading states…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-content-muted">
                    No states found for margin control.
                  </td>
                </tr>
              )}
              {!loading &&
                pageRows.map((row, index) => {
                  const id = String(row.destinationId);
                  const draft = drafts[id] || { marginPercent: '0', notes: '', active: true };
                  const pct = Number(draft.marginPercent) || 0;
                  const isDirty = dirtyIds.has(id);
                  const preview = previewUplift(PREVIEW_BASE, pct);
                  const impact = preview - PREVIEW_BASE;
                  const meta = getDestMeta(row.destinationName);
                  const isFocused = focusedId === id;

                  return (
                    <tr
                      key={id}
                      className={cn(
                        'border-b border-subtle/80 last:border-0 transition-colors',
                        isDirty && 'bg-amber-50/35 dark:bg-amber-950/15',
                        isFocused && 'bg-violet-50/40 dark:bg-violet-950/20'
                      )}
                    >
                      <td className="px-2 py-3 text-content-muted">
                        <GripVertical className="mx-auto h-4 w-4 opacity-40" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <DestAvatar name={row.destinationName} index={pageStart + index} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-content-primary">
                              {row.destinationName}
                            </p>
                            <p className="text-[11px] text-content-muted">
                              {meta.country}
                              {(row.aliases || []).length > 0
                                ? ` · ${(row.aliases || []).slice(0, 3).join(', ')}${(row.aliases || []).length > 3 ? '…' : ''}`
                                : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              min={0}
                              max={500}
                              step={0.5}
                              value={draft.marginPercent}
                              onFocus={() => setFocusedId(id)}
                              onBlur={() => setFocusedId((cur) => (cur === id ? null : cur))}
                              onChange={(e) => updateDraft(id, { marginPercent: e.target.value })}
                              className={cn(
                                'h-10 w-full rounded-xl border bg-white px-3 pr-8 text-sm font-semibold tabular-nums outline-none transition dark:bg-slate-950',
                                isFocused
                                  ? 'border-violet-500 ring-2 ring-violet-500/25'
                                  : 'border-subtle focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20'
                              )}
                            />
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-content-muted">
                              %
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              aria-label="Increase margin"
                              className="flex h-4 w-6 items-center justify-center rounded-md border border-subtle bg-white text-[9px] leading-none text-content-muted hover:bg-slate-50 dark:bg-slate-950"
                              onClick={() => bumpMargin(id, 0.5)}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              aria-label="Decrease margin"
                              className="flex h-4 w-6 items-center justify-center rounded-md border border-subtle bg-white text-[9px] leading-none text-content-muted hover:bg-slate-50 dark:bg-slate-950"
                              onClick={() => bumpMargin(id, -0.5)}
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-semibold tabular-nums text-content-primary">
                          {formatINR(preview)}
                        </p>
                        <p
                          className={cn(
                            'text-[11px] font-medium',
                            pct > 0 ? 'text-emerald-600' : 'text-content-muted'
                          )}
                        >
                          {pct > 0 ? `+${pct}% uplift` : 'No uplift'}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <div
                          className={cn(
                            'inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums',
                            impact > 0 ? 'text-emerald-600' : 'text-content-muted'
                          )}
                        >
                          {impact > 0 && <TrendingUp className="h-3.5 w-3.5" />}
                          {impact > 0 ? `+ ${formatINR(impact)}` : formatINR(0)}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="inline-flex items-center gap-2">
                          <Switch
                            checked={draft.active !== false}
                            size="md"
                            tone="violet"
                            aria-label={
                              draft.active !== false
                                ? `Deactivate ${row.destinationName} margin`
                                : `Activate ${row.destinationName} margin`
                            }
                            onCheckedChange={(next) => updateDraft(id, { active: next })}
                          />
                          <span
                            className={cn(
                              'text-xs font-semibold',
                              draft.active !== false
                                ? 'text-violet-700 dark:text-violet-300'
                                : 'text-content-muted'
                            )}
                          >
                            {draft.active !== false ? 'Active' : 'Off'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {!isDirty ? (
                          <span className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <Check className="h-3.5 w-3.5" />
                            Saved
                          </span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            className="h-9 rounded-xl bg-violet-600 px-3.5 text-white hover:bg-violet-500"
                            disabled={saving}
                            onClick={() => saveOne(id)}
                          >
                            Save
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-subtle px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-content-muted">
              Showing {showingFrom} to {showingTo} of {filtered.length} states
            </p>
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-subtle text-content-muted hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-900"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={cn(
                    'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold',
                    n === safePage
                      ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/30'
                      : 'border border-subtle text-content-secondary hover:bg-slate-50 dark:hover:bg-slate-900'
                  )}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-subtle text-content-muted hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-900"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 text-xs text-content-muted">
              <span>Rows per page</span>
              <div className="relative">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-8 appearance-none rounded-lg border border-subtle bg-white py-1 pl-2.5 pr-7 text-xs font-semibold outline-none dark:bg-slate-950"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
