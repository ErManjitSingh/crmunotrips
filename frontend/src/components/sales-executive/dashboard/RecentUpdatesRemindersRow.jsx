import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarClock,
  Flame,
  PartyPopper,
  Settings2,
  GraduationCap,
  Bell,
  UserRoundX,
} from 'lucide-react';
import { formatFollowUpDate } from '../executiveUtils';

function relativeAgo(date) {
  if (!date) return '';
  const ms = Date.now() - new Date(date).getTime();
  if (Number.isNaN(ms) || ms < 0) return formatFollowUpDate(date);
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function updateIcon(type = '', title = '') {
  const blob = `${type} ${title}`.toLowerCase();
  if (blob.includes('holiday')) return PartyPopper;
  if (blob.includes('maintenance') || blob.includes('crm')) return Settings2;
  if (blob.includes('training') || blob.includes('session')) return GraduationCap;
  return Bell;
}

const FALLBACK_UPDATES = [
  { id: 'u1', title: 'New Holiday Added', type: 'holiday', at: Date.now() - 2 * 3600000 },
  { id: 'u2', title: 'CRM Maintenance', type: 'maintenance', at: Date.now() - 24 * 3600000 },
  { id: 'u3', title: 'New Training Session', type: 'training', at: Date.now() - 48 * 3600000 },
];

/**
 * Bottom row: Recent Updates | Key Reminders (50/50).
 */
export default function RecentUpdatesRemindersRow({
  announcements = [],
  kpis = {},
  upcomingFollowups = [],
}) {
  const updates = (announcements.length
    ? announcements.map((a) => ({
        id: a._id,
        title: a.title,
        type: a.type,
        at: a.publishAt || a.createdAt || a.updatedAt,
      }))
    : FALLBACK_UPDATES
  ).slice(0, 4);

  const reminders = [
    {
      id: 'followups',
      title: 'Follow-ups Pending',
      detail: `${kpis.todayFollowups ?? 0} due today`,
      to: '/sales-executive/follow-ups',
      icon: CalendarClock,
      tone: 'bg-amber-50 text-amber-600',
    },
    {
      id: 'unassigned',
      title: 'Upcoming Follow-ups',
      detail: `${upcomingFollowups.length || 0} scheduled`,
      to: '/sales-executive/calendar',
      icon: UserRoundX,
      tone: 'bg-sky-50 text-sky-600',
    },
    {
      id: 'hot',
      title: 'Hot Leads',
      detail: `${kpis.hotLeads ?? 0} need attention`,
      to: '/sales-executive/leads/hot',
      icon: Flame,
      tone: 'bg-orange-50 text-orange-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-stretch">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex h-full flex-col rounded-2xl border border-subtle bg-white p-4 shadow-sm dark:bg-slate-900/80"
      >
        <h3 className="text-sm font-bold text-content-primary">Recent Updates</h3>
        <p className="mt-0.5 text-[11px] text-content-muted">Latest notices for your team</p>

        <div className="relative mt-4 flex-1 space-y-0 pl-2">
          <div className="absolute bottom-2 left-[18px] top-2 w-px bg-violet-100" aria-hidden />
          {updates.map((item) => {
            const Icon = updateIcon(item.type, item.title);
            return (
              <div key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 ring-4 ring-white">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 pt-1">
                  <p className="truncate text-[12px] font-semibold text-content-primary">{item.title}</p>
                  <p className="text-[10px] text-content-muted">{relativeAgo(item.at)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <Link
          to="/sales-executive/follow-ups"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-500"
        >
          View All Updates <ArrowRight className="h-3 w-3" />
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex h-full flex-col rounded-2xl border border-subtle bg-white p-4 shadow-sm dark:bg-slate-900/80"
      >
        <h3 className="text-sm font-bold text-content-primary">Key Reminders</h3>
        <p className="mt-0.5 text-[11px] text-content-muted">Things that need your attention</p>

        <div className="mt-4 flex-1 space-y-2">
          {reminders.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                to={item.to}
                className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 transition hover:border-violet-200 hover:bg-violet-50/50"
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-content-primary">{item.title}</p>
                  <p className="truncate text-[10px] text-content-muted">{item.detail}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              </Link>
            );
          })}
        </div>

        <Link
          to="/sales-executive/follow-ups"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-500"
        >
          Go to Reminders <ArrowRight className="h-3 w-3" />
        </Link>
      </motion.div>
    </div>
  );
}
