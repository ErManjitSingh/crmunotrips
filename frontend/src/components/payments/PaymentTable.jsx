import { Fragment } from 'react';
import {
  MoreHorizontal,
  Eye,
  Wallet,
  RotateCcw,
  Trash2,
  FileText,
  Mail,
  MessageCircle,
  Download,
  MapPin,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
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

function paymentDisplayId(payment) {
  const raw = payment.invoiceNumber || payment._id || '';
  if (String(raw).toUpperCase().startsWith('PAY-')) return raw;
  if (String(raw).toUpperCase().startsWith('INV-')) return String(raw).replace(/^INV-/i, 'PAY-');
  return `PAY-${String(raw).slice(-8).toUpperCase()}`;
}

function StatusPill({ status }) {
  const meta = getStatusMeta(status);
  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border', meta.soft)}>
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
          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-[250] min-w-[200px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <DropdownMenu.Item
              key={item.label}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer outline-none',
                item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-50'
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
  compact = false,
}) {
  const allSelected = payments.length > 0 && payments.every((p) => selectedIds.has(p._id));
  const someSelected = payments.some((p) => selectedIds.has(p._id)) && !allSelected;

  if (!payments.length) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
        <p className="text-lg font-semibold text-slate-900">No payments found</p>
        <p className="text-sm text-slate-500 mt-1">Try adjusting filters or add a new payment.</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                {['Invoice ID', 'Customer', 'Date', 'Amount', 'Status', 'Payment Mode', ''].map((heading) => (
                  <th
                    key={heading || 'actions'}
                    className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const method = getMethodMeta(payment.method);
                return (
                  <tr
                    key={payment._id}
                    onClick={() => onView(payment)}
                    className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-violet-50/40"
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs font-semibold text-violet-600">
                        {payment.invoiceNumber || paymentDisplayId(payment)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
                            getAvatarColor(payment.customerName)
                          )}
                        >
                          {getInitials(payment.customerName)}
                        </span>
                        <span className="text-sm font-semibold text-slate-800">{payment.customerName}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-xs text-slate-500">
                      {formatDate(payment.paidAt || payment.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-sm font-bold text-slate-900 metric-tabular">
                      {formatINR(payment.amount)}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusPill status={payment.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: method.color }} />
                        {method.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-100 text-left">
              <th className="w-12 px-4 py-3.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={onToggleAll}
                  className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500/30"
                />
              </th>
              {[
                'Payment ID',
                'Invoice',
                'Customer',
                'Booking ID',
                'Destination',
                'Amount',
                'Received',
                'Pending',
                'Status',
                'Payment Mode',
                'Payment Date',
                '',
              ].map((h) => (
                <th
                  key={h || 'actions'}
                  className="px-3 py-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const method = getMethodMeta(payment.method);
              return (
                <Fragment key={payment._id}>
                  <tr
                    className="border-b border-slate-100 last:border-0 hover:bg-violet-50/40 transition-colors cursor-pointer"
                    onClick={() => onView(payment)}
                  >
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(payment._id)}
                        onChange={() => onToggleRow(payment._id)}
                        className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500/30"
                      />
                    </td>
                    <td className="px-3 py-3.5">
                      <button
                        type="button"
                        className="font-mono text-sm font-semibold text-violet-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onView(payment);
                        }}
                      >
                        {paymentDisplayId(payment)}
                      </button>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="font-mono text-sm font-medium text-sky-600">
                        {payment.invoiceNumber || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 min-w-[190px]">
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
                          <p className="text-sm font-semibold text-slate-900 truncate">{payment.customerName}</p>
                          <p className="text-[11px] text-slate-400 truncate">{payment.lead?.phone || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="font-mono text-xs font-medium text-slate-600">
                        {payment.booking?.bookingNumber || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      {payment.lead?.destination ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-50 text-slate-700 border border-slate-200">
                          <MapPin className="w-3 h-3 text-violet-500" />
                          {payment.lead.destination}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-sm font-semibold metric-tabular whitespace-nowrap text-slate-900">
                      {formatINR(payment.amount)}
                    </td>
                    <td className="px-3 py-3.5 text-sm font-semibold text-emerald-600 metric-tabular whitespace-nowrap">
                      {formatINR(payment.paidAmount)}
                    </td>
                    <td className="px-3 py-3.5 text-sm font-semibold text-amber-600 metric-tabular whitespace-nowrap">
                      {formatINR(pendingAmount(payment))}
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusPill status={payment.status} />
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="text-xs font-medium text-slate-600">{method.label}</span>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(payment.paidAt || payment.createdAt)}
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
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
