import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';

function formatTodayDate() {
  return new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ExecutivePageShell({ title, description, icon: Icon, action, showDate = true, children }) {
  return (
    <div className="space-y-6 pb-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="w-9 h-9 rounded-xl bg-[#5D5FEF]/10 flex items-center justify-center shrink-0">
                <Icon className="w-[18px] h-[18px] text-[#5D5FEF]" strokeWidth={2} />
              </div>
            )}
            <h1 className="text-2xl sm:text-[28px] font-bold text-content-primary tracking-tight">{title}</h1>
          </div>
          {description && (
            <p className="text-sm text-content-secondary mt-1.5 sm:ml-[46px]">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {showDate && (
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-subtle bg-white dark:bg-slate-900 shadow-sm text-sm font-medium text-content-secondary">
              <CalendarDays className="w-4 h-4 text-violet-500" />
              {formatTodayDate()}
            </div>
          )}
          {action}
        </div>
      </motion.div>
      {children}
    </div>
  );
}
