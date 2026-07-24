import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Crown, UserPlus, UserMinus, ArrowRightLeft, Pencil, Target, Trophy, IndianRupee } from 'lucide-react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import Avatar from '../ui/Avatar';
import TeamFormModal from './teams/TeamFormModal';
import TeamMemberModal from './teams/TeamMemberModal';
import { formatCurrency } from './teams/teamUtils';

export default function TeamDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const isAdminView = user?.role === 'admin' || location.pathname.startsWith('/team/sales-teams');
  const listPath = isAdminView ? '/team/sales-teams' : '/sales-manager/teams';
  const [team, setTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [availableExecutives, setAvailableExecutives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [memberModal, setMemberModal] = useState({ open: false, mode: null, member: null });

  const fetchTeam = () => {
    setLoading(true);
    Promise.all([
      API.get(`/sales-manager/teams/${id}`),
      API.get('/sales-manager/teams'),
      API.get('/sales-manager/teams/leaders'),
      API.get('/sales-manager/teams/available-executives'),
    ]).then(([t, all, l, avail]) => {
      setTeam(t.data);
      setTeams(all.data);
      setLeaders(l.data);
      setAvailableExecutives(avail.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchTeam(); }, [id]);

  const handleEdit = async (payload) => {
    await API.put(`/sales-manager/teams/${id}`, payload);
    setEditOpen(false);
    fetchTeam();
  };

  const handleMemberAction = async (payload) => {
    const { mode } = memberModal;
    if (mode === 'add') await API.post(`/sales-manager/teams/${id}/members`, payload);
    if (mode === 'remove') await API.delete(`/sales-manager/teams/${id}/members/${payload.executiveId}`);
    if (mode === 'transfer') await API.put(`/sales-manager/teams/${id}/transfer`, payload);
    if (mode === 'leader') await API.put(`/sales-manager/teams/${id}/leader`, payload);
    setMemberModal({ open: false, mode: null, member: null });
    fetchTeam();
  };

  if (loading) return <div className="flex justify-center py-32"><div className="w-9 h-9 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!team) return <div className="text-center py-20 text-content-muted">Team not found</div>;

  const { stats } = team;

  return (
    <div className="space-y-6 pb-8">
      <Link to={listPath} className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-500">
        <ArrowLeft className="w-4 h-4" /> Back to Teams
      </Link>

      <PageHeader
        title={team.name}
        description={team.description || 'Team details and member management — assign executives to this team'}
        breadcrumbs={[isAdminView ? 'Admin' : 'Sales Manager', 'Sales Teams', team.name]}
        actions={
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="w-4 h-4 mr-1" /> Edit Team
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Target, label: 'Leads Assigned', value: stats?.leadsAssigned ?? 0 },
          { icon: Trophy, label: 'Conversions', value: stats?.conversions ?? 0 },
          { icon: IndianRupee, label: 'Revenue', value: formatCurrency(stats?.revenue ?? 0), small: true },
          { icon: Crown, label: 'Members', value: stats?.membersCount ?? team.members?.length ?? 0 },
        ].map(({ icon: Icon, label, value, small }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-subtle bg-surface/80 p-4">
            <Icon className="w-4 h-4 text-violet-500 mb-2" />
            <p className={`font-bold tabular-nums ${small ? 'text-sm' : 'text-xl'}`}>{value}</p>
            <p className="text-[10px] font-semibold uppercase text-content-muted mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 rounded-2xl border border-subtle bg-surface/80 p-5">
          <h3 className="font-bold text-content-primary mb-4 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Team Leader</h3>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20">
            <Avatar name={team.teamLeader?.name} size="md" className="ring-2 ring-amber-500/30" />
            <div>
              <p className="font-bold text-content-primary">{team.teamLeader?.name}</p>
              <p className="text-xs text-content-muted">{team.teamLeader?.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => setMemberModal({ open: true, mode: 'leader', member: null })}>
            Change Team Leader
          </Button>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-subtle bg-surface/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-content-primary">Team Executives ({team.members?.length ?? 0})</h3>
            <Button size="sm" onClick={() => setMemberModal({ open: true, mode: 'add', member: null })}>
              <UserPlus className="w-3.5 h-3.5 mr-1" /> Add Executive
            </Button>
          </div>
          <div className="divide-y divide-subtle">
            {!team.members?.length ? (
              <p className="py-8 text-center text-sm text-content-muted">No executives in this team yet.</p>
            ) : team.members.map((m, i) => (
              <motion.div key={m._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="py-4 flex items-center gap-4">
                <Avatar name={m.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-content-primary">{m.name}</p>
                  <p className="text-xs text-content-muted">{m.email}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setMemberModal({ open: true, mode: 'transfer', member: m })} title="Transfer">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-500" onClick={() => setMemberModal({ open: true, mode: 'remove', member: m })} title="Remove">
                    <UserMinus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <TeamFormModal open={editOpen} team={team} leaders={leaders} onClose={() => setEditOpen(false)} onSave={handleEdit} />
      <TeamMemberModal
        open={memberModal.open}
        mode={memberModal.mode}
        member={memberModal.member}
        team={team}
        teams={teams}
        availableExecutives={availableExecutives}
        leaders={leaders}
        onClose={() => setMemberModal({ open: false, mode: null, member: null })}
        onConfirm={handleMemberAction}
      />
    </div>
  );
}
