import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin, Phone } from 'lucide-react';
import { STATUS_STYLES } from '../managerUtils';
import { cn } from '../../../lib/utils';

const AVATAR_TONES = [
  'from-violet-500 to-indigo-600',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-fuchsia-500 to-purple-600',
];

function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatPhone(phone) {
  if (!phone) return '—';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 10) return `+91 ${digits.slice(-10, -5)} ${digits.slice(-5)}`;
  return phone;
}

function statusLabel(status) {
  if (!status) return 'New';
  return String(status).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function followUpDueMeta(scheduledAt) {
  if (!scheduledAt) return { label: 'Scheduled', tone: 'slate', when: '—' };
  const due = new Date(scheduledAt);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);
  const startDayAfter = new Date(startTomorrow);
  startDayAfter.setDate(startDayAfter.getDate() + 1);
  const endDayAfter = new Date(startDayAfter);
  endDayAfter.setDate(endDayAfter.getDate() + 1);

  if (due < startToday) {
    return { label: 'Overdue', tone: 'rose', when: formatTime(scheduledAt) };
  }
  if (due < startTomorrow) {
    return { label: 'Due Today', tone: 'amber', when: formatTime(scheduledAt) };
  }
  if (due < startDayAfter) {
    return { label: 'Due Tomorrow', tone: 'teal', when: 'Tomorrow' };
  }
  if (due < endDayAfter) {
    return { label: 'In 2 Days', tone: 'sky', when: '2 Days' };
  }
  const days = Math.ceil((due - startToday) / 86400000);
  return {
    label: `In ${days} Days`,
    tone: 'slate',
    when: due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
  };
}

const DUE_BADGE = {
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  teal: 'bg-teal-50 text-teal-700 ring-teal-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  slate: 'bg-slate-50 text-slate-600 ring-slate-200',
};

const RANK_STYLES = [
  'bg-amber-100 text-amber-700 ring-amber-200',
  'bg-slate-100 text-slate-600 ring-slate-200',
  'bg-orange-100 text-orange-700 ring-orange-200',
];

export default function ManagerDashboardPanels({ data }) {
  if (!data) return null;

  const recent = (data.recentLeads || []).slice(0, 5);
  const followups = (data.upcomingFollowups || []).slice(0, 5);
  const performers = (data.teamRanking || []).slice(0, 5);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Panel title="Recent Leads" link="/sales-manager/leads/all" delay={0.2}>
        {recent.length ? (
          <ul className="divide-y divide-slate-100">
            {recent.map((lead, i) => (
              <li key={lead._id}>
                <Link
                  to={`/sales-manager/leads/${lead._id}/view`}
                  className="flex items-start gap-3 py-3 hover:bg-slate-50/80 -mx-1 px-1 rounded-xl transition-colors"
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full bg-gradient-to-br text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-sm',
                      AVATAR_TONES[i % AVATAR_TONES.length]
                    )}
                  >
                    {initials(lead.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">{lead.name}</p>
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-md ring-1 ring-inset capitalize',
                          STATUS_STYLES[lead.status] || STATUS_STYLES.new
                        )}
                      >
                        {statusLabel(lead.status)}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="font-medium text-violet-600">{lead.source || '—'}</span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {formatPhone(lead.phone)}
                      </span>
                      {lead.destination ? (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3" />
                          {lead.destination}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 tabular-nums shrink-0 pt-0.5">
                    {formatTime(lead.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 py-8 text-center">No recent leads</p>
        )}
      </Panel>

      <Panel title="Follow-ups Due" link="/sales-manager/follow-ups" delay={0.25}>
        {followups.length ? (
          <ul className="divide-y divide-slate-100">
            {followups.map((f, i) => {
              const due = followUpDueMeta(f.scheduledAt);
              return (
                <li key={f._id} className="flex items-start gap-3 py-3">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full bg-gradient-to-br text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-sm',
                      AVATAR_TONES[(i + 2) % AVATAR_TONES.length]
                    )}
                  >
                    {initials(f.customer)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">{f.customer || 'Lead'}</p>
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-md ring-1 ring-inset',
                          DUE_BADGE[due.tone]
                        )}
                      >
                        {due.label}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="font-medium text-violet-600">{f.source || f.executive || '—'}</span>
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {formatPhone(f.phone)}
                      </span>
                      {f.destination ? (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3" />
                          {f.destination}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 tabular-nums shrink-0 pt-0.5">
                    {due.when}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 py-8 text-center">No follow-ups due</p>
        )}
      </Panel>

      <Panel
        title="Team Top Performers"
        link="/sales-manager/team"
        delay={0.3}
        action={
          <span className="text-[11px] font-semibold text-slate-500 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100">
            This Week
          </span>
        }
      >
        {performers.length ? (
          <ul className="space-y-2.5">
            {performers.map((m, i) => (
              <li
                key={m.fullName || m.name}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100"
              >
                <span
                  className={cn(
                    'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ring-1 ring-inset shrink-0',
                    RANK_STYLES[i] || 'bg-slate-100 text-slate-500 ring-slate-200'
                  )}
                >
                  {m.rank || i + 1}
                </span>
                <div
                  className={cn(
                    'w-9 h-9 rounded-full bg-gradient-to-br text-white text-[11px] font-bold flex items-center justify-center shrink-0 shadow-sm',
                    AVATAR_TONES[i % AVATAR_TONES.length]
                  )}
                >
                  {initials(m.fullName || m.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{m.fullName || m.name}</p>
                  <p className="text-[11px] text-slate-500">{m.conversions || 0} conversions</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-900 tabular-nums">{m.leads}</p>
                  <p className="text-[10px] font-medium text-slate-400">leads</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 py-8 text-center">No team data yet</p>
        )}
      </Panel>
    </div>
  );
}

function Panel({ title, link, children, delay, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/50"
    >
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <div className="flex items-center gap-2 shrink-0">
          {action}
          <Link to={link} className="text-xs font-semibold text-violet-600 hover:text-violet-700 inline-flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
      {children}
    </motion.div>
  );
}
