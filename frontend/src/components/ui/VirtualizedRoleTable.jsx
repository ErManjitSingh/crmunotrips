import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import TablePagination from './TablePagination';
import { cn } from '../../lib/utils';
import {
  LEAD_LIST_CONTAINER,
  LEAD_LIST_TH,
  LEAD_LIST_TD,
  LEAD_LIST_ROW_HOVER,
  leadListRowBg,
} from '../leads/leadListStyles';

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
  rowClassName = LEAD_LIST_ROW_HOVER,
  tableClassName = 'w-full text-sm table-auto border-collapse min-w-[900px]',
  containerClassName = LEAD_LIST_CONTAINER,
  headerRowClassName = 'border-b border-subtle',
  thClassName = LEAD_LIST_TH,
  tdClassName = LEAD_LIST_TD,
  estimateRowHeight = 112,
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
          <tbody>
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
                  const stallOrExtra = getRowClassName?.(row.original);
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        rowClassName,
                        stallOrExtra || leadListRowBg(virtualRow.index, row.original?.status)
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
