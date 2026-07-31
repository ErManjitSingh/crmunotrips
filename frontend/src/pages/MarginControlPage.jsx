import { useCallback, useEffect, useMemo, useState } from 'react';
import { Percent, Save, RefreshCw, Search, Info } from 'lucide-react';
import API from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
import { Button } from '../components/ui/button';
import { toast } from '../context/ToastContext';
import { useDataRefresh } from '../hooks/useDataRefresh';
import { cn } from '../lib/utils';

function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function previewUplift(base, percent) {
  const pct = Number(percent) || 0;
  const amount = Number(base) || 0;
  return Math.round(amount * (1 + pct / 100));
}

export default function MarginControlPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [search, setSearch] = useState('');
  const [dirtyIds, setDirtyIds] = useState(() => new Set());

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
      toast.error('Failed to load destination margins');
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
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = `${row.destinationName} ${(row.aliases || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const dirtyCount = dirtyIds.size;
  const activeMarginCount = rows.filter((r) => Number(r.marginPercent) > 0 && r.active !== false).length;

  const updateDraft = (destinationId, patch) => {
    const id = String(destinationId);
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
    setDirtyIds((prev) => new Set(prev).add(id));
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
      toast.success(`Saved margins for ${items.length} destination${items.length === 1 ? '' : 's'}`);
      await load();
    } catch {
      toast.error('Failed to save margins');
    } finally {
      setSaving(false);
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-10">
      <PageHeader
        title="Margin Control"
        description="Set destination-wise package margin. Matching packages automatically get this % added to cost."
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={load} disabled={loading || saving}>
              <RefreshCw className={cn('mr-1.5 h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button type="button" onClick={saveAll} disabled={saving || dirtyCount === 0}>
              <Save className="mr-1.5 h-4 w-4" />
              Save changes{dirtyCount ? ` (${dirtyCount})` : ''}
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-subtle bg-surface px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-content-muted">Destinations</p>
          <p className="mt-1 text-2xl font-bold text-content-primary">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Active margins
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-800 dark:text-emerald-300">{activeMarginCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            Unsaved edits
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-800 dark:text-amber-300">{dirtyCount}</p>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Example: Goa margin <span className="font-semibold">10%</span> → a package listed at{' '}
          <span className="font-semibold">{formatINR(10000)}</span> becomes{' '}
          <span className="font-semibold">{formatINR(11000)}</span> in catalog and quotation costing.
          Only admin and sales manager can change these values.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search destination…"
          className="h-10 w-full rounded-xl border border-subtle bg-surface pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-subtle bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-subtle bg-slate-50/80 text-[11px] font-bold uppercase tracking-wide text-content-muted dark:bg-slate-900/50">
              <tr>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3 w-36">Margin %</th>
                <th className="px-4 py-3 w-44">Preview (₹10,000)</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 w-24">Active</th>
                <th className="px-4 py-3 w-28 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-content-muted">
                    Loading destinations…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-content-muted">
                    No destinations found. Add destinations under Destination Assignment first.
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((row) => {
                  const id = String(row.destinationId);
                  const draft = drafts[id] || { marginPercent: '0', notes: '', active: true };
                  const pct = Number(draft.marginPercent) || 0;
                  const isDirty = dirtyIds.has(id);
                  return (
                    <tr
                      key={id}
                      className={cn(
                        'border-b border-subtle/80 last:border-0',
                        isDirty && 'bg-amber-50/40 dark:bg-amber-950/20'
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-700 dark:text-teal-300">
                            <Percent className="h-3.5 w-3.5" />
                          </span>
                          <div>
                            <p className="font-semibold text-content-primary">{row.destinationName}</p>
                            {row.aliases?.length > 0 && (
                              <p className="text-[11px] text-content-muted">
                                Aliases: {row.aliases.slice(0, 3).join(', ')}
                                {row.aliases.length > 3 ? '…' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={500}
                            step={0.5}
                            value={draft.marginPercent}
                            onChange={(e) => updateDraft(id, { marginPercent: e.target.value })}
                            className="h-9 w-full rounded-lg border border-subtle bg-white px-2.5 pr-7 text-sm font-semibold tabular-nums outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-950"
                          />
                          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-content-muted">
                            %
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold tabular-nums text-content-primary">
                          {formatINR(previewUplift(10000, pct))}
                        </p>
                        <p className="text-[10px] text-content-muted">
                          {pct > 0 ? `+${pct}% uplift` : 'No uplift'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={draft.notes}
                          onChange={(e) => updateDraft(id, { notes: e.target.value })}
                          placeholder="Optional note"
                          className="h-9 w-full min-w-[140px] rounded-lg border border-subtle bg-white px-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-950"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-content-secondary">
                          <input
                            type="checkbox"
                            checked={draft.active !== false}
                            onChange={(e) => updateDraft(id, { active: e.target.checked })}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          On
                        </label>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant={isDirty ? 'default' : 'outline'}
                          disabled={saving || !isDirty}
                          onClick={() => saveOne(id)}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
