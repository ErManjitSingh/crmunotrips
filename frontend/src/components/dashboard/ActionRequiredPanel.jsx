import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import DashboardPanel from './DashboardPanel';
import { cn } from '../../lib/utils';

const BADGE = {
  violet: 'bg-violet-100 text-violet-700',
  amber: 'bg-orange-100 text-orange-700',
  blue: 'bg-blue-100 text-blue-700',
  rose: 'bg-red-100 text-red-700',
  orange: 'bg-amber-100 text-amber-700',
};

const DEFAULT_ROWS = [
  { key: 'followups_due', label: 'Follow-ups Due Today', count: 0, link: '/followups', tone: 'rose' },
  { key: 'untouched', label: 'Leads Untouched (24+ hrs)', count: 0, link: '/leads/inbox/new', tone: 'amber' },
  { key: 'quotes_awaiting', label: 'Quotations Awaiting Response', count: 0, link: '/quotations', tone: 'violet' },
  { key: 'pending_payment', label: 'Bookings Pending Payment', count: 0, link: '/bookings', tone: 'blue' },
  { key: 'low_followup_execs', label: 'Low Follow-up Executives', count: 0, link: '/team', tone: 'orange' },
];

export default function ActionRequiredPanel({ items = [] }) {
  const incoming = items.length ? items : DEFAULT_ROWS;
  const rows = incoming.map((row) => {
    const fallback = DEFAULT_ROWS.find((d) => d.key === row.key);
    return {
      ...fallback,
      ...row,
      label:
        row.key === 'untouched'
          ? 'Leads Untouched (24+ hrs)'
          : row.label || fallback?.label,
      tone: row.key === 'followups_due' ? 'rose' : row.tone || fallback?.tone || 'violet',
    };
  });

  return (
    <DashboardPanel title="Action Required" className="h-full">
      <div className="space-y-1">
        {rows.map((row) => (
          <Link
            key={row.key}
            to={row.link || '/leads'}
            className="flex items-center justify-between gap-3 rounded-xl px-1 py-2.5 transition hover:bg-slate-50"
          >
            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-700">
              {row.label}
            </p>
            <span
              className={cn(
                'inline-flex min-w-[28px] items-center justify-center rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums',
                BADGE[row.tone] || BADGE.violet
              )}
            >
              {row.count || 0}
            </span>
          </Link>
        ))}
      </div>
      <Link
        to="/followups"
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-violet-600 hover:underline"
      >
        View All Tasks <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </DashboardPanel>
  );
}
