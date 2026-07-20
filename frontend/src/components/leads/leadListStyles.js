import { cn } from '../../lib/utils';

/** Shared chrome for all CRM lead lists (admin / manager / leader / executive). */
export const LEAD_LIST_CONTAINER =
  'rounded-2xl border border-subtle bg-white shadow-sm overflow-hidden';

export const LEAD_LIST_TH =
  'text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap bg-slate-50 border-b border-subtle';

export const LEAD_LIST_TD = 'px-3 py-3.5 align-middle text-sm border-b border-slate-100';

export const LEAD_LIST_ROW_HOVER = 'hover:bg-sky-100/80 transition-colors';

export function leadListRowBg(index) {
  return index % 2 === 0 ? 'bg-sky-50' : 'bg-white';
}

export function leadListRowClass(index, extra) {
  return cn(leadListRowBg(index), LEAD_LIST_ROW_HOVER, extra);
}
