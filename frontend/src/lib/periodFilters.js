function toInputDate(d) {
  const x = new Date(d);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const LIST_PERIOD_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

export function applyPeriodPreset(key) {
  const now = new Date();
  if (key === 'all') return { dateFrom: '', dateTo: '' };
  if (key === 'today') {
    const day = toInputDate(now);
    return { dateFrom: day, dateTo: day };
  }
  if (key === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const day = toInputDate(y);
    return { dateFrom: day, dateTo: day };
  }
  if (key === 'month') {
    return {
      dateFrom: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      dateTo: toInputDate(now),
    };
  }
  return { dateFrom: '', dateTo: '' };
}

export function activePeriodPreset(filters = {}) {
  if (!filters.dateFrom && !filters.dateTo) return 'all';
  for (const { key } of LIST_PERIOD_PRESETS) {
    if (key === 'all') continue;
    const preset = applyPeriodPreset(key);
    if (filters.dateFrom === preset.dateFrom && filters.dateTo === preset.dateTo) {
      return key;
    }
  }
  return null;
}

/** Append dashboard period (and source) onto a KPI path. */
export function withPeriodParams(path, filters = {}) {
  if (!path) return path;
  const qIndex = String(path).indexOf('?');
  const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const params = new URLSearchParams(qIndex >= 0 ? path.slice(qIndex + 1) : '');
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  else params.delete('dateFrom');
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  else params.delete('dateTo');
  if (filters.source) params.set('source', filters.source);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
