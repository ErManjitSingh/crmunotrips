import { LOST_REASONS } from '../../constants/salesSop';

export default function LostReasonSelect({ value, onChange, className = '' }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Lost reason *
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-subtle bg-white p-3 text-sm"
      >
        <option value="">Select reason…</option>
        {LOST_REASONS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
    </div>
  );
}
