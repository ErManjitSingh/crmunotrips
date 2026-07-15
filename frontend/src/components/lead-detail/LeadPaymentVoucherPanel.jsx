import { useState } from 'react';
import { Eye, Printer, Wallet } from 'lucide-react';
import API from '../../api/axios';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import { DETAIL_CARD } from './leadDetailUtils';
import { toast } from '../../context/ToastContext';

function formatINR(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

export default function LeadPaymentVoucherPanel({
  lead,
  paymentSummary: summaryProp,
  receiptEndpoint,
}) {
  const summary = summaryProp || lead?.paymentSummary;
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);

  if (!summary && lead?.status !== 'converted') return null;
  if (!summary) return null;

  const endpoint =
    receiptEndpoint ||
    (lead?._id ? `/leads/${lead._id}/payment-receipt` : null);

  const openVoucher = async () => {
    if (!endpoint) return;
    setLoading(true);
    try {
      const { data } = await API.get(endpoint, { skipSuccessToast: true });
      setHtml(data.html || '');
      setOpen(true);
    } catch {
      toast.error('Unable to load payment voucher');
    } finally {
      setLoading(false);
    }
  };

  const printVoucher = () => {
    if (!html) return;
    const w = window.open('', '_blank', 'noopener,noreferrer,width=800,height=900');
    if (!w) {
      toast.error('Popup blocked — allow popups to print voucher');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  return (
    <>
      <div className={`${DETAIL_CARD} overflow-hidden mb-6`}>
        <div className="px-5 py-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 dark:border-emerald-800/40">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Wallet className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Payment & Advance</h3>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                {summary.receiptNumber
                  ? `Voucher ${summary.receiptNumber}`
                  : summary.invoiceNumber
                    ? `Invoice ${summary.invoiceNumber}`
                    : 'Conversion payment summary'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Package Total</p>
            <p className="text-lg font-black text-slate-900 metric-tabular mt-1">{formatINR(summary.totalAmount)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Advance Received</p>
            <p className="text-lg font-black text-emerald-800 metric-tabular mt-1">{formatINR(summary.advanceReceived)}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Balance Due</p>
            <p className="text-lg font-black text-amber-800 metric-tabular mt-1">{formatINR(summary.balanceDue)}</p>
          </div>
        </div>

        <div className="px-5 pb-5 flex flex-wrap items-center gap-2">
          {(summary.hasReceipt || summary.receiptNumber || summary.paymentId) && (
            <Button
              type="button"
              onClick={openVoucher}
              disabled={loading}
              className="rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
            >
              <Eye className="w-4 h-4" />
              {loading ? 'Loading…' : 'View Voucher'}
            </Button>
          )}
          {summary.receiptSentAt ? (
            <p className="text-[11px] text-slate-500 ml-auto">
              Sent to customer{summary.receiptSentTo ? ` (${summary.receiptSentTo})` : ''} ·{' '}
              {new Date(summary.receiptSentAt).toLocaleString('en-IN')}
            </p>
          ) : (
            <p className="text-[11px] text-amber-700/80">
              Customer email is sent automatically when lead is converted (if email exists).
            </p>
          )}
        </div>
      </div>

      <AppModal open={open} onClose={() => setOpen(false)} size="lg" className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-subtle flex items-center justify-between gap-3 bg-emerald-50/80">
          <div>
            <h3 className="text-lg font-bold text-content-primary">Payment Voucher</h3>
            <p className="text-xs text-content-muted mt-0.5">
              Advance {formatINR(summary.advanceReceived)} · Balance {formatINR(summary.balanceDue)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-xl gap-2" onClick={printVoucher}>
              <Printer className="w-4 h-4" /> Print
            </Button>
            <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-auto bg-slate-100">
          {html ? (
            <iframe title="Payment voucher" srcDoc={html} className="w-full min-h-[70vh] border-0 bg-white" />
          ) : (
            <p className="p-8 text-center text-sm text-slate-500">No voucher HTML available</p>
          )}
        </div>
      </AppModal>
    </>
  );
}
