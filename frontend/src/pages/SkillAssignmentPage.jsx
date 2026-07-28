import { useCallback, useEffect, useState } from 'react';
import { Award, Users, Settings2, ScrollText, BarChart3, Save, RefreshCw } from 'lucide-react';
import API from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
import { Button } from '../components/ui/button';
import { toast } from '../context/ToastContext';
import { useDataRefresh } from '../hooks/useDataRefresh';
import { cn } from '../lib/utils';
import AutoAssignMasterToggle from '../components/assignment/AutoAssignOffBanner';

const TABS = [
  { id: 'skills', label: 'Skill Management', icon: Award },
  { id: 'mappings', label: 'Executive Skills', icon: Users },
  { id: 'queue', label: 'Sales Manager Queue', icon: Settings2 },
  { id: 'logs', label: 'Assignment Logs', icon: ScrollText },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

const SKILL_LABELS = { fit: 'FIT', group: 'Group', corporate: 'Corporate' };

export default function SkillAssignmentPage() {
  const [tab, setTab] = useState('skills');
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState([]);
  const [executives, setExecutives] = useState([]);
  const [managers, setManagers] = useState([]);
  const [skillDraft, setSkillDraft] = useState({});
  const [managerQueueIds, setManagerQueueIds] = useState([]);
  const [skillAutoEnabled, setSkillAutoEnabled] = useState(false);
  const [leadAutoAssignmentEnabled, setLeadAutoAssignmentEnabled] = useState(false);
  const [logs, setLogs] = useState([]);
  const [reports, setReports] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchAssignmentStatus = useCallback(
    () => API.get('/assignment/status', { skipSuccessToast: true }).then((r) => {
      setLeadAutoAssignmentEnabled(r.data?.leadAutoAssignmentEnabled === true);
    }),
    []
  );
  const fetchSkills = useCallback(
    () => API.get('/skill-assignment/skills', { skipSuccessToast: true }).then((r) => setSkills(r.data || [])),
    []
  );
  const fetchExecutives = useCallback(
    () => API.get('/skill-assignment/user-skills', { skipSuccessToast: true }).then((r) => {
      setExecutives(r.data || []);
      const draft = {};
      (r.data || []).forEach((row) => {
        draft[row.userId] = row.skills || [];
      });
      setSkillDraft(draft);
    }),
    []
  );
  const fetchManagers = useCallback(
    () => API.get('/users', { params: { role: 'sales_manager', status: 'active', limit: 100 }, skipSuccessToast: true })
      .then((r) => setManagers(r.data?.data || r.data || []))
      .catch(() => setManagers([])),
    []
  );
  const fetchSettings = useCallback(
    () => API.get('/skill-assignment/branch-settings', { skipSuccessToast: true }).then((r) => {
      setManagerQueueIds((r.data?.salesManagerQueueIds || []).map(String));
      setSkillAutoEnabled(r.data?.skillAutoAssignEnabled === true);
    }),
    []
  );
  const fetchLogs = useCallback(
    () => API.get('/skill-assignment/logs', { params: { limit: 25 }, skipSuccessToast: true }).then((r) => setLogs(r.data?.data || [])),
    []
  );
  const fetchReports = useCallback(
    () => API.get('/skill-assignment/reports', { skipSuccessToast: true }).then((r) => setReports(r.data)),
    []
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAssignmentStatus(),
        fetchSkills(),
        fetchExecutives(),
        fetchManagers(),
        fetchSettings(),
        fetchReports(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [fetchAssignmentStatus, fetchSkills, fetchExecutives, fetchManagers, fetchSettings, fetchReports]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (tab === 'logs') fetchLogs();
  }, [tab, fetchLogs]);

  useDataRefresh(['users', 'leads', 'team'], refreshAll);

  const toggleSkill = (userId, skillId) => {
    setSkillDraft((prev) => {
      const current = new Set(prev[userId] || []);
      if (current.has(skillId)) current.delete(skillId);
      else current.add(skillId);
      return { ...prev, [userId]: [...current] };
    });
  };

  const saveUserSkills = async (userId) => {
    setSaving(true);
    try {
      await API.put('/skill-assignment/user-skills', { userId, skills: skillDraft[userId] || [] });
      toast.success('Skills saved');
      fetchExecutives();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save skills');
    } finally {
      setSaving(false);
    }
  };

  const saveQueueSettings = async () => {
    setSaving(true);
    try {
      await API.put('/skill-assignment/branch-settings', {
        skillAutoAssignEnabled: skillAutoEnabled,
        salesManagerQueueIds: managerQueueIds,
      });
      toast.success('Sales manager queue saved');
      fetchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleManager = (id) => {
    const sid = String(id);
    setManagerQueueIds((prev) => (prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills Based Assignment"
        description="Skill rules and manager queue. Auto-assign runs on new leads; manual assign still works anytime."
        actions={
          <Button type="button" variant="outline" onClick={refreshAll} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      <AutoAssignMasterToggle
        enabled={leadAutoAssignmentEnabled}
        onChange={setLeadAutoAssignmentEnabled}
      />

      <div className="flex flex-wrap gap-2 border-b border-subtle pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors',
              tab === id ? 'bg-brand-600 text-white' : 'text-content-muted hover:text-content-primary'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'skills' && (
        <div className="grid sm:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <div key={skill.id} className="rounded-2xl border border-subtle bg-surface/80 p-5">
              <p className="text-lg font-bold text-content-primary">{skill.label}</p>
              <p className="text-sm text-content-muted mt-2">
                {skill.id === 'fit' && 'Individual and family leads'}
                {skill.id === 'group' && 'Group tours and 10+ pax leads'}
                {skill.id === 'corporate' && 'Business, MICE, and company travel'}
              </p>
            </div>
          ))}
          <div className="sm:col-span-3 rounded-2xl border border-dashed border-subtle p-4 text-sm text-content-muted">
            Lead type is auto-detected on create (pax count, corporate keywords) or selected manually in the lead form.
            Assignment order: match branch → match skill → active → present → lowest leads → round robin.
          </div>
        </div>
      )}

      {tab === 'mappings' && (
        <div className="space-y-4">
          {executives.map((row) => (
            <div key={row.userId} className="rounded-2xl border border-subtle bg-surface/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <p className="font-bold">{row.name}</p>
                  <p className="text-xs text-content-muted">{row.email}</p>
                </div>
                <Button size="sm" onClick={() => saveUserSkills(row.userId)} disabled={saving}>
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Save
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => {
                  const selected = (skillDraft[row.userId] || []).includes(skill.id);
                  return (
                    <button
                      key={skill.id}
                      type="button"
                      onClick={() => toggleSkill(row.userId, skill.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold border',
                        selected ? 'bg-brand-600 text-white border-brand-600' : 'border-subtle text-content-muted'
                      )}
                    >
                      {skill.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'queue' && (
        <div className="rounded-2xl border border-subtle bg-surface/80 p-5 max-w-xl space-y-4">
          <p className="text-sm text-content-muted">
            If no eligible executive with the required skill is present, the lead routes to the sales manager queue.
          </p>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={skillAutoEnabled}
              disabled={!leadAutoAssignmentEnabled}
              onChange={(e) => setSkillAutoEnabled(e.target.checked)}
            />
            Enable skill-based auto assignment for this branch
          </label>
          <div className="space-y-2">
            {managers.map((m) => (
              <label key={m._id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={managerQueueIds.includes(String(m._id))}
                  onChange={() => toggleManager(m._id)}
                />
                {m.name}
              </label>
            ))}
          </div>
          <Button onClick={saveQueueSettings} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            Save Queue
          </Button>
        </div>
      )}

      {tab === 'logs' && (
        <div className="rounded-2xl border border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated text-left text-xs text-content-muted">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="border-t border-subtle">
                  <td className="px-4 py-3">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{log.leadId?.name || '—'}</td>
                  <td className="px-4 py-3">{SKILL_LABELS[log.leadType] || log.leadType || '—'}</td>
                  <td className="px-4 py-3">{log.assigneeName || log.assignedTo?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-md', log.success ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-700')}>
                      {log.success ? log.assignmentType : 'failed'}
                    </span>
                    {!log.success && <span className="block text-xs text-content-muted mt-1">{log.reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'reports' && reports && (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-subtle p-4">
            <p className="text-xs text-content-muted">Total</p>
            <p className="text-2xl font-bold">{reports.total}</p>
          </div>
          <div className="rounded-2xl border border-subtle p-4">
            <p className="text-xs text-content-muted">Successful</p>
            <p className="text-2xl font-bold text-emerald-600">{reports.successful}</p>
          </div>
          <div className="rounded-2xl border border-subtle p-4">
            <p className="text-xs text-content-muted">Failed</p>
            <p className="text-2xl font-bold text-rose-600">{reports.failed}</p>
          </div>
          <div className="sm:col-span-2 rounded-2xl border border-subtle p-4">
            <h4 className="font-semibold mb-2">By Lead Type</h4>
            {(reports.byLeadType || []).map((row) => (
              <div key={row._id} className="flex justify-between text-sm py-1">
                <span>{SKILL_LABELS[row._id] || row._id}</span>
                <span className="font-semibold">{row.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
