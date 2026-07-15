import { Check, Trophy } from 'lucide-react';
import { normalizeLeadStatus } from '../../utils/leadUtils';
import { PIPELINE_STAGES } from './leadDetailData';
import { DETAIL_CARD } from './leadDetailUtils';
import { cn } from '../../lib/utils';

export default function LeadStatusPipeline({ status }) {
  const current = normalizeLeadStatus(status);
  const currentIdx = PIPELINE_STAGES.findIndex((s) => s.value === current);

  return (
    <div className={cn(DETAIL_CARD, 'p-4 sm:p-5 mb-5')}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-4">Lead Pipeline</p>
      <div className="flex items-start overflow-x-auto gap-0 pb-1 scrollbar-thin">
        {PIPELINE_STAGES.map((stage, i) => {
          const done = i < currentIdx && currentIdx >= 0;
          const active = stage.value === current;
          const isConverted = stage.value === 'converted' && active;

          return (
            <div key={stage.value} className="flex items-start flex-1 min-w-[76px]">
              <div className="flex flex-col items-center flex-1 px-1">
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all shrink-0',
                    isConverted && 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-500/35 ring-4 ring-violet-100',
                    active && !isConverted && 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-500/30',
                    done && !active && 'bg-emerald-500 border-emerald-500 text-white',
                    !done && !active && 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-700'
                  )}
                >
                  {isConverted ? (
                    <Trophy className="w-4 h-4" />
                  ) : done ? (
                    <Check className="w-4 h-4" strokeWidth={2.5} />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[9px] sm:text-[10px] mt-2 font-semibold text-center leading-tight',
                    active ? 'text-violet-700 dark:text-violet-300' : done ? 'text-emerald-700' : 'text-slate-400'
                  )}
                >
                  {stage.shortLabel || stage.label}
                </span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mt-[18px] min-w-[8px] max-w-[24px]',
                    i < currentIdx ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
