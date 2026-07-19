import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Wand2 } from 'lucide-react';

export default function WizardDraftIndicator({ status, lastSaved }) {
  const saving = status === 'saving';
  const saved = status === 'saved';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="inline-flex items-center gap-2 text-xs font-medium text-slate-500"
      >
        {saving ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
            <span>Saving draft...</span>
          </>
        ) : saved ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-emerald-600">Draft saved{lastSaved ? ` · ${lastSaved}` : ''}</span>
            <Wand2 className="w-3.5 h-3.5 text-[#5D5FEF]" />
          </>
        ) : (
          <>
            <Wand2 className="w-3.5 h-3.5 text-[#5D5FEF]" />
            <span>Auto-save on</span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
