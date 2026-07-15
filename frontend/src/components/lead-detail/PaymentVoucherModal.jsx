import { useMemo, useState } from 'react';
import {
  X,
  Printer,
  FileText,
  Download,
  Send,
  ChevronDown,
  Loader2,
  User,
  MapPin,
  Calendar,
  Layers,
  FileSpreadsheet,
  CreditCard,
  Wallet,
  ArrowDownToLine,
  Phone,
  Check,
} from 'lucide-react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { toast } from '../../context/ToastContext';
import API from '../../api/axios';
import { downloadVoucherPdf, printVoucherHtml } from './voucherPdf';

function formatINR(n) {
  const num = Number(n || 0);
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`;
}

function InfoCell({ icon: Icon, iconClass, label, value, children }) {
  return (
    <div className="p-3.5 sm:p-4 min-h-[88px]">
      <div className="flex items-start gap-2.5">
        <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl shrink-0', iconClass)}>
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-slate-400">{label}</p>
          <div className="mt-0.5 text-[15px] font-extrabold text-slate-900 leading-snug break-words">
            {value}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function MoneyCard({ icon: Icon, label, value, tone }) {
  const tones = {
    total: {
      card: 'bg-emerald-50',
      icon: 'bg-emerald-200/80 text-emerald-700',
      label: 'text-emerald-700',
      value: 'text-emerald-950',
    },
    advance: {
      card: 'bg-emerald-100/80',
      icon: 'bg-emerald-300/70 text-emerald-800',
      label: 'text-emerald-700',
      value: 'text-emerald-950',
    },
    balance: {
      card: 'bg-orange-100/70',
      icon: 'bg-orange-300/70 text-orange-700',
      label: 'text-orange-700',
      value: 'text-orange-800',
    },
  };
  const t = tones[tone] || tones.total;
  return (
    <div className={cn('rounded-2xl p-4', t.card)}>
      <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg mb-2.5', t.icon)}>
        <Icon className="w-3.5 h-3.5" />
      </span>
      <p className={cn('text-[10px] font-bold uppercase tracking-wide mb-1', t.label)}>{label}</p>
      <p className={cn('text-xl sm:text-2xl font-extrabold tracking-tight metric-tabular', t.value)}>
        {formatINR(value)}
      </p>
    </div>
  );
}

export default function PaymentVoucherModal({
  open,
  onClose,
  voucher,
  html,
  lead,
  sendEndpoint,
}) {
  const [sending, setSending] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const v = useMemo(() => voucher || null, [voucher]);
  const receiptNo = v?.receiptNumber || v?.invoiceNumber || 'payment-voucher';

  const printVoucher = async () => {
    if (!html) {
      toast.error('Voucher not ready to print');
      return;
    }
    try {
      await printVoucherHtml(html, `Payment Voucher ${receiptNo}`);
    } catch {
      toast.error('Unable to print voucher');
    }
  };

  const downloadPdf = async () => {
    if (!html) {
      toast.error('Voucher not ready');
      return;
    }
    setDownloading(true);
    try {
      await downloadVoucherPdf(html, `${receiptNo}.pdf`);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  const sendToCustomer = async () => {
    if (!sendEndpoint) {
      toast.error('Send is not available for this lead');
      return;
    }
    setSending(true);
    setSendOpen(false);
    try {
      const { data } = await API.post(sendEndpoint, {}, { skipSuccessToast: true });
      if (data?.sent === false) {
        const reasons = {
          no_email: 'Customer email is missing',
          email_not_configured: 'Email is not configured on server',
          no_receipt: 'Receipt not found',
        };
        toast.error(reasons[data.reason] || 'Could not send voucher');
        return;
      }
      toast.success(`Voucher sent${data?.to?.length ? ` to ${data.to.join(', ')}` : ''}`);
    } catch {
      toast.error('Failed to send voucher');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppModal open={open} onClose={onClose} size="3xl" className="p-0 overflow-hidden bg-white" panelClassName="max-w-[760px]">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shrink-0">
            <FileText className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-slate-900">Payment Voucher</h3>
            <p className="text-xs text-slate-500 truncate">Voucher {receiptNo}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={printVoucher}
            className="rounded-xl h-9 gap-2 border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hidden sm:inline-flex"
          >
            <Printer className="w-4 h-4" /> Print Voucher
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="max-h-[min(72vh,780px)] overflow-y-auto bg-white">
        {v ? (
          <div className="p-4 sm:p-5">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white px-5 py-6 sm:px-7 sm:py-7">
              <div className="absolute -right-10 -top-16 w-56 h-56 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -left-16 -bottom-20 w-48 h-48 rounded-full bg-black/10 pointer-events-none" />
              <div className="relative z-[1] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/85">UNO TRIPS</p>
                  <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight mt-1.5 leading-tight">
                    Advance / Token Receipt
                  </h2>
                  <p className="text-sm text-white/90 mt-2">
                    Voucher ID: {v.receiptNumber} · {v.paidAtLabel}
                  </p>
                </div>
                <div className="bg-white rounded-2xl px-4 py-3.5 shadow-lg shadow-black/15 min-w-[180px]">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-emerald-600 leading-tight">Payment Received</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Thank you for your payment</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {v.company ? (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-[1.2fr_.8fr] gap-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 mb-2">Company</p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    <span className="font-bold text-slate-900">{v.company.name}</span>
                    {v.company.tagline ? ` · ${v.company.tagline}` : ''}
                  </p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{v.company.address}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    <span className="font-semibold text-slate-800">GSTIN:</span> {v.company.gstin}
                    {' · '}
                    <span className="font-semibold text-slate-800">PAN:</span> {v.company.pan}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    <span className="font-semibold text-slate-800">HSN:</span> {v.company.hsn || v.hsn}
                    {' · '}Original for Recipient
                  </p>
                  {v.company.phone ? (
                    <p className="text-xs text-slate-600 mt-0.5">
                      <span className="font-semibold text-slate-800">Phone:</span> {v.company.phone}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500 mb-2">Guest</p>
                  <p className="text-xs text-slate-700">
                    <span className="font-bold text-slate-900">{v.customerName}</span> · {v.leadBadge}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    <span className="font-semibold text-slate-800">Phone:</span> {v.customerPhone}
                  </p>
                  {v.customerEmail ? (
                    <p className="text-xs text-slate-600 mt-0.5">
                      <span className="font-semibold text-slate-800">Email:</span> {v.customerEmail}
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-600 mt-0.5">
                    <span className="font-semibold text-slate-800">GSTIN:</span> {v.customerGstin || '—'}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 rounded-2xl border border-slate-100 overflow-hidden divide-y sm:divide-y-0 sm:[&>*]:border-r sm:[&>*:nth-child(3n)]:border-r-0 sm:[&>*:nth-child(n+4)]:border-t border-slate-100 [&>*]:border-slate-100">
              <InfoCell
                icon={User}
                iconClass="bg-emerald-100 text-emerald-600"
                label="Customer"
                value={(
                  <span className="inline-flex items-center gap-2 flex-wrap">
                    <span>{v.customerName}</span>
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                      {v.leadBadge}
                    </span>
                  </span>
                )}
              >
                <p className="mt-1 text-xs text-slate-500 inline-flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {v.customerPhone}
                </p>
              </InfoCell>

              <InfoCell
                icon={MapPin}
                iconClass="bg-violet-100 text-violet-600"
                label="Destination"
                value={v.destination}
              >
                {v.destinationSub ? <p className="mt-1 text-xs text-slate-500">{v.destinationSub}</p> : null}
              </InfoCell>

              <InfoCell
                icon={Calendar}
                iconClass="bg-sky-100 text-sky-600"
                label="Travel Date"
                value={v.travelDate}
              >
                {v.travelWeekday ? <p className="mt-1 text-xs text-slate-500">{v.travelWeekday}</p> : null}
              </InfoCell>

              <InfoCell
                icon={Layers}
                iconClass="bg-amber-100 text-amber-600"
                label="Booking / Quote"
                value={v.quoteNumber !== '—' ? v.quoteNumber : v.bookingNumber}
              />

              <InfoCell
                icon={FileSpreadsheet}
                iconClass="bg-indigo-100 text-indigo-600"
                label="Invoice No."
                value={v.invoiceNumber}
              >
                <p className="mt-1 text-xs text-slate-500">Generated on {v.invoiceGeneratedOn}</p>
              </InfoCell>

              <InfoCell
                icon={CreditCard}
                iconClass="bg-pink-100 text-pink-600"
                label="Payment Mode"
                value={v.paymentMethod}
              >
                <p className="mt-1 text-xs text-slate-500">
                  {v.paymentRef ? `Ref: ${v.paymentRef}` : 'Confirmed'}
                </p>
              </InfoCell>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MoneyCard icon={Wallet} label="Package Total" value={v.totalAmount} tone="total" />
              <MoneyCard icon={ArrowDownToLine} label="Advance Received" value={v.advanceReceived} tone="advance" />
              <MoneyCard icon={FileText} label="Balance Due" value={v.balanceDue} tone="balance" />
            </div>

            {v.grandTotal != null ? (
              <div className="mt-4 rounded-2xl border border-slate-100 overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  <span>Particulars</span>
                  <span>Amount (₹)</span>
                </div>
                {[
                  { label: 'Token Amount', value: v.subTotal },
                  { label: 'Sub Total', value: v.subTotal, decimals: 0 },
                  { label: `CGST ${v.cgstRate ?? 2.5}%`, value: v.cgst, decimals: 0 },
                  { label: `SGST ${v.sgstRate ?? 2.5}%`, value: v.sgst, decimals: 0 },
                ].map((row) => (
                  <div key={row.label} className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-2.5 border-t border-slate-100 text-xs">
                    <span className="text-slate-700">{row.label}</span>
                    <span className="font-bold text-slate-900 metric-tabular">
                      {Number(row.value || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: row.decimals ?? 2,
                        maximumFractionDigits: row.decimals ?? 2,
                      })}
                    </span>
                  </div>
                ))}
                <div className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-3 border-t border-emerald-100 bg-emerald-50 text-sm font-extrabold text-emerald-950">
                  <span>Grand Total</span>
                  <span className="metric-tabular">
                    {Number(v.grandTotal || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            ) : null}

            {v.company?.bankName ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-800 mb-1">Bank Details</p>
                <p className="text-xs font-semibold text-amber-950 leading-relaxed">
                  {v.company.bankName} · A/C: {v.company.accountNo} · IFSC: {v.company.ifsc}
                </p>
              </div>
            ) : null}

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3.5">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-amber-800 mb-2">Terms &amp; Conditions</p>
              <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed text-stone-600">
                <li>All payments to be made against the receipt of UNO Trips.</li>
                <li>Interest will be charged @ 18% if not paid to us on presentation.</li>
                <li>No claim and discrepancy shall be considered if not sent to us in writing and acknowledged by us within three days.</li>
                <li>Please credit the amount in our bank account as mentioned above.</li>
                <li>Computer generated signature is not required.</li>
                <li>All disputes are subject to HO Shimla.</li>
              </ol>
            </div>

            <div className="mt-4 flex gap-3 rounded-2xl bg-sky-50 px-4 py-3.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white text-[11px] font-bold shrink-0 mt-0.5">
                i
              </span>
              <div>
                <p className="text-sm font-bold text-blue-700">Important Note</p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  This is an advance receipt for the above booking. Balance payment is required before the travel date.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="p-10 text-center text-sm text-slate-500">No voucher data available</p>
        )}
      </div>

      <div className="px-5 py-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sticky bottom-0">
        <Button
          type="button"
          variant="outline"
          onClick={downloadPdf}
          disabled={downloading || !html}
          className="rounded-xl h-10 gap-2 border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-semibold"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {downloading ? 'Preparing PDF…' : 'Download PDF'}
        </Button>

        <div className="relative flex w-full sm:w-auto">
          <Button
            type="button"
            disabled={sending || !sendEndpoint}
            onClick={sendToCustomer}
            className="rounded-l-xl rounded-r-none h-10 gap-2 flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/20 border-0"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Sending…' : 'Send to Customer'}
          </Button>
          <button
            type="button"
            disabled={sending || !sendEndpoint}
            onClick={() => setSendOpen((o) => !o)}
            className="rounded-r-xl h-10 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white border-l border-emerald-500/40 disabled:opacity-50"
            aria-label="More send options"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          {sendOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl border border-slate-200 bg-white shadow-xl p-1 z-20">
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 text-slate-700"
                onClick={sendToCustomer}
              >
                Email customer
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 text-slate-700"
                onClick={() => {
                  setSendOpen(false);
                  printVoucher();
                }}
              >
                Print instead
              </button>
            </div>
          )}
        </div>
      </div>
      {!lead?.email ? (
        <p className="px-5 pb-3 -mt-2 text-[11px] text-amber-600">
          Tip: add customer email on the lead to send this voucher.
        </p>
      ) : null}
    </AppModal>
  );
}
