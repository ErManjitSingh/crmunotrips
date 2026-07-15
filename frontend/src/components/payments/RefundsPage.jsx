import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Search, CheckCircle2, XCircle } from 'lucide-react';
import { listPayments, refundPayment } from '../../services/paymentApi';
import {
  formatDate,
  formatINR,
  getAvatarColor,
  getInitials,
  totalRefunded,
} from './paymentUtils';
import { cn } from '../../lib/utils';
import { useToast } from '../../context/ToastContext';
import TablePagination from '../ui/TablePagination';
import RefundPaymentModal from './RefundPaymentModal';

const PAGE_SIZE = 10;

export default function RefundsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [refundOpen, setRefundOpen] = useState(false);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => listPayments(),
    staleTime: 30_000,
  });

  const refundRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments
      .filter((p) => p.status === 'refunded' || (p.refunds || []).length > 0 || (Number(p.paidAmount) > 0 && ['paid', 'partial'].includes(p.status)))
      .filter((p) => {
        if (!q) return true;
        return [p.invoiceNumber, p.customerName, p.booking?.bookingNumber]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const aScore = a.status === 'refunded' || (a.refunds || []).length ? 1 : 0;
        const bScore = b.status === 'refunded' || (b.refunds || []).length ? 1 : 0;
        return bScore - aScore;
      });
  }, [payments, search]);

  const pageItems = refundRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const refundedTotal = payments.reduce((s, p) => s + totalRefunded(p), 0);
  const refundCount = payments.filter((p) => p.status === 'refunded' || (p.refunds || []).length).length;

  const mutation = useMutation({
    mutationFn: ({ id, payload }) => refundPayment(id, payload),
    onSuccess: () => {
      toast.success('Refund processed');
      setRefundOpen(false);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
    onError: (err) => toast.error(err?.response?.data?.message || 'Refund failed'),
  });

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Refunds</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Track refund requests, approvals, partial refunds and timelines.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const eligible = payments.find((p) => (p.paidAmount || 0) > 0);
            if (!eligible) return toast.info('No refundable payments found');
            setSelected(eligible);
            setRefundOpen(true);
          }}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold shadow-md shadow-violet-600/25"
        >
          <RotateCcw className="w-4 h-4" />
          Add Refund
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {[
          { label: 'Refund Requests', value: String(refundCount), tone: 'text-violet-600' },
          { label: 'Total Refunded', value: formatINR(refundedTotal), tone: 'text-rose-600' },
          { label: 'Eligible Records', value: String(refundRows.length), tone: 'text-slate-900' },
        ].map((card) => (
          <div key={card.label} className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-sm">
            <p className="text-[11px] font-medium text-slate-500">{card.label}</p>
            <p className={cn('text-2xl font-bold metric-tabular mt-1', card.tone)}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            placeholder="Search refunds by customer or invoice..."
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
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="bg-slate-50 text-left">
                  {['Invoice', 'Customer', 'Paid', 'Refunded', 'Status', 'Last Refund', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((p) => {
                  const refunded = totalRefunded(p);
                  const isRefunded = p.status === 'refunded' || refunded > 0;
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
                      <td className="px-4 py-3.5 text-sm font-semibold metric-tabular">{formatINR(p.paidAmount)}</td>
                      <td className="px-4 py-3.5 text-sm font-semibold text-rose-600 metric-tabular">{formatINR(refunded)}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border',
                            isRefunded
                              ? 'bg-violet-50 text-violet-700 border-violet-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          )}
                        >
                          {isRefunded ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {isRefunded ? 'Refunded / Partial' : 'Eligible'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500">
                        {p.refunds?.[0]?.date ? formatDate(p.refunds[0].date) : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          className="text-xs font-semibold text-violet-600 hover:text-violet-500"
                          onClick={() => {
                            setSelected(p);
                            setRefundOpen(true);
                          }}
                        >
                          Process
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!pageItems.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                      No refund activity yet
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
          pageCount={Math.max(1, Math.ceil(refundRows.length / PAGE_SIZE))}
          total={refundRows.length}
          onPageChange={(idx) => setPage(idx + 1)}
          totalLabel="records"
        />
      </div>

      <RefundPaymentModal
        open={refundOpen}
        payment={selected}
        onClose={() => setRefundOpen(false)}
        loading={mutation.isPending}
        onSubmit={(payload) => mutation.mutate({ id: selected._id, payload })}
      />
    </div>
  );
}
