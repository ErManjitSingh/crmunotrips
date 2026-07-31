import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarClock,
  PartyPopper,
  Settings2,
  GraduationCap,
  Bell,
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

const DEFAULT_STATUS = [
  { stage: 'New', count: 0, color: '#0EA5E9' },
  { stage: 'Contacted', count: 0, color: '#8B5CF6' },
  { stage: 'Follow-up', count: 0, color: '#F59E0B' },
  { stage: 'Quotation', count: 0, color: '#6366F1' },
  { stage: 'Converted', count: 0, color: '#10B981' },
];

/**
 * Row: Recent Updates | Lead Status / Followups (merged).
 */
export default function RecentUpdatesRemindersRow({
  announcements = [],
  conversionProgress = [],
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

  const stages = (conversionProgress?.length ? conversionProgress : DEFAULT_STATUS).slice(0, 5);
  const followups = (upcomingFollowups || []).slice(0, 3);

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
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-content-primary">Lead Status / Followups</h3>
            <p className="mt-0.5 text-[11px] text-content-muted">Pipeline status and upcoming follow-ups</p>
          </div>
          <Link
            to="/sales-executive/follow-ups"
            className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-violet-600 hover:text-violet-500"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="mt-3 space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-wide text-content-muted">Lead Status</p>
          {stages.map((stage) => (
            <div key={stage.stage} className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color || '#8b5cf6' }}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-content-secondary">
                {stage.stage}
              </span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 sm:w-24">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(8, Math.min(100, Number(stage.count) ? 20 + Number(stage.count) * 8 : 8))}%`,
                    backgroundColor: stage.color || '#8b5cf6',
                  }}
                />
              </div>
              <span className="w-6 text-right text-[11px] font-bold tabular-nums text-content-primary">
                {stage.count ?? 0}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-subtle pt-3">
          <p className="mb-2 text-[9px] font-bold uppercase tracking-wide text-content-muted">Followups</p>
          {followups.length === 0 ? (
            <p className="py-2 text-center text-[11px] text-content-muted">No upcoming followups</p>
          ) : (
            <div className="space-y-2">
              {followups.map((item) => (
                <div key={item._id} className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <CalendarClock className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-content-primary">
                      {item.customer || 'Customer'}
                    </p>
                    <p className="truncate text-[10px] text-content-muted">
                      {item.destination || 'General'} · {formatFollowUpDate(item.scheduledAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <Link
          to="/sales-executive/follow-ups"
          className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-500"
        >
          Open Followups <ArrowRight className="h-3 w-3" />
        </Link>
      </motion.div>
    </div>
  );
}
