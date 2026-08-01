import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UserPlus,
  CalendarClock,
  FileCheck,
  BarChart3,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '../../../lib/utils';

const actions = [
  {
    to: '/sales-manager/leads/all',
    label: 'Add New Lead',
    icon: UserPlus,
    wrap: 'bg-emerald-50 text-emerald-600',
  },
  {
    to: '/sales-manager/follow-ups',
    label: 'Follow-up Leads',
    icon: CalendarClock,
    wrap: 'bg-sky-50 text-sky-600',
  },
  {
    to: '/sales-manager/quotations/pending',
    label: 'Approve Quotes',
    icon: FileCheck,
    wrap: 'bg-violet-50 text-violet-600',
  },
  {
    to: '/sales-manager/reports',
    label: 'View Reports',
    icon: BarChart3,
    wrap: 'bg-amber-50 text-amber-600',
  },
  {
    to: '/sales-manager/assignment',
    label: 'More Actions',
    icon: MoreHorizontal,
    wrap: 'bg-slate-100 text-slate-500',
  },
];

export default function ManagerQuickActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm shadow-slate-200/50"
    >
      <div className="flex flex-wrap gap-2">
        {actions.map(({ to, label, icon: Icon, wrap }) => (
          <Link
            key={label}
            to={to}
            className={cn(
              'flex-1 min-w-[140px] inline-flex items-center gap-2.5 rounded-xl border border-slate-100',
              'px-3.5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors'
            )}
          >
            <span className={cn('inline-flex p-2 rounded-xl', wrap)}>
              <Icon className="w-4 h-4" strokeWidth={2.2} />
            </span>
            {label}
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
