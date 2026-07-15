import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Search } from 'lucide-react';
import { listPayments } from '../../services/paymentApi';
import {
  formatDate,
  formatINR,
  getAvatarColor,
  getInitials,
  getStatusMeta,
} from './paymentUtils';
import { cn } from '../../lib/utils';
import TablePagination from '../ui/TablePagination';

const PAGE_SIZE = 10;

export default function InvoicesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => listPayments(),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (!q) return true;
      return [p.invoiceNumber, p.customerName, p.booking?.bookingNumber, p.lead?.destination]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [payments, search]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Invoices</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            GST invoices, proforma bills and tax documents linked to bookings.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button type="button" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold shadow-md shadow-violet-600/25">
            <FileText className="w-4 h-4" />
            Generate Invoice
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            placeholder="Search invoice, customer, booking..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {isLoading ? (
          <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 text-left">
                  {['Invoice', 'Customer', 'Destination', 'Amount', 'Received', 'Status', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => {
                  const status = getStatusMeta(p.status);
                  return (
                    <tr key={p._id} className="border-t border-slate-100 hover:bg-violet-50/30">
                      <td className="px-4 py-3.5 font-mono text-sm font-semibold text-violet-600">{p.invoiceNumber}</td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white', getAvatarColor(p.customerName))}>
                            {getInitials(p.customerName)}
                          </div>
                          <span className="text-sm font-semibold text-slate-900">{p.customerName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-600">{p.lead?.destination || '—'}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold metric-tabular">{formatINR(p.amount)}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-emerald-600 metric-tabular">{formatINR(p.paidAmount)}</td>
                      <td className="px-4 py-3.5">
                        <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full border', status.soft)}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">{formatDate(p.createdAt)}</td>
                    </tr>
                  );
                })}
                {!pageItems.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                      No invoices yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <TablePagination
          pageIndex={page - 1}
          pageSize={PAGE_SIZE}
          pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
          total={filtered.length}
          onPageChange={(idx) => setPage(idx + 1)}
          totalLabel="invoices"
        />
      </div>
    </div>
  );
}
