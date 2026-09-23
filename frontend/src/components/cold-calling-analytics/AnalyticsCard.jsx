import { cn } from '../../lib/utils';

/** Titled panel used by every analytics section: consistent header, dense body. */
export default function AnalyticsCard({ title, subtitle, children, className, action }) {
  return (
    <section className={cn('rounded-2xl border border-subtle bg-white p-4 shadow-sm', className)}>
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function SectionEmpty({ children = 'Nothing to show for these filters.' }) {
  return <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-500">{children}</p>;
}

export function BarSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3" aria-busy="true">
      {[...Array(rows)].map((_, i) => <div key={i} className="h-6 animate-pulse rounded bg-slate-100" />)}
    </div>
  );
}
