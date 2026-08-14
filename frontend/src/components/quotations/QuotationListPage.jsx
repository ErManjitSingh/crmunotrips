import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Send, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import Avatar from '../ui/Avatar';
import QuoteStatusBadge from './QuoteStatusBadge';
import QuotationFiltersPanel from './QuotationFiltersPanel';
import QuotationDetailDrawer from './QuotationDetailDrawer';
import QuotationPdfOverlay from './QuotationPdfOverlay';
import { QUOTE_STATUSES } from './constants';
import { formatINR } from './quotationUtils';
import {
  emptyQuotationFilters,
  countQuotationActiveFilters,
} from './quotationFilterUtils';
import { cn } from '../../lib/utils';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useQuotationsQuery, useQuotationStatsQuery } from '../../features/quotations/hooks/useQuotationsQuery';
import { DEFAULT_PAGE_SIZE } from '../ui/TablePagination';
import { applyPeriodPreset } from '../../lib/periodFilters';
import { useUrlPeriodFilter } from '../../hooks/useUrlPeriodFilter';

const KPI = [
  { key: 'total', label: 'Total Quotes', color: 'from-sky-500/20 to-blue-500/10 border-sky-400/40', icon: FileText, text: 'text-sky-700' },
  { key: 'sent', label: 'Sent', color: 'from-indigo-500/20 to-violet-500/10 border-indigo-400/40', icon: Send, text: 'text-indigo-700' },
  { key: 'approved', label: 'Approved', color: 'from-emerald-500/20 to-teal-500/10 border-emerald-400/40', icon: TrendingUp, text: 'text-emerald-700' },
  { key: 'value', label: 'Pipeline Value', color: 'from-amber-500/20 to-orange-500/10 border-amber-400/40', icon: TrendingUp, text: 'text-amber-700' },
];

const STATUS_OPTIONS = [{ value: '', label: 'All Statuses' }, ...QUOTE_STATUSES.map((s) => ({ value: s.value, label: s.label }))];

export default function QuotationListPage() {
  const queryClient = useQueryClient();
  const { dateFrom, dateTo, setPeriod } = useUrlPeriodFilter();
  const [draftFilters, setDraftFilters] = useState(() => ({
    ...emptyQuotationFilters,
    dateFrom,
    dateTo,
  }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    ...emptyQuotationFilters,
    dateFrom,
    dateTo,
  }));
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });
  const [selected, setSelected] = useState(null);
  const [showPdf, setShowPdf] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const pdfRef = useRef(null);
  const [searchParams] = useSearchParams();
  const debouncedSearch = useDebouncedValue(appliedFilters.search, 350);

  const queryFilters = useMemo(
    () => ({ ...appliedFilters, search: debouncedSearch }),
    [appliedFilters, debouncedSearch]
  );

  const { data, isLoading } = useQuotationsQuery({
    filters: queryFilters,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  const { data: statsData } = useQuotationStatsQuery();

  const quotes = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['quotations'] });
  }, [queryClient]);

  useDataRefresh(['quotations', 'leads'], invalidate);

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [debouncedSearch, appliedFilters.status, appliedFilters.destination, appliedFilters.dateFrom, appliedFilters.dateTo]);

  useEffect(() => {
    setDraftFilters((f) => (f.dateFrom === dateFrom && f.dateTo === dateTo ? f : { ...f, dateFrom, dateTo }));
    setAppliedFilters((f) => (f.dateFrom === dateFrom && f.dateTo === dateTo ? f : { ...f, dateFrom, dateTo }));
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const viewId = searchParams.get('view');
    if (viewId && quotes.length) {
      const q = quotes.find((x) => x._id === viewId);
      if (q) setSelected(q);
    }
  }, [searchParams, quotes]);

  const kpis = statsData ?? {
    total: total,
    sent: 0,
    approved: 0,
    value: 0,
  };

  const handlePrint = () => {
    setShowPdf(true);
    setAutoPrint(true);
  };

  const hasActiveFilters = countQuotationActiveFilters(appliedFilters) > 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-content-primary">Quotations</h1>
          <p className="text-sm text-content-muted">View all quotes — creator, customer, package details & who it was sent to</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {KPI.map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div key={k.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={cn('rounded-2xl border bg-gradient-to-br p-4', k.color)}>
              <Icon className={cn('w-5 h-5 mb-2', k.text)} />
              <p className={cn('text-2xl font-black metric-tabular', k.text)}>{k.key === 'value' ? formatINR(kpis.value) : kpis[k.key]}</p>
              <p className="text-xs font-medium text-content-muted mt-1">{k.label}</p>
            </motion.div>
          );
        })}
      </div>

      <QuotationFiltersPanel
        filters={draftFilters}
        onChange={setDraftFilters}
        onApply={() => setAppliedFilters({ ...draftFilters })}
        onClear={() => {
          setDraftFilters(emptyQuotationFilters);
          setAppliedFilters(emptyQuotationFilters);
          setPeriod('all');
        }}
        onPeriodSelect={(key) => {
          const dates = applyPeriodPreset(key);
          setDraftFilters((f) => ({ ...f, ...dates }));
          setAppliedFilters((f) => ({ ...f, ...dates }));
          setPeriod(key);
        }}
        onRefresh={invalidate}
        hasActiveFilters={hasActiveFilters}
        showStatusFilter
        statusOptions={STATUS_OPTIONS}
        className="mb-4"
      />

      <div className="rounded-2xl border border-subtle bg-surface shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-content-muted animate-pulse">Loading quotations...</div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead><tr className="border-b border-subtle bg-surface-elevated/50">
                {['Quote #', 'Customer', 'Package', 'Amount', 'Status', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase text-content-muted whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-subtle">
                {quotes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-content-muted">
                      No quotations match your filters
                    </td>
                  </tr>
                ) : quotes.map((q) => (
                  <tr key={q._id} className="hover:bg-sky-500/[0.03] group">
                    <td className="px-4 py-3.5 font-mono text-sm font-medium text-sky-600 whitespace-nowrap">{q.quoteNumber}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap"><div className="flex items-center gap-2"><Avatar name={q.lead?.name} size="sm" className="!w-7 !h-7 !text-[10px]" /><span className="text-sm font-medium">{q.lead?.name}</span></div></td>
                    <td className="px-4 py-3.5 text-sm text-content-secondary whitespace-nowrap">{q.package?.name || q.packageSnapshot?.name || '—'}</td>
                    <td className="px-4 py-3.5 text-sm font-semibold metric-tabular whitespace-nowrap">{formatINR(q.pricing?.total)}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap"><QuoteStatusBadge status={q.status} /></td>
                    <td className="px-4 py-3.5 text-xs text-content-muted whitespace-nowrap">{new Date(q.createdAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs"
                        onClick={() => setSelected(q)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-t border-subtle bg-surface-elevated/30">
              <p className="text-sm text-content-muted">
                Showing{' '}
                <span className="font-semibold text-content-primary">
                  {pagination.pageIndex * pagination.pageSize + 1}–
                  {Math.min((pagination.pageIndex + 1) * pagination.pageSize, total)}
                </span>{' '}
                of <span className="font-semibold text-content-primary">{total}</span> quotations
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={pagination.pageIndex <= 0} onClick={() => setPagination((p) => ({ ...p, pageIndex: Math.max(0, p.pageIndex - 1) }))}>
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>
                <span className="text-sm font-medium text-content-secondary px-2 tabular-nums">
                  Page {pagination.pageIndex + 1} of {pageCount}
                </span>
                <Button variant="secondary" size="sm" disabled={pagination.pageIndex + 1 >= pageCount} onClick={() => setPagination((p) => ({ ...p, pageIndex: p.pageIndex + 1 }))}>
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      <QuotationDetailDrawer
        quote={selected}
        open={!!selected && !showPdf}
        onClose={() => { setSelected(null); setShowPdf(false); }}
        readOnly
        onDownloadPdf={handlePrint}
      />

      <QuotationPdfOverlay
        quote={selected}
        open={showPdf}
        onClose={() => { setShowPdf(false); setAutoPrint(false); }}
        pdfRef={pdfRef}
        autoPrint={autoPrint}
        onAutoPrintDone={() => setAutoPrint(false)}
      />
    </motion.div>
  );
}
