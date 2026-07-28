import { formatFullDateTime } from './whatsappUtils';

function MetaRow({ label, value, highlight }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">{label}</p>
      <p className={`text-xs text-right ${highlight ? 'text-emerald-600 font-semibold' : 'text-slate-700'}`}>
        {value || '—'}
      </p>
    </div>
  );
}

export default function WhatsAppFollowUpPanel({ lead, followups }) {
  const next = followups?.find((f) => f.status !== 'completed') || followups?.[0];

  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-violet-600/80">
        Follow-ups
      </h4>
      <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
        <MetaRow
          label="Next follow-up"
          value={next ? formatFullDateTime(next.scheduledAt) : null}
          highlight={Boolean(next)}
        />
        <MetaRow label="Lead status" value={lead?.status?.replace(/_/g, ' ')} />
      </div>

      {followups?.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">History</p>
          {followups.slice(0, 8).map((f) => (
            <div
              key={f._id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-100 text-xs"
            >
              <span className="text-slate-600 truncate flex-1">{f.remarks || f.notes || f.category || f.type}</span>
              <span className="text-[10px] text-slate-400 shrink-0">{formatFullDateTime(f.scheduledAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
