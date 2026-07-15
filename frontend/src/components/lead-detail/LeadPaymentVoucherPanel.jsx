import { useState } from 'react';
import {
  Eye,
  Printer,
  Wallet,
  ArrowDownCircle,
  CreditCard,
} from 'lucide-react';
import API from '../../api/axios';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import { DETAIL_CARD } from './leadDetailUtils';
import { toast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';

function formatINR(n) {
  const num = Number(n || 0);
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`;
}

function MetricCard({ icon: Icon, label, value, tone }) {
  const tones = {
    violet: {
      card: 'bg-[#f5f3ff] border-[#ddd6fe]',
      icon: 'bg-violet-100 text-violet-600',
      label: 'text-violet-700/80',
      value: 'text-violet-950',
    },
    emerald: {
      card: 'bg-[#ecfdf5] border-[#a7f3d0]',
      icon: 'bg-emerald-100 text-emerald-600',
      label: 'text-emerald-700/80',
      value: 'text-emerald-950',
    },
    amber: {
      card: 'bg-[#fff7ed] border-[#fed7aa]',
      icon: 'bg-amber-100 text-amber-600',
      label: 'text-amber-700/80',
      value: 'text-amber-950',
    },
  };
  const t = tones[tone] || tones.violet;

  return (
    <div className={cn('rounded-2xl border px-4 py-4 sm:px-5 sm:py-5', t.card)}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className={cn('inline-flex h-9 w-9 items-center justify-center rounded-xl', t.icon)}>
          <Icon className="w-4 h-4" />
        </span>
        <p className={cn('text-[11px] font-bold uppercase tracking-wide', t.label)}>{label}</p>
      </div>
      <p className={cn('text-2xl sm:text-[28px] font-black tracking-tight metric-tabular leading-none', t.value)}>
        {formatINR(value)}
      </p>
    </div>
  );
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

  const voucherLabel = summary.receiptNumber
    ? `Voucher ${summary.receiptNumber}`
    : summary.invoiceNumber
      ? `Invoice ${summary.invoiceNumber}`
      : 'Payment voucher';

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
      <div id="payment-advance" className={cn(DETAIL_CARD, 'overflow-hidden mb-6 scroll-mt-24')}>
        <div className="px-5 pt-5 pb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Payment &amp; Advance</h3>
            <p className="text-xs text-slate-500 mt-0.5">{voucherLabel}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={openVoucher}
            disabled={loading}
            className="rounded-xl h-10 px-4 gap-2 border-slate-200 text-slate-700 font-semibold bg-white hover:bg-slate-50 shrink-0"
          >
            <Eye className="w-4 h-4" />
            {loading ? 'Loading…' : 'View Voucher'}
          </Button>
        </div>

        <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard icon={Wallet} label="Package Total" value={summary.totalAmount} tone="violet" />
          <MetricCard icon={ArrowDownCircle} label="Advance Received" value={summary.advanceReceived} tone="emerald" />
          <MetricCard icon={CreditCard} label="Balance Due" value={summary.balanceDue} tone="amber" />
        </div>

        {summary.receiptSentAt ? (
          <div className="px-5 pb-4 -mt-1">
            <p className="text-[11px] text-slate-500">
              Voucher emailed to customer
              {summary.receiptSentTo ? ` · ${summary.receiptSentTo}` : ''} ·{' '}
              {new Date(summary.receiptSentAt).toLocaleString('en-IN')}
            </p>
          </div>
        ) : null}
      </div>

      <AppModal open={open} onClose={() => setOpen(false)} size="lg" className="p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-subtle flex items-center justify-between gap-3 bg-white">
          <div>
            <h3 className="text-lg font-bold text-content-primary">Payment Voucher</h3>
            <p className="text-xs text-content-muted mt-0.5">{voucherLabel}</p>
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
