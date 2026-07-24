import { useEffect, useState } from 'react';
import { Clock3, CheckCircle2 } from 'lucide-react';
import API from '../../api/axios';
import { Button } from '../ui/button';
import { LEAD_ACCEPT_MINUTES } from '../../constants/salesSop';

function secondsLeft(deadline) {
  if (!deadline) return 0;
  return Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
}

export default function LeadAcceptBanner({ lead, onAccepted }) {
  const [left, setLeft] = useState(() => secondsLeft(lead?.assignmentAcceptBy));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLeft(secondsLeft(lead?.assignmentAcceptBy));
    if (lead?.assignmentAcceptance !== 'pending') return undefined;
    const t = setInterval(() => setLeft(secondsLeft(lead?.assignmentAcceptBy)), 1000);
    return () => clearInterval(t);
  }, [lead?.assignmentAcceptBy, lead?.assignmentAcceptance]);

  if (!lead || lead.assignmentAcceptance !== 'pending') return null;

  const mins = Math.floor(left / 60);
  const secs = left % 60;
  const urgent = left <= 30;

  const handleAccept = async () => {
    setSaving(true);
    setError('');
    try {
      const { data } = await API.post(`/sales-executive/leads/${lead._id}/accept`);
      onAccepted?.(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Accept failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
        urgent
          ? 'border-red-300 bg-red-50 text-red-900'
          : 'border-amber-300 bg-amber-50 text-amber-950'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-bold">Accept this lead within {LEAD_ACCEPT_MINUTES} minutes</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium opacity-90">
          <Clock3 className="h-3.5 w-3.5" />
          Time left: {mins}:{String(secs).padStart(2, '0')}
          {left === 0 ? ' — expiring, will auto-reassign' : ''}
        </p>
        {error && <p className="mt-1 text-xs font-semibold text-red-700">{error}</p>}
      </div>
      <Button
        type="button"
        onClick={handleAccept}
        disabled={saving || left === 0}
        className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <CheckCircle2 className="mr-1.5 h-4 w-4" />
        {saving ? 'Accepting…' : 'Accept lead'}
      </Button>
    </div>
  );
}
