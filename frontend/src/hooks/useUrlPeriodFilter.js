import { useSearchParams } from 'react-router-dom';
import { applyPeriodPreset } from '../lib/periodFilters';

export function useUrlPeriodFilter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  const setPeriod = (keyOrDates) => {
    const next = typeof keyOrDates === 'string' ? applyPeriodPreset(keyOrDates) : keyOrDates;
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next.dateFrom) params.set('dateFrom', next.dateFrom);
      else params.delete('dateFrom');
      if (next.dateTo) params.set('dateTo', next.dateTo);
      else params.delete('dateTo');
      return params;
    }, { replace: true });
  };

  return { dateFrom, dateTo, setPeriod };
}
