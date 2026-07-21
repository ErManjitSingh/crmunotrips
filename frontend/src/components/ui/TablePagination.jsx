import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function TablePagination({
  table,
  pageIndex,
  pageSize,
  pageCount,
  total,
  onPageChange,
  onPageSizeChange,
  totalLabel = 'items',
  totalCount,
  hasMore = false,
  showPageNumbers = false,
  accent = 'blue',
  className = '',
}) {
  const usingTable = !!table;
  const resolvedPageIndex = usingTable ? table.getState().pagination.pageIndex : (pageIndex || 0);
  const resolvedPageSize = usingTable ? table.getState().pagination.pageSize : (pageSize || DEFAULT_PAGE_SIZE);
  const unknownTotal = !usingTable && (total == null || total === undefined);
  const resolvedTotal = usingTable
    ? (totalCount ?? table.getFilteredRowModel().rows.length)
    : (unknownTotal ? null : (total ?? totalCount ?? 0));
  const resolvedPageCount = usingTable
    ? table.getPageCount()
    : unknownTotal
      ? (hasMore ? resolvedPageIndex + 2 : resolvedPageIndex + 1)
      : Math.max(pageCount || 1, 1);
  const from = resolvedPageIndex * resolvedPageSize + 1;
  const to = resolvedTotal != null
    ? Math.min((resolvedPageIndex + 1) * resolvedPageSize, resolvedTotal)
    : from + resolvedPageSize - 1;

  const handlePrev = () => {
    if (usingTable) return table.previousPage();
    if (typeof onPageChange === 'function') onPageChange(Math.max(resolvedPageIndex - 1, 0));
  };

  const handleNext = () => {
    if (usingTable) return table.nextPage();
    if (typeof onPageChange === 'function') onPageChange(Math.min(resolvedPageIndex + 1, resolvedPageCount - 1));
  };

  const canPrevious = usingTable ? table.getCanPreviousPage() : resolvedPageIndex > 0;
  const canNext = usingTable
    ? table.getCanNextPage()
    : unknownTotal
      ? hasMore
      : resolvedPageIndex < resolvedPageCount - 1;

  const pageNumbers = useMemo(() => {
    if (!showPageNumbers || resolvedPageCount <= 1) return [];
    const current = resolvedPageIndex;
    const totalPages = resolvedPageCount;
    const pages = new Set([0, totalPages - 1, current]);
    if (current > 0) pages.add(current - 1);
    if (current < totalPages - 1) pages.add(current + 1);
    if (current > 1) pages.add(current - 2);
    if (current < totalPages - 2) pages.add(current + 2);
    const sorted = [...pages].filter((p) => p >= 0 && p < totalPages).sort((a, b) => a - b);
    const result = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) result.push('ellipsis');
      result.push(p);
    });
    return result;
  }, [showPageNumbers, resolvedPageCount, resolvedPageIndex]);

  const activePageClass = accent === 'violet'
    ? 'bg-[#5D5FEF] text-white shadow-sm'
    : 'bg-blue-500 text-white shadow-sm';

  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3', className)}>
      <p className="text-sm text-content-muted">
        Showing <span className="font-semibold text-content-primary">{from}</span>
        {' '}to <span className="font-semibold text-content-primary">{to}</span>
        {resolvedTotal != null ? (
          <>
            {' '}of <span className="font-semibold text-content-primary">{resolvedTotal.toLocaleString('en-IN')}</span> {totalLabel}
          </>
        ) : (
          <> {totalLabel}</>
        )}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        {!usingTable && typeof onPageSizeChange === 'function' && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-content-muted whitespace-nowrap">Rows per page</span>
            <select
              className="h-9 rounded-lg border border-subtle bg-white px-2.5 text-sm text-content-primary outline-none focus:ring-2 focus:ring-[#5D5FEF]/25"
              value={resolvedPageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {[10, 15, 25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={handlePrev}
          disabled={!canPrevious}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-subtle bg-white text-sm font-medium text-content-primary hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        {showPageNumbers && pageNumbers.length > 0 ? (
          <div className="flex items-center gap-1">
            {pageNumbers.map((p, i) =>
              p === 'ellipsis' ? (
                <span key={`e-${i}`} className="px-1 text-content-muted text-sm">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    if (usingTable) table.setPageIndex(p);
                    else if (typeof onPageChange === 'function') onPageChange(p);
                  }}
                  className={cn(
                    'min-w-[36px] h-9 px-2 rounded-lg text-sm font-medium transition-colors',
                    p === resolvedPageIndex
                      ? activePageClass
                      : 'border border-subtle bg-white text-content-primary hover:bg-slate-50'
                  )}
                >
                  {p + 1}
                </button>
              )
            )}
          </div>
        ) : (
          <span className="text-sm font-medium text-content-secondary px-2 tabular-nums">
            Page {resolvedPageIndex + 1}
            {resolvedTotal != null ? ` of ${resolvedPageCount}` : hasMore ? '+' : ''}
          </span>
        )}
        <button
          type="button"
          onClick={handleNext}
          disabled={!canNext}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-subtle bg-white text-sm font-medium text-content-primary hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export const DEFAULT_PAGE_SIZE = 50;
export const LEADS_PAGE_SIZE = 50;
export const ALL_LEADS_PAGE_SIZE = 15;
