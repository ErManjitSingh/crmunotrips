import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, Trash2, RefreshCw, Download, X } from 'lucide-react';
import { Button } from '../ui/button';

export default function LeadBulkActionsBar({ count, onClear, onAssign, onDelete, onStatusUpdate, onExport }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-4 flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-brand-500/25 bg-brand-500/5"
        >
          <span className="text-sm font-semibold text-brand-600">{count} selected</span>
          <div className="flex flex-wrap gap-2 flex-1">
            {onAssign && (
              <Button variant="outline" size="sm" className="rounded-lg h-8 gap-1.5 text-xs" onClick={onAssign}>
                <UserCheck className="w-3.5 h-3.5" /> Bulk Assign
              </Button>
            )}
            {onStatusUpdate && (
              <Button variant="outline" size="sm" className="rounded-lg h-8 gap-1.5 text-xs" onClick={onStatusUpdate}>
                <RefreshCw className="w-3.5 h-3.5" /> Update Status
              </Button>
            )}
            {onExport && (
              <Button variant="outline" size="sm" className="rounded-lg h-8 gap-1.5 text-xs" onClick={onExport}>
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            )}
            {onDelete && (
              <Button variant="outline" size="sm" className="rounded-lg h-8 gap-1.5 text-xs text-red-600 hover:text-red-600 hover:bg-red-500/10" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            )}
          </div>
          <button onClick={onClear} className="p-1.5 rounded-lg hover:bg-surface-elevated text-content-muted">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
