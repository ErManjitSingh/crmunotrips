import { useState } from 'react';
import { AlertTriangle, Headphones, Loader2, X } from 'lucide-react';
import AppModal from '../ui/AppModal';
import { useAssignColdLeadsMutation, useColdCallingAgents } from '../../features/leads/hooks/useExecutiveLeadStatusQuery';
import { canSubmitAssignment, describeAssignError, describeAssignSuccess } from '../../lib/coldCallingAssignment';
import { useToast } from '../../context/ToastContext';

/**
 * Admin: pick a Cold Calling agent for the selected Cold leads. This is NOT a reassignment — the
 * Sales Executive keeps the leads; the modal says so. All-or-nothing on the server; a 409 lists the
 * leads that blocked it. The button is disabled while the request is in flight (no double submit).
 */
export default function AssignColdCallingModal({ open, onClose, executive, leads, onAssigned }) {
  const toast = useToast();
  const [coldCallerId, setColdCallerId] = useState('');
  const [problem, setProblem] = useState(null);
  const agents = useColdCallingAgents(open);
  const assign = useAssignColdLeadsMutation();

  const count = leads.length;
  const nameById = Object.fromEntries(leads.map((lead) => [String(lead._id), lead.name]));
  const agentList = agents.data ?? [];
  const canSubmit = canSubmitAssignment({ coldCallerId, count, pending: assign.isPending });

  const close = () => {
    if (assign.isPending) return;
    setProblem(null);
    setColdCallerId('');
    onClose();
  };

  const submit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setProblem(null);
    assign.mutate(
      { executiveId: executive?._id, leadIds: leads.map((lead) => lead._id), coldCallerId },
      {
        onSuccess: (result) => {
          toast.success(describeAssignSuccess(result));
          setColdCallerId('');
          onAssigned?.(result);
        },
        onError: (error) => setProblem(describeAssignError(error, nameById)),
      }
    );
  };

  return (
    <AppModal open={open} onClose={close} size="md" lockDismiss={assign.isPending} closeOnBackdrop={!assign.isPending}>
      <form onSubmit={submit} className="space-y-5 p-6" aria-busy={assign.isPending}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-500">
              <Headphones className="h-3.5 w-3.5" aria-hidden="true" /> Cold Calling
            </p>
            <h3 className="mt-1 text-xl font-bold text-content-primary">Assign to Cold Calling</h3>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={assign.isPending}
            aria-label="Close"
            className="rounded-lg p-1.5 text-content-muted transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-subtle px-4 py-3 text-sm">
          <div>
            <dt className="text-xs font-semibold text-content-muted">Selected leads</dt>
            <dd className="mt-0.5 font-bold text-content-primary">{count}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-semibold text-content-muted">Sales Executive</dt>
            <dd className="mt-0.5 truncate font-semibold text-content-primary" title={executive?.name}>{executive?.name || '—'}</dd>
          </div>
        </dl>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-content-muted">Cold Calling agent</span>
          <select
            required
            className="input-premium"
            value={coldCallerId}
            onChange={(event) => setColdCallerId(event.target.value)}
            disabled={agents.isPending || assign.isPending}
          >
            <option value="">{agents.isPending ? 'Loading agents…' : 'Select an agent'}</option>
            {agentList.map((agent) => (
              <option key={agent._id} value={agent._id}>{agent.name}</option>
            ))}
          </select>
          {agents.isError && (
            <span role="alert" className="block text-xs text-rose-600">
              Couldn&apos;t load Cold Calling agents.{' '}
              <button type="button" className="font-semibold underline" onClick={() => agents.refetch()}>Retry</button>
            </span>
          )}
          {agents.isSuccess && agentList.length === 0 && (
            <span className="block text-xs text-amber-700">No active Cold Calling users found. Create one in Team Management first.</span>
          )}
        </label>

        <p className="text-xs text-content-muted">
          {executive?.name ? `${executive.name} stays the Sales owner.` : 'The Sales owner does not change.'} The agent gets a
          read-only view of these leads.
        </p>

        {problem && (
          <div role="alert" className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
            <p className="flex items-start gap-2 font-semibold">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {problem.message}
            </p>
            {problem.failures.length > 0 && (
              <ul className="max-h-32 space-y-1 overflow-y-auto pl-6">
                {problem.failures.map((failure) => (
                  <li key={failure.leadId} className="list-disc">
                    <span className="font-semibold">{failure.label}</span>: {failure.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            disabled={assign.isPending}
            className="h-10 rounded-xl border border-subtle px-4 text-sm font-semibold text-content-primary transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {assign.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {assign.isPending ? 'Assigning…' : `Assign ${count} lead${count === 1 ? '' : 's'}`}
          </button>
        </div>
      </form>
    </AppModal>
  );
}
