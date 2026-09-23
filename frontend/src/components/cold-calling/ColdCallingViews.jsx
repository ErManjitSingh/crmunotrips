import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import WelcomeHeader from './WelcomeHeader';
import CallingSummaryCards from './CallingSummaryCards';
import CallingQueuePreview from './CallingQueuePreview';
import MyColdCallingLeadsList from './MyColdCallingLeadsList';
import TablePagination from '../ui/TablePagination';
import { COLD_CALLING_LEADS_PATH, getWorkspaceIdentity } from '../../lib/coldCallingWorkspace';
import { formatCount } from '../../lib/executiveLeadStatusFilters';

/**
 * /cold-calling — presentational (the page wrapper supplies the authenticated user and, once loaded,
 * the real summary). Without a summary it shows the honest empty state.
 */
export function ColdCallingDashboardView({ user, summary, now }) {
  const assigned = summary?.assigned || 0;
  return (
    <div className="animate-fade-up">
      <WelcomeHeader identity={getWorkspaceIdentity(user)} now={now} />
      <CallingSummaryCards summary={summary} />
      {assigned > 0 ? (
        <section aria-label="Your assigned leads" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-subtle bg-white px-4 py-4 shadow-sm">
          <p className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{formatCount(assigned)}</span> lead{assigned === 1 ? ' is' : 's are'} assigned to you for Cold Calling.
          </p>
          <Link
            to={COLD_CALLING_LEADS_PATH}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sky-600 px-3 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
          >
            View My Leads <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      ) : (
        <CallingQueuePreview />
      )}
    </div>
  );
}

/** /cold-calling/leads — the agent's own assigned leads, read-only. */
export function ColdCallingMyLeadsView({ rows = [], loading = false, error = null, onRetry, pagination, pageIndex = 0, pageSize = 25, onPageChange, onOpenHistory }) {
  const total = pagination?.total ?? rows.length;
  return (
    <div className="animate-fade-up">
      <header className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-600">Cold Calling Workspace</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">My Leads</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Leads assigned to you for Cold Calling.
          {!loading && !error && total > 0 && <span className="ml-1 font-semibold text-slate-700">{formatCount(total)} total</span>}
        </p>
      </header>

      {error ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-rose-800">Couldn&apos;t load your leads</p>
          <p className="max-w-md text-xs text-rose-700">{error}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} className="h-9 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700">
              Try again
            </button>
          )}
        </div>
      ) : (
        <>
          <MyColdCallingLeadsList rows={rows} loading={loading} onOpenHistory={onOpenHistory} />
          {!loading && total > 0 && onPageChange && (
            <TablePagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              pageCount={pagination?.totalPages || 1}
              total={total}
              onPageChange={onPageChange}
              totalLabel="leads"
              accent="blue"
            />
          )}
        </>
      )}
    </div>
  );
}
