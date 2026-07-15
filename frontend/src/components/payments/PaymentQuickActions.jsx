import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Wallet,
  FileText,
  RotateCcw,
  Bell,
  Download,
  BarChart3,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const ACTIONS = [
  { key: 'collect', label: 'Receive Payment', icon: Wallet, tone: 'bg-emerald-500' },
  { key: 'add', label: 'Add Payment', icon: Plus, tone: 'bg-indigo-500' },
  { key: 'invoice', label: 'Generate Invoice', icon: FileText, tone: 'bg-sky-500' },
  { key: 'refund', label: 'Refund', icon: RotateCcw, tone: 'bg-violet-500' },
  { key: 'remind', label: 'Reminder', icon: Bell, tone: 'bg-amber-500' },
  { key: 'export', label: 'Export', icon: Download, tone: 'bg-slate-600' },
  { key: 'reports', label: 'Reports', icon: BarChart3, tone: 'bg-rose-500' },
];

export default function PaymentQuickActions({ onAction }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="rounded-2xl border border-subtle bg-surface/95 backdrop-blur-md shadow-2xl p-2 w-56"
          >
            {ACTIONS.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => {
                  onAction(action.key);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-content-secondary hover:bg-slate-50 hover:text-content-primary transition-colors"
              >
                <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white', action.tone)}>
                  <action.icon className="w-4 h-4" />
                </span>
                {action.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white shadow-xl shadow-indigo-500/30 flex items-center justify-center transition-transform hover:scale-105"
        aria-label="Quick actions"
      >
        {open ? <X className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
      </button>
    </div>
  );
}
