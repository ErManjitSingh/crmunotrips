import { useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { motion } from 'framer-motion';
import { MapPin, Clock, Eye, Pencil, Loader2 } from 'lucide-react';
import { formatINR } from '../quotations/quotationUtils';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { compactTable, compactTh, compactTd } from '../ui/compactTable';

const TOUR_TYPE_STYLES = {
  domestic: 'bg-sky-500/10 text-sky-700 border-sky-400/30',
  international: 'bg-violet-500/10 text-violet-700 border-violet-400/30',
};

function TypeBadge({ type }) {
  const label = type ? String(type).replace(/_/g, ' ') : 'package';
  return (
    <span
      className={cn(
        'inline-flex text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border',
        TOUR_TYPE_STYLES[type] || 'bg-amber-500/10 text-amber-800 border-amber-400/30'
      )}
    >
      {label}
    </span>
  );
}

export default function UnoPackageListTable({ packages, onView, onEdit, editingId }) {
  const columns = useMemo(
    () => [
      {
        accessorKey: 'name',
        header: 'Package',
        cell: ({ row }) => (
          <div className="flex items-center gap-3 min-w-[220px]">
            {row.original.coverImage ? (
              <img
                src={row.original.coverImage}
                alt=""
                className="h-11 w-11 rounded-lg object-cover border border-subtle shrink-0"
                loading="lazy"
              />
            ) : (
              <div className="h-11 w-11 rounded-lg bg-surface-elevated border border-subtle shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-content-primary line-clamp-1">{row.original.name}</p>
              <p className="text-[11px] text-content-muted font-mono mt-0.5">
                {row.original.packageCode || row.original.slug || row.original._id}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'destination',
        header: 'Destination',
        cell: ({ getValue }) => (
          <span className="inline-flex items-center gap-1.5 text-sm text-content-secondary max-w-[200px]">
            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="line-clamp-2">{getValue()}</span>
          </span>
        ),
      },
      {
        id: 'duration',
        header: 'Duration',
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-800 ring-1 ring-amber-400/25 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5" />
            {row.original.durationLabel || `${row.original.duration}D`}
          </span>
        ),
      },
      {
        accessorKey: 'packageType',
        header: 'Type',
        cell: ({ getValue }) => <TypeBadge type={getValue()} />,
      },
      {
        accessorKey: 'startingPrice',
        header: 'Price',
        cell: ({ getValue }) => (
          <span className="text-sm font-bold text-content-primary tabular-nums whitespace-nowrap">
            {formatINR(getValue())}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const pkg = row.original;
          const id = pkg._id || pkg.id;
          const isEditing = editingId === id;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg text-content-secondary hover:text-sky-600"
                onClick={() => onView(pkg)}
              >
                <Eye className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg text-content-secondary hover:text-amber-600"
                disabled={isEditing}
                onClick={() => onEdit(pkg)}
              >
                {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
                <span className="ml-1 hidden sm:inline">Edit copy</span>
              </Button>
            </div>
          );
        },
      },
    ],
    [onView, onEdit, editingId]
  );

  const table = useReactTable({
    data: packages,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row._id || row.id,
  });

  if (!packages.length) return null;

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-surface/90 backdrop-blur-xl shadow-lg shadow-amber-500/5 overflow-hidden mb-4">
      <div className="overflow-x-auto">
        <table className={`${compactTable} min-w-[900px]`}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="border-b border-amber-500/15 bg-gradient-to-r from-amber-600/10 via-orange-600/8 to-amber-600/10"
              >
                {hg.headers.map((header) => (
                  <th key={header.id} className={compactTh}>
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
                transition={{ delay: i * 0.015 }}
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
    </div>
  );
}
