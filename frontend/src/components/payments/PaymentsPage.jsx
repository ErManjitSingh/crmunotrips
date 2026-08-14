import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import TablePagination from '../ui/TablePagination';
import ConfirmDialog from '../ui/ConfirmDialog';
import {
  listPayments,
  createPayment,
  updatePayment,
  deletePayment,
  refundPayment,
} from '../../services/paymentApi';
import { EMPTY_FILTERS } from './constants';
import {
  buildPaymentAnalytics,
  filterPayments,
  nextInvoiceNumber,
} from './paymentUtils';
import PaymentPageHeader from './PaymentPageHeader';
import PaymentKpiStrip from './PaymentKpiStrip';
import PaymentAnalytics from './PaymentAnalytics';
import PaymentFilterBar from './PaymentFilterBar';
import PaymentTable from './PaymentTable';
import PaymentDetailDrawer from './PaymentDetailDrawer';
import CollectPaymentModal from './CollectPaymentModal';
import AddPaymentModal from './AddPaymentModal';
import RefundPaymentModal from './RefundPaymentModal';
import PaymentInsightSidebar from './PaymentInsightSidebar';
import { useUrlPeriodFilter } from '../../hooks/useUrlPeriodFilter';
import { applyPeriodPreset } from '../../lib/periodFilters';

const PAGE_SIZE = 5;

export default function PaymentsPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { dateFrom, dateTo, setPeriod } = useUrlPeriodFilter();

  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    dateFrom,
    dateTo,
  }));
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFilters((f) => ({ ...f, dateFrom, dateTo }));
    setPage(1);
  }, [dateFrom, dateTo]);

  const canDelete = user?.role === 'admin' || hasPermission?.('payments', 'delete');

  const { data: payments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: () => listPayments(),
    staleTime: 30_000,
  });

  const filtered = useMemo(
    () => filterPayments(payments, filters, filters.datePreset),
    [payments, filters]
  );

  const analytics = useMemo(() => buildPaymentAnalytics(filtered), [filtered]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters]
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['payments'] });

  const openPayment = useCallback((payment) => {
    setSelected(payment);
    setDrawerOpen(true);
  }, []);

  const openCollect = useCallback((payment) => {
    setSelected(payment);
    setCollectOpen(true);
  }, []);

  const openRefund = useCallback((payment) => {
    setSelected(payment);
    setRefundOpen(true);
  }, []);

  const handleExport = useCallback(
    (type) => {
      toast.success(type === 'excel' ? 'Excel export prepared for current filters' : 'PDF export queued');
    },
    [toast]
  );

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      await createPayment(payload);
      toast.success('Payment created successfully');
      setAddOpen(false);
      invalidate();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create payment');
    } finally {
      setSaving(false);
    }
  };

  const handleCollect = async (payload) => {
    if (!selected?._id) return;
    setSaving(true);
    try {
      const updated = await updatePayment(selected._id, payload);
      toast.success('Payment collected successfully');
      setCollectOpen(false);
      setSelected(updated);
      invalidate();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to collect payment');
    } finally {
      setSaving(false);
    }
  };

  const handleRefund = async (payload) => {
    if (!selected?._id) return;
    setSaving(true);
    try {
      const updated = await refundPayment(selected._id, payload);
      toast.success('Refund processed');
      setRefundOpen(false);
      setSelected(updated);
      invalidate();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to process refund');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id) return;
    setSaving(true);
    try {
      await deletePayment(deleteTarget._id);
      toast.success('Payment deleted');
      setDeleteTarget(null);
      if (selected?._id === deleteTarget._id) {
        setDrawerOpen(false);
        setSelected(null);
      }
      invalidate();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete payment');
    } finally {
      setSaving(false);
    }
  };

  const onToggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onToggleAll = () => {
    setSelectedIds((prev) => {
      if (pageItems.every((p) => prev.has(p._id))) return new Set();
      return new Set(pageItems.map((p) => p._id));
    });
  };

  const onQuickAction = (key) => {
    if (key === 'add' || key === 'invoice') setAddOpen(true);
    else if (key === 'collect') {
      const firstPending = filtered.find((p) => ['pending', 'partial'].includes(p.status));
      if (firstPending) openCollect(firstPending);
      else toast.info('No pending payments to collect');
    } else if (key === 'refund') {
      const paid = filtered.find((p) => (p.paidAmount || 0) > 0);
      if (paid) openRefund(paid);
      else toast.info('No refundable payments found');
    } else if (key === 'export') handleExport('excel');
    else if (key === 'reports') toast.info('Open Reports from the sidebar for full finance reports');
    else if (key === 'remind') toast.info('Use Upcoming Due on the right to send reminders');
  };

  return (
    <Fragment>
      <div className="space-y-5 pb-8 max-w-[1600px]">
        <PaymentPageHeader
          onAddPayment={() => setAddOpen(true)}
          onGenerateInvoice={() => setAddOpen(true)}
          onExport={handleExport}
        />

        {isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>Could not load payments.</span>
            <button type="button" className="btn-secondary h-8" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : null}

        <PaymentFilterBar
          filters={filters}
          activeCount={activeFilterCount}
          onChange={(next) => {
            setFilters(next);
            setPage(1);
          }}
          onPeriodSelect={(key) => {
            const dates = applyPeriodPreset(key);
            setFilters((f) => ({ ...f, ...dates, datePreset: key === 'all' ? '' : key }));
            setPeriod(key);
            setPage(1);
          }}
          onReset={() => {
            setFilters(EMPTY_FILTERS);
            setPeriod('all');
            setPage(1);
          }}
        />

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-[138px] rounded-[20px] bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <PaymentKpiStrip kpis={analytics.kpis} />
        )}

        {!isLoading && <PaymentAnalytics analytics={analytics} />}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          <div className="space-y-4 min-w-0">
            <div className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">Recent Transactions</h2>
                <span className="text-xs font-medium text-slate-400">
                  {filtered.length} transaction{filtered.length === 1 ? '' : 's'}
                </span>
              </div>

              <PaymentTable
                payments={pageItems}
                selectedIds={selectedIds}
                onToggleRow={onToggleRow}
                onToggleAll={onToggleAll}
                onView={openPayment}
                onCollect={openCollect}
                onRefund={openRefund}
                onDelete={setDeleteTarget}
                canDelete={canDelete}
                compact
              />

              <TablePagination
                pageIndex={page - 1}
                pageSize={PAGE_SIZE}
                pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
                total={filtered.length}
                onPageChange={(idx) => setPage(idx + 1)}
                totalLabel="entries"
              />
            </div>
          </div>

          {!isLoading && (
            <PaymentInsightSidebar
              analytics={analytics}
              onSelect={openPayment}
              onAction={onQuickAction}
            />
          )}
        </div>
      </div>

      <PaymentDetailDrawer
        open={drawerOpen}
        payment={selected}
        onClose={() => setDrawerOpen(false)}
        onCollect={openCollect}
        onRefund={openRefund}
      />

      <AddPaymentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
        loading={saving}
        defaultInvoiceNumber={nextInvoiceNumber(payments)}
      />

      <CollectPaymentModal
        open={collectOpen}
        payment={selected}
        onClose={() => setCollectOpen(false)}
        onSubmit={handleCollect}
        loading={saving}
      />

      <RefundPaymentModal
        open={refundOpen}
        payment={selected}
        onClose={() => setRefundOpen(false)}
        onSubmit={handleRefund}
        loading={saving}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete payment?"
        message={`This will permanently remove ${deleteTarget?.invoiceNumber || 'this payment'}.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Fragment>
  );
}
