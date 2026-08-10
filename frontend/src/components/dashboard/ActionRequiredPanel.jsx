import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  FileWarning,
  PhoneOff,
  UserX,
  Wallet,
} from 'lucide-react';
import DashboardPanel from './DashboardPanel';
import { cn } from '../../lib/utils';

const TONE = {
  violet: 'bg-violet-50 text-violet-600 border-violet-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
  blue: 'bg-blue-50 text-blue-600 border-blue-100',
  rose: 'bg-rose-50 text-rose-600 border-rose-100',
  orange: 'bg-orange-50 text-orange-600 border-orange-100',
};

const ICONS = {
  followups_due: CalendarClock,
  untouched: PhoneOff,
  quotes_awaiting: FileWarning,
  pending_payment: Wallet,
  low_followup_execs: UserX,
};

export default function ActionRequiredPanel({ items = [] }) {
  const rows = items.length
    ? items
    : [
        { key: 'followups_due', label: 'Follow-ups Due Today', count: 0, link: '/followups', tone: 'violet' },
        { key: 'untouched', label: 'Leads Untouched', count: 0, link: '/leads/inbox/new', tone: 'amber' },
        { key: 'quotes_awaiting', label: 'Quotations Awaiting Response', count: 0, link: '/quotations', tone: 'blue' },
        { key: 'pending_payment', label: 'Bookings Pending Payment', count: 0, link: '/bookings', tone: 'rose' },
        { key: 'low_followup_execs', label: 'Low Follow-up Executives', count: 0, link: '/team', tone: 'orange' },
      ];

  return (
    <DashboardPanel
      title="Action Required"
      subtitle="Urgent tasks needing attention"
      className="h-full"
      action={
        <Link
          to="/followups"
          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline"
        >
          View All Tasks <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <div className="space-y-2">
        {rows.map((row) => {
          const Icon = ICONS[row.key] || CalendarClock;
          return (
            <Link
              key={row.key}
              to={row.link || '/leads'}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition hover:opacity-90',
                TONE[row.tone] || TONE.violet
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70">
                <Icon className="h-4 w-4" />
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{row.label}</p>
              <span className="text-sm font-bold tabular-nums">{row.count || 0}</span>
            </Link>
          );
        })}
      </div>
    </DashboardPanel>
  );
}
