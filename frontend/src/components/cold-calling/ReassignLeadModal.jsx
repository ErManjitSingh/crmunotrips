import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Check, Search, UserRound, X } from 'lucide-react';
import AppModal from '../ui/AppModal';
import { fetchColdCallingReassignOptions, reassignColdCallingLead } from '../../services/leadEnterpriseApi';
import { shouldRetryExecutiveLeadStatus } from '../../lib/executiveLeadStatusFilters';
import { toast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';

const errorMessage = (error) => error?.response?.data?.message || error?.message || 'Something went wrong. Please try again.';

/**
 * Cold Calling -> Sales Executive hand-over for ONE lead. The executive list comes from the server (active
 * executives in the lead's branch, current owner excluded) and the server re-validates everything on submit.
 * `expectedCurrentOwnerId` guards against a stale screen: if the owner changed meanwhile the server answers 409.
 */
export default function ReassignLeadModal({ open, lead, onClose }) {
  const queryClient = useQueryClient();
  const leadId = lead?._id;
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedId('');
      setSearch('');
    }
  }, [open, leadId]);

  const options = useQuery({
    queryKey: ['cold-calling', 'reassign-options', leadId],
    queryFn: () => fetchColdCallingReassignOptions(leadId),
    enabled: Boolean(open && leadId),
    staleTime: 0,
    retry: shouldRetryExecutiveLeadStatus,
  });

  const mutation = useMutation({
    mutationFn: () => reassignColdCallingLead(leadId, {
      executiveId: selectedId,
      expectedCurrentOwnerId: options.data?.currentOwner?._id ? String(options.data.currentOwner._id) : '',
    }),
    onSuccess: (result) => {
      toast.success(result?.message || 'Lead reassigned.');
      // My Leads, the dashboard cards and every other Cold Calling view refresh from the server.
      queryClient.invalidateQueries({ queryKey: ['cold-calling'] });
      onClose?.();
    },
  });

  const executives = options.data?.executives ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? executives.filter((ex) => String(ex.name || '').toLowerCase().includes(q)) : executives;
  }, [executives, search]);
  const selected = executives.find((ex) => String(ex._id) === selectedId);
  const currentOwnerName = options.data?.currentOwner?.name || 'Unassigned';

  return (
    <AppModal open={open} onClose={onClose} lockDismiss={mutation.isPending} size="md">
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Reassign lead</p>
            <h3 className="mt-1 truncate text-xl font-bold text-content-primary">{lead?.name}</h3>
            <p className="mt-0.5 text-xs text-content-muted">
              Transfers the lead to another Sales Executive. Its status, calls, follow-ups and history stay with it.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            aria-label="Close"
            className="rounded-lg p-1.5 text-content-muted transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {options.isError ? (
          <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center">
            <AlertTriangle className="h-6 w-6 text-rose-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-rose-800">{errorMessage(options.error)}</p>
            <button type="button" onClick={() => options.refetch()} className="text-xs font-semibold text-rose-700 underline">Try again</button>
          </div>
        ) : options.isPending ? (
          <ul className="space-y-2" aria-busy="true">
            {[...Array(4)].map((_, i) => <li key={i} className="h-11 animate-pulse rounded-xl bg-slate-100" />)}
          </ul>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-subtle bg-slate-50/70 px-3 py-2 text-sm">
              <span className="text-content-muted">Current owner</span>
              <span className="font-semibold text-content-primary">{currentOwnerName}</span>
              <ArrowRight className="h-3.5 w-3.5 text-content-muted" aria-hidden="true" />
              <span className={cn('font-semibold', selected ? 'text-sky-700' : 'text-content-muted')}>{selected?.name || 'Select below'}</span>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Sales Executive…"
                aria-label="Search Sales Executive"
                className="h-10 w-full rounded-xl border border-subtle bg-white pl-9 pr-3 text-sm text-content-primary outline-none focus:border-sky-400"
              />
            </div>

            {executives.length === 0 ? (
              <p className="rounded-xl border border-dashed border-subtle px-4 py-8 text-center text-sm text-content-muted">
                No other active Sales Executive in this lead&apos;s branch.
              </p>
            ) : (
              <ul role="radiogroup" aria-label="Select Sales Executive" className="max-h-[40vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-subtle">
                {filtered.map((ex) => {
                  const active = String(ex._id) === selectedId;
                  return (
                    <li key={ex._id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelectedId(String(ex._id))}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2.5 text-left transition focus:outline-none focus-visible:bg-sky-50',
                          active ? 'bg-sky-50' : 'hover:bg-slate-50'
                        )}
                      >
                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', active ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500')}>
                          {active ? <Check className="h-4 w-4" aria-hidden="true" /> : <UserRound className="h-4 w-4" aria-hidden="true" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-content-primary">{ex.name}</span>
                          {ex.email && <span className="block truncate text-xs text-content-muted">{ex.email}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-content-muted">No match for &ldquo;{search}&rdquo;</li>}
              </ul>
            )}
          </>
        )}

        {mutation.isError && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{errorMessage(mutation.error)}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="h-10 rounded-xl border border-subtle px-4 text-sm font-semibold text-content-muted transition hover:bg-slate-50 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!selectedId || mutation.isPending || options.isPending}
            className="h-10 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? 'Reassigning…' : selected ? `Reassign to ${selected.name}` : 'Reassign'}
          </button>
        </div>
      </div>
    </AppModal>
  );
}
