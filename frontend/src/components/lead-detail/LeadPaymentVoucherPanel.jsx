import { useState } from 'react';
import {
  Eye,
  Wallet,
  ArrowDownCircle,
  CreditCard,
} from 'lucide-react';
import API from '../../api/axios';
import { Button } from '../ui/button';
import PaymentVoucherModal from './PaymentVoucherModal';
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
  const [voucher, setVoucher] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!summary && lead?.status !== 'converted') return null;
  if (!summary) return null;

  const endpoint =
    receiptEndpoint ||
    (lead?._id ? `/leads/${lead._id}/payment-receipt` : null);

  const sendEndpoint = endpoint ? `${endpoint}/send` : null;

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
      setVoucher(data.voucher || null);
      setOpen(true);
    } catch {
      toast.error('Unable to load payment voucher');
    } finally {
      setLoading(false);
    }
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
            variant="emerald"
            onClick={openVoucher}
            disabled={loading}
            className="rounded-xl h-10 px-4 gap-2 font-bold shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/40 shrink-0"
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

        {(summary.paymentScreenshots?.length || summary.paymentScreenshotUrl) ? (
          <div className="px-5 pb-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">
              Payment screenshot{(summary.paymentScreenshots?.length || 0) > 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {(summary.paymentScreenshots?.length
                ? summary.paymentScreenshots
                : [{ url: summary.paymentScreenshotUrl, name: summary.paymentScreenshotName }]
              ).map((shot) => (
                <a
                  key={shot.url}
                  href={shot.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {shot.name || 'View payment proof'}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <PaymentVoucherModal
        open={open}
        onClose={() => setOpen(false)}
        voucher={voucher}
        html={html}
        lead={lead}
        sendEndpoint={sendEndpoint}
      />
    </>
  );
}
