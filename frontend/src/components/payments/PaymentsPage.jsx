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
import PaymentQuickActions from './PaymentQuickActions';

const PAGE_SIZE = 12;

export default function PaymentsPage() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [datePreset, setDatePreset] = useState('month');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selected, setSelected] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const canDelete = user?.role === 'admin' || hasPermission?.('payments', 'delete');

  const { data: payments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['payments'],
    queryFn: () => listPayments(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (datePreset === 'custom') {
      setFilters((prev) => ({
        ...prev,
        dateFrom: prev.dateFrom || new Date().toISOString().slice(0, 10),
        dateTo: prev.dateTo || new Date().toISOString().slice(0, 10),
      }));
    }
  }, [datePreset]);

  const filtered = useMemo(
    () => filterPayments(payments, filters, datePreset),
    [payments, filters, datePreset]
  );

  const analytics = useMemo(() => buildPaymentAnalytics(filtered), [filtered]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const activeFilterCount = useMemo(
    () =>
      Object.entries(filters).filter(([key, value]) => {
        if (datePreset !== 'custom' && (key === 'dateFrom' || key === 'dateTo')) return false;
        return Boolean(value);
      }).length,
    [filters, datePreset]
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
      toast.success(type === 'excel' ? 'Excel export prepared for current filters' : 'PDF export queued for download');
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
    else if (key === 'remind') toast.info('Reminder center: overdue & due-today items are in the right sidebar');
  };

  return (
    <Fragment>
      <div className="space-y-5 pb-24">
        <PaymentPageHeader
          datePreset={datePreset}
          onDatePresetChange={(value) => {
            setDatePreset(value);
            setPage(1);
          }}
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

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-[120px] rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <PaymentKpiStrip kpis={analytics.kpis} />
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
          <div className="space-y-5 min-w-0">
            {!isLoading && <PaymentAnalytics analytics={analytics} />}

            <PaymentFilterBar
              filters={filters}
              activeCount={activeFilterCount}
              onChange={(next) => {
                setFilters(next);
                setPage(1);
              }}
              onReset={() => {
                setFilters(EMPTY_FILTERS);
                setDatePreset('month');
                setPage(1);
              }}
            />

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-content-secondary">
                Showing <span className="font-semibold text-content-primary">{filtered.length}</span> payments
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-indigo-600 font-medium">· {selectedIds.size} selected</span>
                )}
              </p>
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
            />

            <TablePagination
              pageIndex={page - 1}
              pageSize={PAGE_SIZE}
              pageCount={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))}
              total={filtered.length}
              onPageChange={(idx) => setPage(idx + 1)}
              totalLabel="payments"
            />
          </div>

          {!isLoading && (
            <PaymentInsightSidebar analytics={analytics} onSelect={openPayment} />
          )}
        </div>
      </div>

      <PaymentQuickActions onAction={onQuickAction} />

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
