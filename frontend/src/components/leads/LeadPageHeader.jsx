import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, Download, Plus } from 'lucide-react';
import { usePermissions } from '../../hooks/usePermissions';

export default function LeadPageHeader({ title, total, showImportExport = true }) {
  const { can } = usePermissions();
  const canCreateLead = can('leads', 'create');

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5"
    >
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <h1 className="text-2xl sm:text-[26px] font-bold text-content-primary tracking-tight">{title}</h1>
          {total != null && (
            <span className="px-2.5 py-0.5 rounded-lg bg-blue-500 text-white text-sm font-bold metric-tabular shadow-sm">
              {total.toLocaleString('en-IN')}
            </span>
          )}
        </div>
        <p className="text-sm text-content-secondary">
          Manage, assign, and convert travel leads efficiently.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {showImportExport && (
          <>
            <button
              type="button"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-subtle bg-white text-sm font-medium text-content-primary hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Upload className="w-4 h-4 text-content-muted" />
              Import
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-subtle bg-white text-sm font-medium text-content-primary hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 text-content-muted" />
              Export
            </button>
          </>
        )}
        {canCreateLead && (
          <Link
            to="/leads/new"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold shadow-md shadow-blue-500/25 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </Link>
        )}
      </div>
    </motion.div>
  );
}
