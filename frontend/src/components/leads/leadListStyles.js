import { cn } from '../../lib/utils';

/** Shared chrome for all CRM lead lists (admin / manager / leader / executive). */
export const LEAD_LIST_CONTAINER =
  'rounded-2xl border border-subtle bg-white shadow-sm overflow-hidden';

export const LEAD_LIST_TH =
  'text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap bg-slate-50 border-b border-subtle';

export const LEAD_LIST_TD = 'px-3 py-3.5 align-middle text-sm border-b border-slate-100';

export const LEAD_LIST_ROW_HOVER = 'hover:bg-sky-100/80 transition-colors';

export function leadListRowBg(index, status) {
  if (status === 'converted') {
    return 'bg-emerald-50 hover:bg-emerald-100/80';
  }
  return index % 2 === 0 ? 'bg-sky-50' : 'bg-white';
}

export function leadListStickyBg(index, status) {
  if (status === 'converted') {
    return 'bg-emerald-50 group-hover:bg-emerald-100/80';
  }
  return index % 2 === 0
    ? 'bg-sky-50 group-hover:bg-sky-100/80'
    : 'bg-white group-hover:bg-sky-100/80';
}

export function leadListRowClass(index, extra, status) {
  return cn(leadListRowBg(index, status), LEAD_LIST_ROW_HOVER, extra);
}
