import { useEffect, useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { motion } from 'framer-motion';
import { MapPin, Clock, Copy, Pencil, Trash2, MoreHorizontal } from 'lucide-react';
import { PACKAGE_TYPES } from '../quotations/constants';
import { formatINR } from '../quotations/quotationUtils';
import { cn } from '../../lib/utils';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import TablePagination, { PACKAGES_PAGE_SIZE } from '../ui/TablePagination';
import { compactTable, compactTh, compactTd } from '../ui/compactTable';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TYPE_BADGE = {
  honeymoon: 'bg-rose-500/10 text-rose-700 border-rose-400/30',
  family: 'bg-sky-500/10 text-sky-700 border-sky-400/30',
  group: 'bg-violet-500/10 text-violet-700 border-violet-400/30',
  adventure: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/30',
  luxury: 'bg-amber-500/10 text-amber-800 border-amber-400/30',
  corporate: 'bg-slate-500/10 text-slate-700 border-slate-400/30',
};

function TypeBadge({ type }) {
  const cfg = PACKAGE_TYPES.find((t) => t.value === type) || PACKAGE_TYPES[1];
  return (
    <span
      className={cn(
        'inline-flex text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border',
        TYPE_BADGE[type] || TYPE_BADGE.family
      )}
    >
      {cfg.label}
    </span>
  );
}

export default function PackageDataTable({ packages, onEdit, onDelete, onDuplicate }) {
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: PACKAGES_PAGE_SIZE });

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [packages.length]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Package Name',
        cell: ({ row }) => (
          <div className="min-w-[180px]">
            <p className="text-sm font-semibold text-content-primary">{row.original.name}</p>
            <p className="text-xs text-content-muted mt-0.5 font-mono">{row.original._id}</p>
          </div>
        ),
      },
      {
        accessorKey: 'destination',
        header: 'Destination',
        cell: ({ getValue }) => (
          <span className="inline-flex items-center gap-1.5 text-sm text-content-secondary">
            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'duration',
        header: 'Duration',
        cell: ({ row }) => {
          const days = row.original.duration;
          const nights = Math.max(0, days - 1);
          return (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-800 ring-1 ring-amber-400/25 whitespace-nowrap">
              <Clock className="w-3.5 h-3.5" />
              {days}D / {nights}N
            </span>
          );
        },
      },
      {
        accessorKey: 'packageType',
        header: 'Type',
        cell: ({ getValue }) => <TypeBadge type={getValue()} />,
      },
      {
        accessorKey: 'startingPrice',
        header: 'Starting Price',
        cell: ({ getValue }) => (
          <span className="text-sm font-bold text-content-primary tabular-nums whitespace-nowrap">
            {formatINR(getValue())}
          </span>
        ),
      },
      {
        id: 'itinerary',
        header: 'Itinerary',
        cell: ({ row }) => (
          <span className="text-sm text-content-secondary">
            {row.original.itinerary?.length || 0} days
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ getValue }) => (
          <span className="text-xs text-content-muted whitespace-nowrap">{formatDate(getValue())}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const pkg = row.original;
          return (
            <DropdownMenuRoot>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-600"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => onEdit(pkg)}>
                  <Pencil className="w-4 h-4 text-violet-600" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(pkg._id)}>
                  <Copy className="w-4 h-4 text-sky-600" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 focus:text-red-600"
                  onClick={() => onDelete(pkg._id)}
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuRoot>
          );
        },
      },
    ],
    [onEdit, onDelete, onDuplicate]
  );

  const table = useReactTable({
    data: packages,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row._id,
  });

  if (packages.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-surface/90 backdrop-blur-xl shadow-lg shadow-amber-500/5 overflow-hidden mb-8">
      <div className="overflow-x-auto">
        <table className={`${compactTable} min-w-[800px]`}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="border-b border-amber-500/15 bg-gradient-to-r from-amber-600/10 via-orange-600/8 to-amber-600/10"
              >
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`${compactTh} cursor-pointer select-none hover:text-amber-600 transition-colors`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className={`group border-b border-subtle/50 last:border-0 transition-all hover:bg-gradient-to-r hover:from-amber-500/[0.06] hover:to-orange-500/[0.04] ${
                  i % 2 === 1 ? 'bg-white dark:bg-slate-800/70' : 'bg-transparent'
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={compactTd}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination
        table={table}
        totalLabel="packages"
        className="border-amber-500/15 bg-gradient-to-r from-amber-500/[0.03] to-orange-500/[0.03]"
      />
    </div>
  );
}
