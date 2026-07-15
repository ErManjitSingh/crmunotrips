import { Fragment, useState } from 'react';
import {
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Eye,
  Wallet,
  RotateCcw,
  Trash2,
  FileText,
  Mail,
  MessageCircle,
  Download,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { AnimatePresence, motion } from 'framer-motion';
import {
  formatDate,
  formatINR,
  getAvatarColor,
  getInitials,
  getMethodMeta,
  getStatusMeta,
  pendingAmount,
} from './paymentUtils';
import { cn } from '../../lib/utils';

function StatusPill({ status }) {
  const meta = getStatusMeta(status);
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border', meta.soft)}>
      <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', meta.color)} />
      {meta.label}
    </span>
  );
}

function RowActions({ payment, onView, onCollect, onRefund, onDelete, canDelete }) {
  const items = [
    { label: 'View', icon: Eye, onClick: () => onView(payment) },
    { label: 'Collect Payment', icon: Wallet, onClick: () => onCollect(payment) },
    { label: 'Generate Invoice', icon: FileText, onClick: () => onView(payment) },
    { label: 'Email Receipt', icon: Mail, onClick: () => onView(payment) },
    { label: 'WhatsApp Receipt', icon: MessageCircle, onClick: () => onView(payment) },
    { label: 'Download PDF', icon: Download, onClick: () => onView(payment) },
    { label: 'Refund', icon: RotateCcw, onClick: () => onRefund(payment) },
    ...(canDelete ? [{ label: 'Delete', icon: Trash2, onClick: () => onDelete(payment), danger: true }] : []),
  ];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="p-1.5 rounded-lg text-content-muted hover:bg-slate-100 hover:text-content-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-[250] min-w-[200px] rounded-xl border border-subtle bg-surface p-1.5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none',
                item.danger
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-content-secondary hover:bg-slate-50 hover:text-content-primary'
              )}
              onSelect={item.onClick}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default function PaymentTable({
  payments,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onView,
  onCollect,
  onRefund,
  onDelete,
  canDelete,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const allSelected = payments.length > 0 && payments.every((p) => selectedIds.has(p._id));
  const someSelected = payments.some((p) => selectedIds.has(p._id)) && !allSelected;

  if (!payments.length) {
    return (
      <div className="rounded-2xl border border-dashed border-subtle bg-surface px-6 py-16 text-center">
        <p className="text-lg font-semibold text-content-primary">No payments found</p>
        <p className="text-sm text-content-muted mt-1">Try adjusting filters or add a new payment to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-subtle bg-surface shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px]">
          <thead>
            <tr className="bg-slate-50/90 border-b border-subtle text-left">
              <th className="w-14 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onToggleAll}
                  className="w-4 h-4 rounded border-subtle text-indigo-500"
                />
              </th>
              {['Invoice', 'Customer', 'Destination', 'Executive', 'Amount', 'Received', 'Pending', 'Mode', 'Date', 'Status', ''].map((h) => (
                <th
                  key={h || 'actions'}
                  className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-content-muted whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const open = expandedId === payment._id;
              const method = getMethodMeta(payment.method);
              return (
                <Fragment key={payment._id}>
                  <tr
                    className="border-b border-subtle hover:bg-indigo-50/40 transition-colors cursor-pointer"
                    onClick={() => onView(payment)}
                  >
                    <td className="px-3 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="p-0.5 text-content-muted hover:text-content-primary"
                          onClick={() => setExpandedId(open ? null : payment._id)}
                        >
                          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(payment._id)}
                          onChange={() => onToggleRow(payment._id)}
                          className="w-4 h-4 rounded border-subtle text-indigo-500"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="font-mono text-sm font-bold text-indigo-600">{payment.invoiceNumber}</span>
                    </td>
                    <td className="px-3 py-3.5 min-w-[180px]">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0',
                            getAvatarColor(payment.customerName)
                          )}
                        >
                          {getInitials(payment.customerName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-content-primary truncate">{payment.customerName}</p>
                          <p className="text-[11px] text-content-muted truncate">
                            {payment.lead?.phone || payment.booking?.bookingNumber || '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      {payment.lead?.destination ? (
                        <span className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
                          {payment.lead.destination}
                        </span>
                      ) : (
                        <span className="text-content-muted text-sm">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-sm text-content-secondary whitespace-nowrap">
                      {payment.createdBy?.name || '—'}
                    </td>
                    <td className="px-3 py-3.5 text-sm font-semibold metric-tabular whitespace-nowrap">
                      {formatINR(payment.amount)}
                    </td>
                    <td className="px-3 py-3.5 text-sm font-semibold text-emerald-600 metric-tabular whitespace-nowrap">
                      {formatINR(payment.paidAmount)}
                    </td>
                    <td className="px-3 py-3.5 text-sm font-semibold text-amber-600 metric-tabular whitespace-nowrap">
                      {formatINR(pendingAmount(payment))}
                    </td>
                    <td className="px-3 py-3.5 text-xs font-medium text-content-secondary">{method.label}</td>
                    <td className="px-3 py-3.5 text-xs text-content-muted whitespace-nowrap">
                      {formatDate(payment.paidAt || payment.createdAt)}
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusPill status={payment.status} />
                    </td>
                    <td className="px-3 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <RowActions
                        payment={payment}
                        onView={onView}
                        onCollect={onCollect}
                        onRefund={onRefund}
                        onDelete={onDelete}
                        canDelete={canDelete}
                      />
                    </td>
                  </tr>
                  <AnimatePresence>
                    {open && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={11} className="p-0">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b border-subtle"
                          >
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-content-muted mb-2">
                                Customer
                              </p>
                              <p className="text-sm font-semibold">{payment.customerName}</p>
                              <p className="text-xs text-content-muted mt-1">{payment.lead?.email || '—'}</p>
                              <p className="text-xs text-content-muted">{payment.lead?.phone || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-content-muted mb-2">
                                Booking & Quote
                              </p>
                              <p className="text-xs text-content-secondary">
                                Destination:{' '}
                                <span className="font-medium text-content-primary">
                                  {payment.lead?.destination || '—'}
                                </span>
                              </p>
                              <p className="text-xs text-content-secondary mt-1">
                                Booking:{' '}
                                <span className="font-mono font-medium">
                                  {payment.booking?.bookingNumber || '—'}
                                </span>
                              </p>
                              <p className="text-xs text-content-secondary mt-1">
                                Quote:{' '}
                                <span className="font-mono font-medium">
                                  {payment.quotation?.quoteNumber || '—'}
                                </span>
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-content-muted mb-2">
                                Money Summary
                              </p>
                              <div className="space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-content-muted">Package</span>
                                  <span className="metric-tabular font-semibold">{formatINR(payment.amount)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-content-muted">Received</span>
                                  <span className="metric-tabular font-semibold text-emerald-600">
                                    {formatINR(payment.paidAmount)}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-content-muted">Pending</span>
                                  <span className="metric-tabular font-semibold text-amber-600">
                                    {formatINR(pendingAmount(payment))}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
