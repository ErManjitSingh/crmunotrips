import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import API from '../../api/axios';
import ReportsKpiCards from './ReportsKpiCards';
import ReportsFilterBar, { FILTER_DEFAULTS } from './ReportsFilterBar';
import ExportActions from './ExportActions';
import LeadSourceAnalytics from './LeadSourceAnalytics';
import ExecutivePerformanceTable from './ExecutivePerformanceTable';
import DestinationReports from './DestinationReports';
import PackagePerformance from './PackagePerformance';
import RevenueAnalyticsChart from './RevenueAnalyticsChart';
import ConversionFunnelReport from './ConversionFunnelReport';
import ForecastPanel from './ForecastPanel';
import { useUrlPeriodFilter } from '../../hooks/useUrlPeriodFilter';

function applyFilters(data, filters) {
  if (!data) return null;
  let result = { ...data };

  if (filters.source) {
    result.leadSources = data.leadSources.filter((s) => s.source === filters.source);
  }
  if (filters.destination) {
    result.destinations = data.destinations.filter((d) => d.destination === filters.destination);
  }
  if (filters.executive) {
    result.executives = data.executives.filter((e) => e.name === filters.executive);
  }
  if (filters.package) {
    const q = filters.package.toLowerCase();
    result.packages = data.packages.filter((p) => p.name.toLowerCase().includes(q));
  }

  return result;
}

export default function ReportsPage() {
  const { dateFrom, dateTo, setPeriod } = useUrlPeriodFilter();
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ ...FILTER_DEFAULTS, dateFrom, dateTo });

  const fetchData = useCallback(() => {
    setLoading(true);
    API.get('/reports/analytics', {
      params: {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
    })
      .then((res) => setRaw(res.data))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    setFilters((f) => ({ ...f, dateFrom, dateTo }));
  }, [dateFrom, dateTo]);

  const data = useMemo(() => applyFilters(raw, filters), [raw, filters]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-8 print:p-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6 print:hidden">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-content-primary tracking-tight">Reports & Analytics</h1>
            <p className="text-sm text-content-muted">Business intelligence for travel agency owners</p>
          </div>
        </div>
        {data ? <ExportActions data={data} /> : null}
      </div>

      <div className="print:hidden">
        <ReportsFilterBar
          filters={filters}
          onChange={(next) => {
            setFilters(next);
            if (next.dateFrom !== dateFrom || next.dateTo !== dateTo) {
              setPeriod({ dateFrom: next.dateFrom || '', dateTo: next.dateTo || '' });
            }
          }}
          onPeriodSelect={setPeriod}
          onReset={() => {
            setFilters({ ...FILTER_DEFAULTS });
            setPeriod('all');
          }}
        />
      </div>

      {!data ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-6 gap-4">{[...Array(6)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-surface-elevated" />)}</div>
          <div className="h-96 rounded-2xl bg-surface-elevated" />
        </div>
      ) : (
        <div className={loading ? 'pointer-events-none opacity-60' : undefined}>
      <ReportsKpiCards summary={data.summary} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-4">
        <div className="xl:col-span-8">
          <RevenueAnalyticsChart revenue={data.revenue} />
        </div>
        <div className="xl:col-span-4">
          <ForecastPanel forecast={data.forecast} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-4">
        <div className="xl:col-span-7">
          <LeadSourceAnalytics data={data.leadSources} />
        </div>
        <div className="xl:col-span-5">
          <ConversionFunnelReport data={data.funnel} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 mb-4">
        <div className="xl:col-span-7">
          <ExecutivePerformanceTable data={data.executives} />
        </div>
        <div className="xl:col-span-5">
          <PackagePerformance data={data.packages} />
        </div>
      </div>

      <DestinationReports data={data.destinations} />

      <div className="mt-4 rounded-2xl border border-subtle bg-surface/80 p-5">
        <h3 className="text-sm font-bold text-content-primary mb-3">Reactivated Lead Report</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3 text-center">
          {[
            ['Reactivated', data.reactivationWidget?.stageCounts?.reactivated || 0],
            ['Reassigned', data.reactivationWidget?.stageCounts?.reassigned || 0],
            ['Contacted', data.reactivationWidget?.stageCounts?.contacted || 0],
            ['Follow Up', data.reactivationWidget?.stageCounts?.followUpScheduled || 0],
            ['Quotation', data.reactivationWidget?.stageCounts?.quotationSent || 0],
            ['Converted', data.reactivationWidget?.stageCounts?.converted || 0],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-surface-elevated/60 p-2">
              <p className="text-[10px] text-content-muted uppercase">{label}</p>
              <p className="text-lg font-bold text-content-primary">{value}</p>
            </div>
          ))}
        </div>
      </div>
        </div>
      )}
    </motion.div>
  );
}
