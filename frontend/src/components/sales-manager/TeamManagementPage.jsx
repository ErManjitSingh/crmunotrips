import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, UsersRound, Network } from 'lucide-react';
import API from '../../api/axios';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import TeamCard from './teams/TeamCard';
import TeamFormModal from './teams/TeamFormModal';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';

const TEAMS_API = '/sales-manager/teams';

export default function TeamManagementPage() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdminView = user?.role === 'admin' || location.pathname.startsWith('/team/sales-teams');
  const canCreateTeam = user?.role !== 'lead_provider';
  const detailBase = isAdminView ? '/team/sales-teams' : '/sales-manager/teams';
  const [teams, setTeams] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const { confirm, dialogNode } = useConfirmDialog();

  const fetchTeams = () => {
    setLoading(true);
    Promise.all([
      API.get(TEAMS_API),
      API.get(`${TEAMS_API}/leaders`),
    ]).then(([t, l]) => {
      setTeams(t.data);
      setLeaders(l.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchTeams(); }, []);
  useDataRefresh(['teams', 'leads'], fetchTeams);

  const handleSave = async (payload) => {
    if (editTeam?._id) {
      await API.put(`${TEAMS_API}/${editTeam._id}`, payload);
    } else {
      if (!canCreateTeam) return;
      await API.post(TEAMS_API, payload);
    }
    setFormOpen(false);
    setEditTeam(null);
    fetchTeams();
  };

  const handleDelete = async (team) => {
    const ok = await confirm({
      title: 'Delete team?',
      message: `Delete team "${team.name}"? Members will become unassigned from this team.`,
      confirmLabel: 'Delete Team',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    await API.delete(`${TEAMS_API}/${team._id}`);
    fetchTeams();
  };

  const totalMembers = teams.reduce((s, t) => s + (t.stats?.membersCount ?? t.members?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description={
          canCreateTeam
            ? 'Create and manage sales teams — Manager → Team Leader → Executives. Assign executives to any team.'
            : 'View sales teams and members — Manager → Team Leader → Executives.'
        }
        breadcrumbs={[isAdminView ? 'Admin' : 'Sales Manager', 'Sales Teams']}
        actions={
          canCreateTeam ? (
            <Button onClick={() => { setEditTeam(null); setFormOpen(true); }} variant="gradient">
              <Plus className="w-4 h-4 mr-1.5" /> Create Team
            </Button>
          ) : null
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-r from-violet-600/10 via-brand-500/5 to-indigo-500/10 p-6"
      >
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-surface/80 text-violet-600"><Network className="w-6 h-6" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{teams.length}</p>
              <p className="text-sm text-content-secondary">Active Teams</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-surface/80 text-brand-600"><UsersRound className="w-6 h-6" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{totalMembers}</p>
              <p className="text-sm text-content-secondary">Total Executives</p>
            </div>
          </div>
          <div className="text-sm text-content-secondary ml-auto max-w-md">
            <p className="font-semibold text-content-primary mb-1">Hierarchy</p>
            <p>Sales Manager → Team → Team Leader → Sales Executive → Lead</p>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-9 h-9 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-subtle p-16 text-center">
          <UsersRound className="w-12 h-12 mx-auto text-content-muted mb-4 opacity-50" />
          <p className="text-content-muted mb-4">
            {canCreateTeam ? 'No teams yet. Create your first sales team.' : 'No sales teams found yet.'}
          </p>
          {canCreateTeam && (
            <Button onClick={() => setFormOpen(true)}><Plus className="w-4 h-4 mr-1" /> Create Team</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams.map((team, i) => (
            <TeamCard
              key={team._id}
              team={team}
              index={i}
              href={`${detailBase}/${team._id}`}
              onEdit={(t) => { setEditTeam(t); setFormOpen(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <TeamFormModal
        open={formOpen}
        team={editTeam}
        leaders={leaders}
        onClose={() => { setFormOpen(false); setEditTeam(null); }}
        onSave={handleSave}
      />
      {dialogNode}
    </div>
  );
}
