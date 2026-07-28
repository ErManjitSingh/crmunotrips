import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Users, Settings2, ScrollText, BarChart3, Plus, Save, RefreshCw } from 'lucide-react';
import API from '../api/axios';
import PageHeader from '../components/ui/PageHeader';
import { Button } from '../components/ui/button';
import { toast } from '../context/ToastContext';
import { useDataRefresh } from '../hooks/useDataRefresh';
import { cn } from '../lib/utils';
import AutoAssignMasterToggle from '../components/assignment/AutoAssignOffBanner';

const TABS = [
  { id: 'destinations', label: 'Destination Master', icon: MapPin },
  { id: 'mappings', label: 'User Mapping', icon: Users },
  { id: 'fallback', label: 'Fallback Queue', icon: Settings2 },
  { id: 'logs', label: 'Assignment Logs', icon: ScrollText },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

function Field({ label, children, className }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-semibold text-content-muted">{label}</span>
      {children}
    </label>
  );
}

export default function DestinationAssignmentPage() {
  const [tab, setTab] = useState('destinations');
  const [loading, setLoading] = useState(true);
  const [destinations, setDestinations] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [branchSettings, setBranchSettings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsPagination, setLogsPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [reports, setReports] = useState(null);
  const [newDest, setNewDest] = useState({ name: '', aliases: '' });
  const [editingDest, setEditingDest] = useState(null);
  const [mappingDraft, setMappingDraft] = useState({});
  const [fallbackIds, setFallbackIds] = useState([]);
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [leadAutoAssignmentEnabled, setLeadAutoAssignmentEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAssignmentStatus = useCallback(
    () => API.get('/assignment/status', { skipSuccessToast: true }).then((r) => {
      setLeadAutoAssignmentEnabled(r.data?.leadAutoAssignmentEnabled === true);
    }),
    []
  );

  const fetchDestinations = useCallback(
    () => API.get('/destination-assignment/destinations', { skipSuccessToast: true }).then((r) => setDestinations(r.data || [])),
    []
  );
  const fetchMappings = useCallback(
    () => API.get('/destination-assignment/user-mappings', { skipSuccessToast: true }).then((r) => {
      setMappings(r.data || []);
      const draft = {};
      (r.data || []).forEach((row) => {
        draft[row.userId] = (row.destinations || []).map((d) => d._id);
      });
      setMappingDraft(draft);
    }),
    []
  );
  const fetchBranchSettings = useCallback(
    () => API.get('/destination-assignment/branch-settings', { skipSuccessToast: true }).then((r) => {
      setBranchSettings(r.data);
      setFallbackIds((r.data?.fallbackUserIds || []).map(String));
      setAutoAssignEnabled(r.data?.autoAssignEnabled === true);
    }),
    []
  );
  const fetchLogs = useCallback(() => {
    const params = { page: logsPagination.page, limit: logsPagination.limit };
    return API.get('/destination-assignment/logs', { params, skipSuccessToast: true }).then((r) => {
      setLogs(r.data?.data || []);
      setLogsPagination((prev) => ({ ...prev, ...(r.data?.pagination || {}) }));
    });
  }, [logsPagination.page, logsPagination.limit]);
  const fetchReports = useCallback(
    () => API.get('/destination-assignment/reports', { skipSuccessToast: true }).then((r) => setReports(r.data)),
    []
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchAssignmentStatus(),
        fetchDestinations(),
        fetchMappings(),
        fetchBranchSettings(),
        fetchReports(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [fetchAssignmentStatus, fetchDestinations, fetchMappings, fetchBranchSettings, fetchReports]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (tab === 'logs') fetchLogs();
  }, [tab, fetchLogs]);

  useDataRefresh(['users', 'leads', 'team'], refreshAll);

  const activeDestinations = useMemo(
    () => destinations.filter((d) => d.status === 'active'),
    [destinations]
  );

  const handleCreateDestination = async (e) => {
    e.preventDefault();
    if (!newDest.name.trim()) return;
    setSaving(true);
    try {
      await API.post('/destination-assignment/destinations', {
        name: newDest.name.trim(),
        aliases: newDest.aliases
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setNewDest({ name: '', aliases: '' });
      toast.success('Destination created');
      fetchDestinations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create destination');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDestination = async () => {
    if (!editingDest) return;
    setSaving(true);
    try {
      await API.put(`/destination-assignment/destinations/${editingDest._id}`, {
        name: editingDest.name,
        aliases: editingDest.aliasesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        status: editingDest.status,
      });
      setEditingDest(null);
      toast.success('Destination updated');
      fetchDestinations();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update destination');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMapping = async (userId) => {
    setSaving(true);
    try {
      await API.put('/destination-assignment/user-mappings', {
        userId,
        destinationIds: mappingDraft[userId] || [],
      });
      toast.success('Destination expertise saved');
      fetchMappings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save mapping');
    } finally {
      setSaving(false);
    }
  };

  const toggleMappingDest = (userId, destId) => {
    setMappingDraft((prev) => {
      const current = new Set(prev[userId] || []);
      if (current.has(destId)) current.delete(destId);
      else current.add(destId);
      return { ...prev, [userId]: [...current] };
    });
  };

  const handleSaveFallback = async () => {
    setSaving(true);
    try {
      await API.put('/destination-assignment/branch-settings', {
        autoAssignEnabled,
        fallbackUserIds: fallbackIds,
      });
      toast.success('Branch assignment settings saved');
      fetchBranchSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleFallbackUser = (userId) => {
    const id = String(userId);
    setFallbackIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Destination Assignment"
        description="Map destinations to executives. Auto-assign routes new leads; manual assign still works anytime."
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
              tab === id
                ? 'bg-brand-600 text-white'
                : 'text-content-muted hover:text-content-primary hover:bg-surface-elevated'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'destinations' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <form onSubmit={handleCreateDestination} className="rounded-2xl border border-subtle bg-surface/80 p-5 space-y-4">
            <h3 className="font-bold text-content-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Destination
            </h3>
            <Field label="Name">
              <input
                className="w-full h-10 px-3 rounded-xl border border-subtle bg-surface"
                value={newDest.name}
                onChange={(e) => setNewDest((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Leh Ladakh"
              />
            </Field>
            <Field label="Aliases (comma separated)">
              <input
                className="w-full h-10 px-3 rounded-xl border border-subtle bg-surface"
                value={newDest.aliases}
                onChange={(e) => setNewDest((p) => ({ ...p, aliases: e.target.value }))}
                placeholder="Ladakh, Leh"
              />
            </Field>
            <Button type="submit" disabled={saving}>Create</Button>
          </form>

          <div className="rounded-2xl border border-subtle bg-surface/80 p-5 space-y-3 max-h-[520px] overflow-y-auto">
            <h3 className="font-bold text-content-primary">Destination Master ({activeDestinations.length})</h3>
            {activeDestinations.map((d) => (
              <div key={d._id} className="p-3 rounded-xl border border-subtle bg-surface">
                {editingDest?._id === d._id ? (
                  <div className="space-y-2">
                    <input
                      className="w-full h-9 px-2 rounded-lg border border-subtle"
                      value={editingDest.name}
                      onChange={(e) => setEditingDest((p) => ({ ...p, name: e.target.value }))}
                    />
                    <input
                      className="w-full h-9 px-2 rounded-lg border border-subtle"
                      value={editingDest.aliasesText}
                      onChange={(e) => setEditingDest((p) => ({ ...p, aliasesText: e.target.value }))}
                      placeholder="aliases, comma separated"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleUpdateDestination} disabled={saving}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingDest(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-semibold text-content-primary">{d.name}</p>
                    {d.aliases?.length > 0 && (
                      <p className="text-xs text-content-muted mt-1">Aliases: {d.aliases.join(', ')}</p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() =>
                        setEditingDest({
                          ...d,
                          aliasesText: (d.aliases || []).join(', '),
                        })
                      }
                    >
                      Edit
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'mappings' && (
        <div className="space-y-4">
          <p className="text-sm text-content-muted">
            Assign destination expertise to sales executives. With auto-assign ON, new leads route to a present specialist with the lowest active lead count. You can still assign manually anytime.
          </p>
          {mappings.map((row) => (
            <div key={row.userId} className="rounded-2xl border border-subtle bg-surface/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <p className="font-bold text-content-primary">{row.name}</p>
                  <p className="text-xs text-content-muted">{row.email}</p>
                </div>
                <Button size="sm" onClick={() => handleSaveMapping(row.userId)} disabled={saving}>
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Save
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeDestinations.map((dest) => {
                  const selected = (mappingDraft[row.userId] || []).includes(dest._id);
                  return (
                    <button
                      key={dest._id}
                      type="button"
                      onClick={() => toggleMappingDest(row.userId, dest._id)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                        selected
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'border-subtle text-content-muted hover:border-brand-400'
                      )}
                    >
                      {dest.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!mappings.length && !loading && (
            <p className="text-sm text-content-muted text-center py-8">No active sales executives in this branch.</p>
          )}
        </div>
      )}

      {tab === 'fallback' && (
        <div className="rounded-2xl border border-subtle bg-surface/80 p-5 space-y-4 max-w-2xl">
          <h3 className="font-bold text-content-primary">Branch Fallback Queue</h3>
          <p className="text-sm text-content-muted">
            When no destination specialist is available, leads assign from this queue using the same rules (active, present, lowest leads, round robin).
          </p>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={autoAssignEnabled}
              disabled={!leadAutoAssignmentEnabled}
              onChange={(e) => setAutoAssignEnabled(e.target.checked)}
            />
            Enable destination auto-assignment for this branch
          </label>
          <div className="space-y-2">
            {mappings.map((row) => (
              <label key={row.userId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={fallbackIds.includes(String(row.userId))}
                  onChange={() => toggleFallbackUser(row.userId)}
                />
                {row.name}
              </label>
            ))}
          </div>
          <Button onClick={handleSaveFallback} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            Save Fallback Settings
          </Button>
          {branchSettings?.fallbackUsers?.length > 0 && (
            <p className="text-xs text-content-muted">
              Current queue: {branchSettings.fallbackUsers.map((u) => u.name).join(' → ')}
            </p>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="rounded-2xl border border-subtle bg-surface/80 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated text-left text-xs text-content-muted">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id} className="border-t border-subtle">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    {log.leadId?.name || '—'}
                    <span className="block text-xs text-content-muted">{log.leadDestination}</span>
                  </td>
                  <td className="px-4 py-3">{log.destinationName || '—'}</td>
                  <td className="px-4 py-3">{log.assigneeName || log.assignedTo?.name || '—'}</td>
                  <td className="px-4 py-3">{log.assignmentType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-md',
                        log.success ? 'bg-emerald-500/10 text-emerald-700' : 'bg-rose-500/10 text-rose-700'
                      )}
                    >
                      {log.success ? 'Success' : 'Failed'}
                    </span>
                    {!log.success && log.reason && (
                      <span className="block text-xs text-content-muted mt-1">{log.reason}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logs.length && !loading && (
            <p className="text-center text-sm text-content-muted py-8">No assignment logs yet.</p>
          )}
        </div>
      )}

      {tab === 'reports' && reports && (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-subtle bg-surface/80 p-4">
            <p className="text-xs text-content-muted">Total Assignments</p>
            <p className="text-2xl font-bold text-content-primary">{reports.total}</p>
          </div>
          <div className="rounded-2xl border border-subtle bg-surface/80 p-4">
            <p className="text-xs text-content-muted">Successful</p>
            <p className="text-2xl font-bold text-emerald-600">{reports.successful}</p>
          </div>
          <div className="rounded-2xl border border-subtle bg-surface/80 p-4">
            <p className="text-xs text-content-muted">Failed</p>
            <p className="text-2xl font-bold text-rose-600">{reports.failed}</p>
          </div>
          <div className="sm:col-span-2 rounded-2xl border border-subtle bg-surface/80 p-4">
            <h4 className="font-semibold mb-2">By Assignment Type</h4>
            <ul className="space-y-1 text-sm">
              {(reports.byType || []).map((row) => (
                <li key={row._id} className="flex justify-between">
                  <span>{row._id}</span>
                  <span className="font-semibold">{row.count} ({row.success} ok)</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-subtle bg-surface/80 p-4">
            <h4 className="font-semibold mb-2">Top Destinations</h4>
            <ul className="space-y-1 text-sm">
              {(reports.byDestination || []).map((row) => (
                <li key={row._id} className="flex justify-between">
                  <span>{row._id}</span>
                  <span className="font-semibold">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
