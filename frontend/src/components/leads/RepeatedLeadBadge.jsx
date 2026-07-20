import { RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Prominent badge for leads whose phone already existed on an earlier enquiry.
 */
export default function RepeatedLeadBadge({ size = 'md', className }) {
  const sizes = {
    sm: 'px-1.5 py-0.5 text-[10px] gap-0.5',
    md: 'px-2.5 py-1 text-xs gap-1',
    lg: 'px-3 py-1.5 text-sm gap-1.5',
  };
  const iconSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-bold uppercase tracking-wide whitespace-nowrap',
        'bg-amber-500 text-white shadow-sm shadow-amber-500/30 ring-1 ring-amber-600/40',
        sizes[size] || sizes.md,
        className
      )}
      title="Same phone number already has an earlier lead"
    >
      <RefreshCw className={cn(iconSizes[size] || iconSizes.md, 'shrink-0')} />
      Repeated Lead
    </span>
  );
}
