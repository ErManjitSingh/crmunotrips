import { Phone } from 'lucide-react';
import { formatCallDuration } from '../../lib/callSession';
import { cn } from '../../lib/utils';

export default function LeadCallStats({ lead, className, compact = false }) {
  const count = Number(lead?.callStats?.count || 0);
  const totalSeconds = Number(lead?.callStats?.totalDurationSeconds || 0);
  if (!count) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 text-sky-700',
        compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-1 text-[10px]',
        className
      )}
      title={`${count} call(s) · ${formatCallDuration(totalSeconds)} total`}
    >
      {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
        <Phone key={i} className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      ))}
      {count > 5 && <span className="font-bold">+{count - 5}</span>}
      <span className="font-bold tabular-nums">{count}x</span>
      <span className="opacity-80">·</span>
      <span className="font-semibold tabular-nums">{formatCallDuration(totalSeconds)}</span>
    </div>
  );
}
