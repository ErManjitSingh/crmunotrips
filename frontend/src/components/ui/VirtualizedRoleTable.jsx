import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import TablePagination from './TablePagination';
import { cn } from '../../lib/utils';

const defaultTh = 'text-left px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted whitespace-nowrap bg-violet-50/50 dark:bg-violet-950/20';
const defaultTd = 'px-4 py-3.5 align-middle text-sm';

export default function VirtualizedRoleTable({
  data,
  columns,
  isLoading = false,
  emptyMessage = 'No leads in this view',
  pagination,
  pageCount,
  total,
  onPaginationChange,
  totalLabel = 'leads',
  paginationAccent = 'violet',
  rowClassName = 'hover:bg-violet-50/40 dark:hover:bg-violet-950/20 transition-colors',
  tableClassName = 'w-full text-sm',
  containerClassName = 'rounded-2xl border border-subtle bg-white dark:bg-slate-900 shadow-sm overflow-hidden',
  headerRowClassName = 'border-b border-subtle',
  thClassName = defaultTh,
  tdClassName = defaultTd,
  estimateRowHeight = 56,
  maxHeight = 'min(70vh, 680px)',
  getRowClassName,
}) {
  const scrollRef = useRef(null);

  const table = useReactTable({
    data,
    columns,
    state: { pagination },
    onPaginationChange,
    manualPagination: true,
    pageCount,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row._id,
  });

  const tableRows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div className={containerClassName}>
      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight }}>
        <table className={tableClassName}>
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className={headerRowClassName}>
                {hg.headers.map((h) => (
                  <th key={h.id} className={thClassName}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-subtle">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="p-12 text-center text-content-muted">
                  Loading…
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-12 text-center text-content-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr aria-hidden>
                    <td colSpan={columns.length} style={{ height: paddingTop, padding: 0, border: 0 }} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const row = tableRows[virtualRow.index];
                  const isOdd = virtualRow.index % 2 === 0;
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        rowClassName,
                        isOdd ? 'bg-sky-50' : 'bg-white',
                        getRowClassName?.(row.original)
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className={cn(tdClassName)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {paddingBottom > 0 && (
                  <tr aria-hidden>
                    <td colSpan={columns.length} style={{ height: paddingBottom, padding: 0, border: 0 }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      {!isLoading && data.length > 0 && (
        <TablePagination
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          pageCount={pageCount}
          total={total}
          onPageChange={(pageIndex) => onPaginationChange((prev) => ({ ...prev, pageIndex }))}
          onPageSizeChange={(pageSize) => onPaginationChange({ pageIndex: 0, pageSize })}
          totalLabel={totalLabel}
          showPageNumbers
          accent={paginationAccent}
          className="border-t border-subtle bg-slate-50/50"
        />
      )}
    </div>
  );
}
