import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';

export function ExecutiveStallIndicator({ lead, className }) {
  if (!lead?.executiveStallActive) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold',
              'bg-rose-500/15 text-rose-700 dark:text-rose-400 ring-1 ring-rose-500/30 cursor-help',
              className
            )}
          >
            <AlertTriangle className="w-3 h-3 shrink-0" />
            No follow-up
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-left leading-relaxed">
          {lead.executiveStallReason || 'Executive has not viewed this lead in 20+ minutes and no follow-up has been added.'}
          <span className="block mt-1 text-content-muted font-normal">
            This alert clears when the executive adds a follow-up.
          </span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function executiveStallRowClass(lead) {
  if (!lead?.executiveStallActive) return '';
  return 'bg-rose-50/80 dark:bg-rose-950/25 hover:bg-rose-100/80 dark:hover:bg-rose-950/40 ring-1 ring-inset ring-rose-500/20';
}
