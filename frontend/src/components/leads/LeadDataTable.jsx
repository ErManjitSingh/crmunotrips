import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import LeadStatusBadge from './LeadStatusBadge';
import LeadRowActions from './LeadRowActions';
import { formatLeadId } from './constants';
import {
  SourceBadge,
  DestinationChip,
  BudgetBadge,
  TravelersBadge,
  LeadIdPill,
  CustomerCell,
  ExecutiveBadge,
  PhoneCell,
  TravelDateCell,
} from '../sales-manager/LeadListBadges';
import TablePagination, { DEFAULT_PAGE_SIZE } from '../ui/TablePagination';
import { cn } from '../../lib/utils';
import {
  LEAD_LIST_CONTAINER,
  LEAD_LIST_TH,
  LEAD_LIST_TD,
  LEAD_LIST_ROW_HOVER,
  leadListRowBg,
} from './leadListStyles';

const defaultMenuActions = {
  view: true,
  edit: true,
  assign: true,
  transferBranch: true,
  delete: true,
};

const leadsTh = LEAD_LIST_TH;
const leadsTd = LEAD_LIST_TD;

export default function LeadDataTable({
  leads,
  rowSelection,
  onRowSelectionChange,
  onRowClick,
  onDelete,
  onAssign,
  onTransferBranch,
  canEditLead = true,
  menuActions = defaultMenuActions,
  showAssignButton = true,
  serverPagination = null,
}) {
  const actions = { ...defaultMenuActions, ...menuActions };
  const isServer = Boolean(serverPagination);
  const [clientPagination, setClientPagination] = useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });
  const scrollRef = useRef(null);

  const pagination = isServer
    ? { pageIndex: serverPagination.pageIndex, pageSize: serverPagination.pageSize }
    : clientPagination;

  useEffect(() => {
    if (!isServer) {
      setClientPagination((p) => ({ ...p, pageIndex: 0 }));
    }
  }, [leads.length, isServer]);

  const columns = useMemo(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="rounded border-slate-300 accent-blue-600 w-4 h-4"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-slate-300 accent-blue-600 w-4 h-4"
          />
        ),
        size: 44,
      },
      {
        accessorKey: 'id',
        header: 'Lead ID',
        cell: ({ row }) => <LeadIdPill id={formatLeadId(row.original._id)} />,
      },
      {
        accessorKey: 'name',
        header: 'Customer',
        cell: ({ row }) => <CustomerCell name={row.original.name} lead={row.original} />,
      },
      {
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ row }) => <PhoneCell phone={row.original.phone} />,
      },
      {
        accessorKey: 'destination',
        header: 'Destination',
        cell: ({ getValue }) => <DestinationChip name={getValue()} />,
      },
      {
        accessorKey: 'travelDate',
        header: 'Travel Date',
        cell: ({ getValue }) => <TravelDateCell date={getValue()} />,
      },
      {
        accessorKey: 'budget',
        header: 'Budget',
        cell: ({ getValue }) => <BudgetBadge amount={getValue()} />,
      },
      {
        accessorKey: 'travelers',
        header: 'Pax',
        cell: ({ row }) => (
          <TravelersBadge
            travelers={row.original.travelers}
            adults={row.original.adults}
            children={row.original.children}
          />
        ),
      },
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => (
          <SourceBadge
            source={row.original.source}
            label={row.original.sourceLabel}
            sourceShort={row.original.sourceShort}
          />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => (
          <LeadStatusBadge status={getValue()} pulse={getValue() === 'new'} size="sm" />
        ),
      },
      {
        id: 'assignedTo',
        accessorKey: 'assignedTo',
        header: 'Assigned To',
        cell: ({ getValue }) => (
          <ExecutiveBadge name={getValue()?.name} unassigned={!getValue()?.name} />
        ),
      },
      {
        id: 'rowActions',
        header: 'Actions',
        cell: ({ row }) => (
          <LeadRowActions
            lead={row.original}
            onRowClick={onRowClick}
            onDelete={onDelete}
            onAssign={onAssign}
            onTransferBranch={onTransferBranch}
            canEditLead={canEditLead}
            actions={actions}
            showAssignButton={showAssignButton}
          />
        ),
      },
    ],
    [onRowClick, onDelete, onAssign, onTransferBranch, canEditLead, actions, showAssignButton]
  );

  const table = useReactTable({
    data: leads,
    columns,
    state: { rowSelection, pagination },
    onRowSelectionChange,
    onPaginationChange: isServer ? serverPagination.onPaginationChange : setClientPagination,
    manualPagination: isServer,
    pageCount: isServer ? serverPagination.pageCount : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(isServer ? {} : { getPaginationRowModel: getPaginationRowModel() }),
    getRowId: (row) => row._id,
    enableRowSelection: true,
  });

  const tableRows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    overscan: 6,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-subtle bg-white p-16 text-center shadow-sm">
        <p className="text-content-primary font-semibold">No leads match your filters</p>
        <p className="text-sm text-content-muted mt-1">Try adjusting filters or add a new lead</p>
      </div>
    );
  }

  return (
    <div className={LEAD_LIST_CONTAINER}>
      <div ref={scrollRef} className="overflow-auto max-h-[min(70vh,680px)]">
        <table className="w-full text-sm table-auto border-collapse min-w-[1100px]">
          <thead className="sticky top-0 z-20">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const colId = header.column.id;
                  const thClass = cn(
                    leadsTh,
                    colId === 'rowActions' && 'text-right sticky right-0 z-30 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.06)]',
                    colId !== 'rowActions' && 'cursor-pointer select-none hover:text-slate-700'
                  );
                  return (
                    <th
                      key={header.id}
                      className={thClass}
                      onClick={colId !== 'rowActions' && colId !== 'select' ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr aria-hidden>
                <td colSpan={columns.length} style={{ height: paddingTop, padding: 0, border: 0 }} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = tableRows[virtualRow.index];
              const isOdd = virtualRow.index % 2 === 0;
              const rowBg = leadListRowBg(virtualRow.index);
              return (
                <tr
                  key={row.id}
                  onClick={() => onRowClick(row.original)}
                  className={cn('group cursor-pointer', rowBg, LEAD_LIST_ROW_HOVER)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const colId = cell.column.id;
                    const tdClass = cn(
                      leadsTd,
                      colId === 'rowActions' &&
                        cn(
                          'text-right sticky right-0 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.04)]',
                          isOdd ? 'bg-sky-50 group-hover:bg-sky-100/80' : 'bg-white group-hover:bg-sky-100/80'
                        )
                    );
                    return (
                      <td key={cell.id} className={tdClass}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr aria-hidden>
                <td colSpan={columns.length} style={{ height: paddingBottom, padding: 0, border: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {isServer ? (
        <TablePagination
          pageIndex={serverPagination.pageIndex}
          pageSize={serverPagination.pageSize}
          pageCount={serverPagination.pageCount}
          total={serverPagination.total}
          hasMore={serverPagination.hasMore}
          onPageChange={(pageIndex) =>
            serverPagination.onPaginationChange((prev) => ({ ...prev, pageIndex }))
          }
          onPageSizeChange={(pageSize) =>
            serverPagination.onPaginationChange({ pageIndex: 0, pageSize })
          }
          totalLabel="leads"
          showPageNumbers
          className="border-t border-subtle bg-slate-50/50"
        />
      ) : (
        <TablePagination
          table={table}
          totalLabel="leads"
          showPageNumbers
          className="border-t border-subtle bg-slate-50/50"
        />
      )}
    </div>
  );
}
