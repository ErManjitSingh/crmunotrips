import { useMemo, useState } from 'react';
import {
  X,
  Printer,
  FileText,
  Download,
  Send,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import { toast } from '../../context/ToastContext';
import API from '../../api/axios';
import { downloadVoucherPdf, printVoucherHtml } from './voucherPdf';

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
      await printVoucherHtml(html, `Tax Invoice ${receiptNo}`);
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
    <AppModal open={open} onClose={onClose} size="2xl" className="p-0 overflow-hidden bg-white" panelClassName="max-w-[680px]">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shrink-0">
            <FileText className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Tax Invoice / Voucher</h3>
            <p className="text-[11px] text-slate-500 truncate">
              {v?.invoiceNumber ? `Invoice ${v.invoiceNumber}` : `Voucher ${receiptNo}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={printVoucher}
            className="rounded-xl h-8 gap-1.5 px-3 text-xs border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hidden sm:inline-flex"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[min(62vh,560px)] overflow-y-auto bg-slate-100">
        {html ? (
          <iframe
            title="Payment tax invoice"
            srcDoc={html}
            className="w-full min-h-[480px] border-0 bg-white"
          />
        ) : (
          <p className="p-8 text-center text-sm text-slate-500">No voucher data available</p>
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
