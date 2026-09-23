import { PhoneCall } from 'lucide-react';

/**
 * The place assigned leads will appear. Cold Calling assignments do not exist yet, so this is only
 * the empty state — it intentionally never queries or lists leads.
 */
export default function CallingQueuePreview({
  title = 'Your Calling Queue',
  emptyTitle = 'No leads assigned yet',
  emptyMessage = 'Leads assigned to you for Cold Calling will appear here. Once Admin assigns Cold leads to you, they will show up in this queue.',
}) {
  return (
    <section aria-labelledby="calling-queue-title" className="rounded-2xl border border-subtle bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <h2 id="calling-queue-title" className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {title}
        </h2>
        <span className="metric-tabular rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">0</span>
      </div>
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100">
          <PhoneCall className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold text-slate-900">{emptyTitle}</p>
        <p className="max-w-sm text-xs leading-relaxed text-slate-500">{emptyMessage}</p>
      </div>
    </section>
  );
}
