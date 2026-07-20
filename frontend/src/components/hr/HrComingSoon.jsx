import { motion } from 'framer-motion';
import { Construction, Sparkles } from 'lucide-react';
import PageHeader from '../ui/PageHeader';
import { cn } from '../../lib/utils';

/** Premium placeholder for HR modules shipping in later phases. */
export default function HrComingSoon({
  title,
  description,
  features = [],
}) {
  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title={title}
        description={description || 'Enterprise HR module — coming next'}
        breadcrumbs={['HR', title]}
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-violet-100 bg-white p-8 shadow-sm sm:p-12"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-100/70 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-10 h-36 w-36 rounded-full bg-sky-50 blur-3xl" />
        <div className="relative mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5D5FEF] to-violet-600 text-white shadow-lg shadow-violet-500/30">
            <Construction className="h-7 w-7" />
          </div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-700 ring-1 ring-violet-200">
            <Sparkles className="h-3.5 w-3.5" />
            Phase 2
          </div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-500">
            This module ships next with a Darwinbox / Keka-style experience.
            Core HR, payroll, documents, assets, and expenses are live now.
          </p>
          {features.length > 0 && (
            <ul className="mt-6 grid w-full gap-2 text-left sm:grid-cols-2">
              {features.map((f) => (
                <li
                  key={f}
                  className={cn(
                    'rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs font-medium text-slate-600'
                  )}
                >
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
}
