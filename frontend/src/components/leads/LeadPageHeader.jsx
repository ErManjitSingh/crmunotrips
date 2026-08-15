import { motion } from 'framer-motion';

/** Page title only — Add Lead lives in the global header. */
export default function LeadPageHeader({ title, total, compact = false }) {
  if (compact) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5"
    >
      <div className="mb-1 flex items-center gap-2.5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">{title}</h1>
        {total != null && (
          <span className="metric-tabular rounded-lg bg-violet-600 px-2.5 py-0.5 text-sm font-bold text-white shadow-sm">
            {total.toLocaleString('en-IN')}
          </span>
        )}
      </div>
      <p className="text-sm text-slate-500">
        Manage, assign, and convert travel leads efficiently.
      </p>
    </motion.div>
  );
}
