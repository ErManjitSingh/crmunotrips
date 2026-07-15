import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone,
  Mail,
  MapPin,
  Star,
  Flame,
  Pencil,
  ChevronRight,
  Eye,
  Wallet,
  ArrowDownCircle,
  CreditCard,
} from 'lucide-react';
import { formatLeadId } from '../leads/constants';
import LeadStatusBadge from '../leads/LeadStatusBadge';
import Avatar from '../ui/Avatar';
import API from '../../api/axios';
import { Button } from '../ui/button';
import PaymentVoucherModal from './PaymentVoucherModal';
import { normalizeLeadStatus } from '../../utils/leadUtils';
import {
  getInitials,
  formatSource,
  computeLeadScores,
  DETAIL_CARD,
} from './leadDetailUtils';
import { toast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';

function formatTravelRange(lead) {
  const start = lead?.travelDate || lead?.travelStartDate;
  const end = lead?.returnDate || lead?.travelEndDate;
  const fmt = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) return `${fmt(start)} - ${fmt(end)}`;
  if (start) return fmt(start);
  return '—';
}

function formatBudget(lead) {
  if (lead?.budgetRange && lead.budgetRange !== 'custom') {
    const map = {
      under_20000: 'Under ₹20,000',
      '20000_40000': '₹20,000 - ₹40,000',
      '40000_60000': '₹40,000 - ₹60,000',
      '60000_100000': '₹60,000 - ₹1,00,000',
      above_100000: 'Above ₹1,00,000',
    };
    return map[lead.budgetRange] || String(lead.budgetRange).replace(/_/g, ' ');
  }
  if (lead?.budget) return `₹${Number(lead.budget).toLocaleString('en-IN')}`;
  return '—';
}

function formatTravelers(lead) {
  const adults = lead.adults ?? Math.max(1, (lead.travelers || 2) - (lead.children || 0));
  const children = lead.children ?? 0;
  const a = `${adults} Adult${adults === 1 ? '' : 's'}`;
  const c = children > 0 ? `, ${children} Child${children === 1 ? '' : 'ren'}` : '';
  return `${a}${c}`;
}

function formatRelativeActivity(lead) {
  const raw = lead.lastContactedAt || lead.updatedAt || lead.lastActivityAt;
  if (!raw) return '—';
  const ms = Date.now() - new Date(raw).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatINR(n) {
  const num = Number(n || 0);
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`;
}

function ContactChip({ icon: Icon, children, href }) {
  const Comp = href ? 'a' : 'div';
  return (
    <Comp
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm',
        href && 'hover:border-violet-300 hover:text-violet-700 transition-colors'
      )}
    >
      <Icon className="w-4 h-4 text-violet-500 shrink-0" />
      <span className="truncate font-medium">{children}</span>
    </Comp>
  );
}

function OverviewRow({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-[13px] text-slate-500 shrink-0">{label}</span>
      <span className={cn('text-[13px] font-semibold text-slate-900 text-right', valueClass)}>{value}</span>
    </div>
  );
}

function PaymentMetric({ icon: Icon, label, value, tone }) {
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
    <div className={cn('rounded-2xl border px-3.5 py-3.5 sm:px-4 sm:py-4', t.card)}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-xl', t.icon)}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <p className={cn('text-[10px] font-bold uppercase tracking-wide', t.label)}>{label}</p>
      </div>
      <p className={cn('text-xl sm:text-2xl font-black tracking-tight metric-tabular leading-none', t.value)}>
        {formatINR(value)}
      </p>
    </div>
  );
}

export default function LeadDetailHeader({
  lead,
  backHref = '/leads',
  backLabel = 'Back to Leads',
  editHref,
  paymentSummary: summaryProp,
  receiptEndpoint,
}) {
  const status = normalizeLeadStatus(lead.status);
  const scores = computeLeadScores(lead);
  const temperature = lead.isHot || lead.temperature === 'hot' ? 'Hot' : (lead.temperature || 'Warm');
  const tempCapitalized = temperature.charAt(0).toUpperCase() + temperature.slice(1);
  const isConverted = status === 'converted';
  const scorePct = Math.max(0, Math.min(100, Number(scores.overall) || 0));
  const summary = summaryProp || lead?.paymentSummary;
  const showPayment = Boolean(summary);

  const [voucherOpen, setVoucherOpen] = useState(false);
  const [voucherHtml, setVoucherHtml] = useState('');
  const [voucherData, setVoucherData] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  const endpoint =
    receiptEndpoint ||
    (lead?._id ? `/leads/${lead._id}/payment-receipt` : null);

  const sendEndpoint = endpoint ? `${endpoint}/send` : null;

  const voucherLabel = summary?.receiptNumber
    ? `Voucher ${summary.receiptNumber}`
    : summary?.invoiceNumber
      ? `Invoice ${summary.invoiceNumber}`
      : 'Payment voucher';

  const openVoucher = async () => {
    if (!endpoint) return;
    setVoucherLoading(true);
    try {
      const { data } = await API.get(endpoint, { skipSuccessToast: true });
      setVoucherHtml(data.html || '');
      setVoucherData(data.voucher || null);
      setVoucherOpen(true);
    } catch {
      toast.error('Unable to load payment voucher');
    } finally {
      setVoucherLoading(false);
    }
  };

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Link
          to={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← {backLabel}
        </Link>
        {editHref ? (
          <Link
            to={editHref}
            className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold h-10 px-4 shadow-sm"
          >
            Edit Lead
            <ChevronRight className="w-4 h-4 opacity-80" />
          </Link>
        ) : null}
      </div>

      <div id="payment-advance" className={cn(DETAIL_CARD, 'overflow-hidden scroll-mt-24')}>
        <div className="p-5 sm:p-6 flex flex-col xl:flex-row min-w-0 xl:items-stretch gap-5">
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
              <div
                className={cn(
                  'w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full flex items-center justify-center text-2xl font-bold text-white shrink-0 shadow-md',
                  'bg-gradient-to-br from-violet-500 to-indigo-600'
                )}
              >
                {getInitials(lead.name)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                    {lead.name}
                  </h1>
                  <LeadStatusBadge status={status} pulse={status === 'new'} />
                  {(lead.isHot || temperature.toLowerCase() === 'hot') && (
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  )}
                </div>
                <p className="text-sm text-slate-500 mb-4">
                  {formatLeadId(lead._id || lead.leadId)} · Lead 360 · {lead.destination || '—'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {lead.phone ? (
                    <ContactChip icon={Phone} href={`tel:${lead.phone}`}>{lead.phone}</ContactChip>
                  ) : null}
                  {lead.email ? (
                    <ContactChip icon={Mail} href={`mailto:${lead.email}`}>{lead.email}</ContactChip>
                  ) : null}
                  <ContactChip icon={MapPin}>
                    {[lead.city, lead.state].filter(Boolean).join(', ') || lead.destination || 'India'}
                  </ContactChip>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-slate-100">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Source</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{formatSource(lead)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Created On</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">
                  {lead.createdAt
                    ? new Date(lead.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Last Activity</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{formatRelativeActivity(lead)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Assigned To</p>
                <div className="flex items-center gap-2 mt-0.5 min-w-0">
                  {lead.assignedTo?.name ? (
                    <>
                      <Avatar name={lead.assignedTo.name} size="sm" className="!w-6 !h-6 ring-2 ring-violet-200" />
                      <span className="text-sm font-semibold text-slate-800 truncate">{lead.assignedTo.name}</span>
                    </>
                  ) : (
                    <span className="text-sm text-slate-400">Unassigned</span>
                  )}
                  <span className="p-0.5 rounded text-slate-400" aria-hidden>
                    <Pencil className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </div>

            {showPayment ? (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Payment &amp; Advance</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{voucherLabel}</p>
                  </div>
                  <Button
                    type="button"
                    variant="emerald"
                    onClick={openVoucher}
                    disabled={voucherLoading}
                    className="rounded-xl h-9 px-4 gap-2 font-bold shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/40 shrink-0 self-start"
                  >
                    <Eye className="w-4 h-4" />
                    {voucherLoading ? 'Loading…' : 'View Voucher'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <PaymentMetric icon={Wallet} label="Package Total" value={summary.totalAmount} tone="violet" />
                  <PaymentMetric icon={ArrowDownCircle} label="Advance Received" value={summary.advanceReceived} tone="emerald" />
                  <PaymentMetric icon={CreditCard} label="Balance Due" value={summary.balanceDue} tone="amber" />
                </div>
                {summary.receiptSentAt ? (
                  <p className="text-[11px] text-slate-500">
                    Voucher emailed
                    {summary.receiptSentTo ? ` · ${summary.receiptSentTo}` : ''} ·{' '}
                    {new Date(summary.receiptSentAt).toLocaleString('en-IN')}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="xl:w-[300px] shrink-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col">
            <div className="pb-2.5 border-b border-slate-200/80">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[13px] text-slate-500">Lead Score</span>
                <span className="text-sm font-bold text-emerald-600">{scores.overall}/100</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                  style={{ width: `${scorePct}%` }}
                />
              </div>
            </div>

            <OverviewRow
              label="Lead Temperature"
              value={(
                <span className="inline-flex items-center gap-1 text-orange-600">
                  <Flame className="w-3.5 h-3.5" /> {tempCapitalized}
                </span>
              )}
            />
            <OverviewRow label="Travel Date" value={formatTravelRange(lead)} />
            <OverviewRow label="Travelers" value={formatTravelers(lead)} />
            <OverviewRow label="Budget" value={formatBudget(lead)} valueClass="text-violet-700" />

            <button
              type="button"
              onClick={() => document.getElementById('lead-customer-panel')?.scrollIntoView({ behavior: 'smooth' })}
              className="mt-3 inline-flex items-center justify-center gap-1 text-sm font-semibold text-violet-600 hover:text-violet-500"
            >
              View Full Details
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <PaymentVoucherModal
        open={voucherOpen}
        onClose={() => setVoucherOpen(false)}
        voucher={voucherData}
        html={voucherHtml}
        lead={lead}
        sendEndpoint={sendEndpoint}
      />
    </div>
  );
}
