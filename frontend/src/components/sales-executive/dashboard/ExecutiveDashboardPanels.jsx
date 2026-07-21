import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  CalendarClock,
  CheckCircle2,
  FileText,
  Flame,
  Mail,
  Phone,
  Target,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency, formatFollowUpDate } from '../executiveUtils';

function Panel({ title, link, children, delay = 0, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`rounded-xl border border-subtle bg-white p-3.5 shadow-sm dark:bg-slate-900/80 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold text-content-primary">{title}</h3>
        {link && (
          <Link to={link} className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 hover:text-violet-500">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </div>
      {children}
    </motion.div>
  );
}

const activityIcons = {
  call_made: Phone,
  email_sent: Mail,
  quotation_created: FileText,
  quotation_sent: FileText,
  followup_completed: CheckCircle2,
};

function ActivityList({ items = [] }) {
  if (!items.length) {
    return <p className="py-8 text-center text-xs text-content-muted">No activities recorded today</p>;
  }
  return (
    <div className="space-y-2">
      {items.slice(0, 4).map((item) => {
        const Icon = activityIcons[item.type] || CheckCircle2;
        return (
          <div key={item._id} className="flex gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-content-primary">{item.title}</p>
              <p className="truncate text-[9px] text-content-muted">
                {item.customer || item.description || 'Lead activity'} · {formatFollowUpDate(item.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReminderList({ items = [] }) {
  if (!items.length) {
    return <p className="py-8 text-center text-xs text-content-muted">No upcoming reminders</p>;
  }
  return (
    <div className="space-y-2">
      {items.slice(0, 4).map((item) => (
        <div key={item._id} className="flex gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
            <CalendarClock className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-content-primary">
              Follow-up with {item.customer || 'Customer'}
            </p>
            <p className="truncate text-[9px] text-content-muted">
              {item.destination || 'General enquiry'} · {formatFollowUpDate(item.scheduledAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function PipelineFunnel({ stages = [] }) {
  const max = Math.max(...stages.map((item) => item.count), 1);
  return (
    <div className="flex h-[190px] items-center gap-4">
      <div className="flex w-[48%] flex-col items-center gap-1">
        {stages.map((stage, index) => (
          <div
            key={stage.stage}
            className="flex h-7 items-center justify-center text-[9px] font-bold text-white shadow-sm"
            style={{
              width: `${Math.max(38, (stage.count / max) * 100 - index * 3)}%`,
              backgroundColor: stage.color,
              clipPath: 'polygon(8% 0, 92% 0, 82% 100%, 18% 100%)',
            }}
          >
            {stage.count}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {stages.map((stage) => (
          <div key={stage.stage} className="flex items-center gap-2 text-[10px]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
            <span className="flex-1 truncate text-content-secondary">{stage.stage}</span>
            <span className="font-bold text-content-primary">{stage.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Announcements({ items = [] }) {
  if (!items.length) return <p className="py-5 text-center text-xs text-content-muted">No active announcements</p>;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {items.slice(0, 3).map((item) => (
        <div key={item._id} className="flex min-w-0 gap-2 rounded-lg bg-surface-elevated/70 p-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
            <Bell className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[8px] font-bold uppercase text-violet-600">{item.type || 'Update'}</p>
            <p className="line-clamp-2 text-[10px] font-semibold text-content-primary">{item.title}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ExecutiveDashboardPanels({ data, announcements = [] }) {
  if (!data) return null;

  const progress = Math.min(100, Number(data.target?.progress || 0));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.85fr)_240px]">
        <Panel title="Lead Overview" delay={0.1}>
          <div className="h-[205px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.leadOverview || []} margin={{ top: 8, right: 8, left: -26, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 11 }} />
                <Line type="monotone" dataKey="leads" stroke="#8b5cf6" strokeWidth={2} dot={false} name="New Leads" />
                <Line type="monotone" dataKey="followups" stroke="#f59e0b" strokeWidth={2} dot={false} name="Follow-ups" />
                <Line type="monotone" dataKey="converted" stroke="#10b981" strokeWidth={2} dot={false} name="Converted" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Lead Pipeline" delay={0.15}>
          <PipelineFunnel stages={data.conversionProgress || []} />
        </Panel>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <Panel title="Today's Activities" link="/sales-executive/leads/all" delay={0.2}>
            <ActivityList items={data.todayActivities} />
          </Panel>
          <Panel title="Upcoming Reminders" link="/sales-executive/calendar" delay={0.25}>
            <ReminderList items={data.upcomingFollowups} />
          </Panel>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.85fr)_240px]">
        <Panel title="Important Announcements" delay={0.3}>
          <Announcements items={announcements} />
        </Panel>

        <Panel title="Top Performing Leads" link="/sales-executive/leads/all" delay={0.35}>
          <div className="space-y-2">
            {(data.topLeads || []).map((lead, index) => (
              <Link
                key={lead._id}
                to={`/sales-executive/leads/${lead._id}/view`}
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-surface-elevated"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">
                  {lead.name?.charAt(0)?.toUpperCase() || index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-semibold text-content-primary">{lead.name}</p>
                  <p className="truncate text-[9px] text-content-muted">{lead.destination || 'No destination'}</p>
                </div>
                <span className="text-[10px] font-bold text-content-primary">{formatCurrency(lead.budget)}</span>
                {lead.isHot ? <Flame className="h-3 w-3 text-orange-500" /> : null}
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Monthly Target" delay={0.4}>
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(#8b5cf6 ${progress * 3.6}deg, #ede9fe 0deg)` }}
            >
              <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-lg font-bold text-content-primary">{progress}%</span>
                <span className="text-[8px] text-content-muted">Achieved</span>
              </div>
            </div>
            <div className="min-w-0 text-[9px] text-content-muted">
              <p>Target Amount</p>
              <p className="text-xs font-bold text-content-primary">{formatCurrency(data.target?.monthlyTarget)}</p>
              <p className="mt-2">Achieved</p>
              <p className="text-xs font-bold text-content-primary">{formatCurrency(data.target?.revenueAchieved)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-violet-50 px-2 py-1.5 text-[9px] font-medium text-violet-700">
            <Target className="h-3 w-3" />
            {data.target?.leadsConverted || 0} leads converted this period
          </div>
        </Panel>
      </div>
    </div>
  );
}
