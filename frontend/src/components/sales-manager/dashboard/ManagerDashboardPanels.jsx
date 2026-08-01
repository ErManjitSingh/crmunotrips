import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Medal, Clock, FileCheck } from 'lucide-react';
import { formatCurrency, STATUS_STYLES } from '../managerUtils';
import PriorityBadge from '../PriorityBadge';
import { CustomerCell } from '../LeadListBadges';
import { leadListRowClass } from '../../leads/leadListStyles';

export default function ManagerDashboardPanels({ data }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Panel title="Recent Leads" link="/sales-manager/leads/all" delay={0.3}>
        <div className="rounded-xl border border-subtle overflow-hidden">
          {data.recentLeads?.length ? data.recentLeads.map((lead, i) => (
            <Link
              key={lead._id}
              to={`/sales-manager/leads/${lead._id}/view`}
              className={`flex items-center gap-3 px-3 py-2.5 border-b border-slate-100 last:border-0 ${leadListRowClass(i)}`}
            >
              <div className="flex-1 min-w-0">
                <CustomerCell name={lead.name} lead={lead} />
                <p className="text-xs text-content-muted mt-0.5 pl-10 truncate">
                  {lead.destination} · {formatCurrency(lead.budget)} · {lead.executive}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {lead.isHot && <PriorityBadge lead={lead} />}
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg ring-1 ring-inset capitalize ${STATUS_STYLES[lead.status] || STATUS_STYLES.new}`}>
                  {lead.status?.replace(/_/g, ' ')}
                </span>
              </div>
            </Link>
          )) : (
            <p className="text-sm text-content-muted py-8 text-center">No recent leads</p>
          )}
        </div>
      </Panel>

      <Panel title="Pending Approvals" link="/sales-manager/quotations/pending" delay={0.35}>
        <div className="space-y-3">
          {data.pendingApprovals?.length ? data.pendingApprovals.map((q) => (
            <div key={q._id} className="p-3 rounded-xl bg-surface-elevated/50 border border-subtle flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10"><FileCheck className="w-4 h-4 text-amber-600" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-content-primary">{q.quoteNumber}</p>
                <p className="text-xs text-content-muted">{q.customer} · {q.destination}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-content-primary">{formatCurrency(q.amount)}</p>
                <p className="text-xs text-emerald-600">{q.margin}% margin</p>
              </div>
            </div>
          )) : <p className="text-sm text-content-muted py-4 text-center">No pending approvals</p>}
        </div>
      </Panel>

      <Panel title="Upcoming Follow-ups" link="/sales-manager/follow-ups" delay={0.4}>
        <div className="space-y-2">
          {data.upcomingFollowups?.map((f) => (
            <div key={f._id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-elevated/50 transition-colors">
              <Clock className="w-4 h-4 text-violet-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-content-primary">{f.customer}</p>
                <p className="text-xs text-content-muted">{f.executive} · {f.destination}</p>
              </div>
              <span className="text-xs text-content-secondary tabular-nums">
                {new Date(f.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Team Ranking" link="/sales-manager/team" delay={0.45}>
        <div className="space-y-2">
          {data.teamRanking?.map((m, i) => (
            <div key={m.name} className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated/40 border border-subtle">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-amber-500/20 text-amber-600' : 'bg-surface-elevated text-content-muted'}`}>
                {i === 0 ? <Medal className="w-4 h-4" /> : m.rank}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-content-primary">{m.name}</p>
                <p className="text-xs text-content-muted">{m.conversions} conversions · {m.followUps} follow-ups</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums">{formatCurrency(m.revenue)}</p>
                <p className="text-xs text-emerald-600">{m.conversionRate}% CR</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Reactivated Lead Progress" link="/sales-manager/leads/all?filter=reactivated" delay={0.5}>
        <div className="space-y-2">
          {data.reactivationWidget?.liveProgress?.length ? data.reactivationWidget.liveProgress.map((lead) => (
            <div key={lead._id} className="p-3 rounded-xl border border-subtle bg-surface-elevated/40">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-content-primary truncate">{lead.name}</p>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-300">
                  {lead.stage?.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-content-muted mt-1">{lead.executive} · {new Date(lead.stageUpdatedAt).toLocaleString('en-IN')}</p>
            </div>
          )) : <p className="text-sm text-content-muted py-4 text-center">No reactivated leads yet</p>}
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, link, children, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/50"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-content-primary">{title}</h3>
        <Link to={link} className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1">
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {children}
    </motion.div>
  );
}
