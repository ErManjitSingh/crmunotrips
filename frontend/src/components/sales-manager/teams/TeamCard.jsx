import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Crown, Users, Target, Trophy, IndianRupee, ChevronRight } from 'lucide-react';
import Avatar from '../../ui/Avatar';
import { formatCurrency } from './teamUtils';

export default function TeamCard({ team, index = 0, onEdit, onDelete, href }) {
  const { stats } = team;
  const detailHref = href || `/sales-manager/teams/${team._id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="group relative overflow-hidden rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl hover:border-violet-500/25 transition-colors"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.06] via-transparent to-brand-500/[0.04] opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-bold text-content-primary">{team.name}</h3>
            <p className="text-xs text-content-muted mt-1 line-clamp-2">{team.description || 'No description'}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button type="button" onClick={() => onEdit?.(team)} className="text-xs font-medium text-violet-600 hover:text-violet-500 px-2 py-1 rounded-lg hover:bg-violet-500/10">Edit</button>
            <button type="button" onClick={() => onDelete?.(team)} className="text-xs font-medium text-rose-600 hover:text-rose-500 px-2 py-1 rounded-lg hover:bg-rose-500/10">Delete</button>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated/50 border border-subtle mb-4">
          <Avatar name={team.teamLeader?.name} size="sm" className="ring-2 ring-violet-500/20" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted flex items-center gap-1">
              <Crown className="w-3 h-3 text-amber-500" /> Team Leader
            </p>
            <p className="text-sm font-semibold text-content-primary truncate">{team.teamLeader?.name}</p>
          </div>
          <span className="text-xs font-bold text-content-secondary flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {stats?.membersCount ?? team.members?.length ?? 0}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { icon: Target, label: 'Leads', value: stats?.leadsAssigned ?? 0 },
            { icon: Trophy, label: 'Conv.', value: stats?.conversions ?? 0 },
            { icon: IndianRupee, label: 'Revenue', value: formatCurrency(stats?.revenue ?? 0), small: true },
          ].map(({ icon: Icon, label, value, small }) => (
            <div key={label} className="p-2.5 rounded-xl bg-surface-elevated/40 border border-subtle/80 text-center">
              <Icon className="w-3.5 h-3.5 mx-auto mb-1 text-violet-500" />
              <p className={`font-bold tabular-nums text-content-primary ${small ? 'text-[11px]' : 'text-sm'}`}>{value}</p>
              <p className="text-[9px] font-semibold uppercase text-content-muted">{label}</p>
            </div>
          ))}
        </div>

        <Link
          to={detailHref}
          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl text-sm font-semibold text-violet-600 bg-violet-500/10 hover:bg-violet-500/15 ring-1 ring-violet-500/20 transition-colors"
        >
          Manage Team <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </motion.div>
  );
}
