import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

export default function LeadPageHeader({ title, total, compact = false }) {
  const { can } = usePermissions();
  const canCreateLead = can('leads', 'create');

  if (compact) {
    return canCreateLead ? (
      <div className="mb-4 flex justify-end">
        <Link
          to="/leads/new"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition-colors hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          Add Lead
        </Link>
      </div>
    ) : null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
    >
      <div>
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
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {canCreateLead && (
          <Link
            to="/leads/new"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-violet-500/25 transition-colors hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </Link>
        )}
      </div>
    </motion.div>
  );
}
