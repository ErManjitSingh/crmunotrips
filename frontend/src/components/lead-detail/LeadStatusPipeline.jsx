import { Check, Trophy } from 'lucide-react';
import { getLeadListStatusDisplay } from '../../lib/executiveStatusDisplay';
import { PIPELINE_STAGES } from './leadDetailData';
import { DETAIL_CARD } from './leadDetailUtils';
import { cn } from '../../lib/utils';

export default function LeadStatusPipeline({ status, lead }) {
  const resolved = lead || { status };
  const display = getLeadListStatusDisplay(resolved);
  const coldToWarm = display.subLabel === 'Cold to Warm' || display.mainLabel === 'Working in Progress';
  const current =
    display.bucket === 'converted'
      ? 'converted'
      : coldToWarm
        ? 'working'
        : display.bucket === 'hot'
          ? 'hot'
          : display.bucket === 'cold'
            ? 'cold'
            : display.bucket === 'warm'
              ? 'warm'
              : '';
  const currentIdx = PIPELINE_STAGES.findIndex((s) => s.value === current);

  return (
    <div className={cn(DETAIL_CARD, 'p-4 sm:p-5 mb-5')}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-4">Lead Status</p>
      <div className="flex items-start overflow-x-auto gap-0 pb-1 scrollbar-thin">
        {PIPELINE_STAGES.map((stage, i) => {
          const done = currentIdx >= 0 && i < currentIdx;
          const active = stage.value === current;
          const isConverted = stage.value === 'converted' && active;

          return (
            <div key={stage.value} className="flex items-start flex-1 min-w-[76px]">
              <div className="flex flex-col items-center flex-1 px-1">
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all shrink-0',
                    isConverted && 'bg-violet-600 border-violet-600 text-white shadow-md shadow-violet-500/35 ring-4 ring-violet-100',
                    active && !isConverted && stage.value === 'hot' && 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-500/30',
                    active && !isConverted && stage.value === 'warm' && 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/30',
                    active && !isConverted && stage.value === 'working' && 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/30',
                    active && !isConverted && stage.value === 'cold' && 'bg-slate-600 border-slate-600 text-white shadow-md shadow-slate-500/30',
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
                    currentIdx >= 0 && i < currentIdx ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      {display.label && display.bucket !== 'new' ? (
        <p className="mt-3 text-xs font-medium text-slate-600">
          Status: <span className="text-content-primary">{display.label}</span>
          {display.categoryLabel && display.categoryLabel !== display.label ? (
            <span className="text-slate-400"> · {display.categoryLabel}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
