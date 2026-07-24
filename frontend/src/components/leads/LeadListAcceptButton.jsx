import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3 } from 'lucide-react';
import API from '../../api/axios';
import { LEAD_ACCEPT_MINUTES } from '../../constants/salesSop';
import { cn } from '../../lib/utils';

function secondsLeft(deadline) {
  if (!deadline) return 0;
  return Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000));
}

/** Compact Accept control for lead list Actions column (replaces Assign for pending). */
export default function LeadListAcceptButton({ lead, onAccepted, onExpired, className }) {
  const [left, setLeft] = useState(() => secondsLeft(lead?.assignmentAcceptBy));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLeft(secondsLeft(lead?.assignmentAcceptBy));
    if (lead?.assignmentAcceptance !== 'pending') return undefined;
    const t = setInterval(() => {
      const next = secondsLeft(lead?.assignmentAcceptBy);
      setLeft(next);
      if (next === 0) onExpired?.(lead);
    }, 1000);
    return () => clearInterval(t);
  }, [lead, lead?.assignmentAcceptBy, lead?.assignmentAcceptance, onExpired]);

  if (!lead || lead.assignmentAcceptance !== 'pending') return null;

  const mins = Math.floor(left / 60);
  const secs = left % 60;
  const urgent = left <= 30;

  const handleAccept = async (e) => {
    e?.stopPropagation?.();
    if (saving || left === 0) return;
    setSaving(true);
    try {
      const { data } = await API.post(`/sales-executive/leads/${lead._id}/accept`);
      onAccepted?.(data);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Accept failed';
      if (/expired|pool/i.test(msg)) onExpired?.(lead);
      else window.alert?.(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleAccept}
      onPointerDown={(e) => e.stopPropagation()}
      disabled={saving || left === 0}
      title={`Accept within ${LEAD_ACCEPT_MINUTES} min`}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-l-xl px-2.5 text-[11px] font-semibold text-white',
        'active:scale-[0.98] transition-all shadow-inner shadow-white/10',
        urgent
          ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700'
          : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700',
        'hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed',
        className
      )}
    >
      {left === 0 ? (
        <Clock3 className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className="whitespace-nowrap">
        {saving ? '…' : left === 0 ? 'Expired' : `Accept ${mins}:${String(secs).padStart(2, '0')}`}
      </span>
    </button>
  );
}

export function NotAcceptedChip({ lead, className }) {
  if (lead?.assignmentAcceptance !== 'expired') return null;
  const who = lead.acceptanceMissedName ? ` · ${lead.acceptanceMissedName}` : '';
  return (
    <span
      title={`Lead was not accepted within ${LEAD_ACCEPT_MINUTES} minutes${who}`}
      className={cn(
        'inline-flex h-8 max-w-[140px] items-center gap-1 rounded-l-xl border border-r-0 border-amber-500/40',
        'bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-transparent pl-2 pr-2',
        'text-[10px] font-bold uppercase tracking-wide text-amber-800',
        className
      )}
    >
      Not accepted
    </span>
  );
}
