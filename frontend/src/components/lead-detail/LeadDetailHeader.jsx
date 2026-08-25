import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone,
  Mail,
  MapPin,
  Flame,
  ChevronRight,
  Eye,
  Wallet,
  ArrowDownCircle,
  CreditCard,
  CalendarDays,
  Users,
  Sparkles,
} from 'lucide-react';
import { formatLeadId } from '../leads/constants';
import LeadStatusBadge from '../leads/LeadStatusBadge';
import Avatar from '../ui/Avatar';
import API from '../../api/axios';
import { Button } from '../ui/button';
import PaymentVoucherModal from './PaymentVoucherModal';
import { normalizeLeadStatus } from '../../utils/leadUtils';
import { getLeadListStatusDisplay } from '../../lib/executiveStatusDisplay';
import {
  getInitials,
  formatSource,
  computeLeadScores,
} from './leadDetailUtils';
import { toast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import RepeatedLeadBadge from '../leads/RepeatedLeadBadge';

function formatTravelRange(lead) {
  const start = lead?.travelDate || lead?.travelStartDate;
  const end = lead?.returnDate || lead?.travelEndDate;
  const fmt = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  return '—';
}

function formatBudget(lead) {
  if (lead?.budgetRange && lead.budgetRange !== 'custom') {
    const map = {
      under_20000: 'Under ₹20k',
      '20000_40000': '₹20k – ₹40k',
      '40000_60000': '₹40k – ₹60k',
      '60000_100000': '₹60k – ₹1L',
      above_100000: 'Above ₹1L',
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
  const c = children > 0 ? ` · ${children} Child${children === 1 ? '' : 'ren'}` : '';
  return `${a}${c}`;
}

function formatRelativeActivity(lead) {
  const raw = lead.lastContactedAt || lead.updatedAt || lead.lastActivityAt;
  if (!raw) return '—';
  const ms = Date.now() - new Date(raw).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatINR(n) {
  const num = Number(n || 0);
  return `₹${num.toLocaleString('en-IN', { maximumFractionDigits: 1 })}`;
}

function MetaPill({ label, value, children }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/50 bg-white/70 px-2.5 py-1.5 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/60">
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      {children || (
        <p className="mt-0.5 truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">{value}</p>
      )}
    </div>
  );
}

function TravelChip({ icon: Icon, label, value, tone = 'violet' }) {
  const tones = {
    violet: 'border-violet-100 bg-violet-50/80 text-violet-800',
    amber: 'border-amber-100 bg-amber-50/80 text-amber-800',
    sky: 'border-sky-100 bg-sky-50/80 text-sky-800',
    rose: 'border-rose-100 bg-rose-50/80 text-rose-800',
  };
  return (
    <div className={cn('flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1.5', tones[tone])}>
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-wide opacity-70">{label}</p>
        <p className="truncate text-[11px] font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

function PaymentMetric({ icon: Icon, label, value, tone }) {
  const tones = {
    violet: {
      card: 'bg-violet-50 border-violet-100',
      icon: 'bg-violet-100 text-violet-600',
      value: 'text-violet-950',
    },
    emerald: {
      card: 'bg-emerald-50 border-emerald-100',
      icon: 'bg-emerald-100 text-emerald-600',
      value: 'text-emerald-950',
    },
    amber: {
      card: 'bg-amber-50 border-amber-100',
      icon: 'bg-amber-100 text-amber-600',
      value: 'text-amber-950',
    },
  };
  const t = tones[tone] || tones.violet;

  return (
    <div className={cn('rounded-xl border px-2.5 py-2', t.card)}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-lg', t.icon)}>
          <Icon className="h-3 w-3" />
        </span>
        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className={cn('text-base font-black tracking-tight metric-tabular leading-none', t.value)}>
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
  const listDisplay = getLeadListStatusDisplay(lead);
  // Show the option the user selected (e.g. Ready to Book), not just Warm/Hot/Cold
  const tempCapitalized = listDisplay.label || 'No status';
  const isHot = listDisplay.bucket === 'hot';
  const isWorking = listDisplay.bucket === 'working';
  const isConverted = listDisplay.bucket === 'converted';
  const scorePct = Math.max(0, Math.min(100, Number(scores.overall) || 0));
  const summary = summaryProp || lead?.paymentSummary;
  const showPayment = Boolean(summary);
  const location = [lead.city, lead.state].filter(Boolean).join(', ') || lead.destination || 'India';

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
    <div className="mb-4">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <Link
          to={backHref}
          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-500"
        >
          ← {backLabel}
        </Link>
        {editHref ? (
          <Link
            to={editHref}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-violet-500"
          >
            Edit Lead
            <ChevronRight className="h-3.5 w-3.5 opacity-80" />
          </Link>
        ) : null}
      </div>

      <div
        id="payment-advance"
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-violet-100/80 bg-gradient-to-br from-violet-50 via-white to-sky-50 shadow-sm shadow-violet-500/5 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950"
      >
        <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-sky-400" />

        <div className="p-3.5 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
            {/* Identity */}
            <div className="flex min-w-0 flex-1 gap-3">
              <div className="relative shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-lg font-bold text-white shadow-md shadow-violet-500/30 sm:h-14 sm:w-14 sm:text-xl">
                  {getInitials(lead.name)}
                </div>
                {isHot && (
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white ring-2 ring-white shadow-sm">
                    <Flame className="h-3 w-3" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {(lead.isRepeatCustomer || lead.isVip) && (
                  <div className="mb-1">
                    <RepeatedLeadBadge size="sm" />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  <h1 className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                    {lead.name}
                  </h1>
                  <LeadStatusBadge status={status} reason={lead.statusReason} lead={lead} pulse={status === 'new'} size="sm" listMode={false} />
                </div>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  <span className="font-semibold text-violet-600">{formatLeadId(lead._id || lead.leadId)}</span>
                  {' · '}Lead 360 · {lead.destination || '—'}
                </p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {lead.phone ? (
                    <a
                      href={`tel:${lead.phone}`}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200/80 bg-white/80 px-2 text-[11px] font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700"
                    >
                      <Phone className="h-3 w-3 text-violet-500" />
                      {lead.phone}
                    </a>
                  ) : null}
                  {lead.email ? (
                    <a
                      href={`mailto:${lead.email}`}
                      className="inline-flex h-7 max-w-[180px] items-center gap-1 rounded-lg border border-slate-200/80 bg-white/80 px-2 text-[11px] font-semibold text-slate-700 hover:border-violet-300 hover:text-violet-700"
                    >
                      <Mail className="h-3 w-3 shrink-0 text-violet-500" />
                      <span className="truncate">{lead.email}</span>
                    </a>
                  ) : null}
                  <span className="inline-flex h-7 max-w-[200px] items-center gap-1 rounded-lg border border-slate-200/80 bg-white/80 px-2 text-[11px] font-semibold text-slate-700">
                    <MapPin className="h-3 w-3 shrink-0 text-violet-500" />
                    <span className="truncate">{location}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Score + temp strip */}
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/60 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/50 lg:min-w-[200px]">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: `conic-gradient(#10b981 ${scorePct * 3.6}deg, #e2e8f0 0deg)` }}
              >
                <div className="flex h-8 w-8 flex-col items-center justify-center rounded-full bg-white text-[10px] font-bold text-emerald-600">
                  {scores.overall}
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Lead Score</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{scores.overall}/100</p>
                <p className={cn(
                  'mt-0.5 inline-flex max-w-[140px] items-center gap-0.5 truncate text-[10px] font-bold',
                  isConverted
                    ? 'text-emerald-600'
                    : isHot
                      ? 'text-orange-600'
                      : isWorking
                        ? 'text-orange-600'
                        : listDisplay.bucket === 'warm'
                          ? 'text-amber-600'
                          : listDisplay.bucket === 'cold'
                            ? 'text-slate-600'
                            : 'text-sky-600'
                )}
                title={tempCapitalized}
                >
                  <Flame className="h-3 w-3 shrink-0" /> {tempCapitalized}
                </p>
              </div>
            </div>
          </div>

          {/* Meta pills */}
          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <MetaPill label="Source" value={formatSource(lead)} />
            <MetaPill
              label="Created"
              value={
                lead.createdAt
                  ? new Date(lead.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'
              }
            />
            <MetaPill label="Last Activity" value={formatRelativeActivity(lead)} />
            <MetaPill label="Assigned To">
              <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                {lead.assignedTo?.name ? (
                  <>
                    <Avatar name={lead.assignedTo.name} size="sm" className="!h-5 !w-5 ring-1 ring-violet-200" />
                    <span className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                      {lead.assignedTo.name}
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] text-slate-400">Unassigned</span>
                )}
              </div>
            </MetaPill>
          </div>

          {/* Travel chips */}
          <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
            <TravelChip icon={CalendarDays} label="Travel Date" value={formatTravelRange(lead)} tone="violet" />
            <TravelChip icon={Users} label="Travelers" value={formatTravelers(lead)} tone="sky" />
            <TravelChip icon={Sparkles} label="Meal Plan" value={(lead?.mealPlan || lead?.mealPreference || 'map').toString().toUpperCase()} tone="rose" />
          </div>

          {showPayment ? (
            <div className="mt-3 rounded-xl border border-emerald-100/80 bg-white/60 p-2.5 dark:border-emerald-900 dark:bg-slate-900/40">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">Payment &amp; Advance</p>
                  <p className="text-[10px] text-slate-500">{voucherLabel}</p>
                </div>
                <Button
                  type="button"
                  variant="emerald"
                  onClick={openVoucher}
                  disabled={voucherLoading}
                  className="h-8 rounded-lg px-3 text-xs font-bold shadow-sm"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {voucherLoading ? 'Loading…' : 'View Voucher'}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <PaymentMetric icon={Wallet} label="Package" value={summary.totalAmount} tone="violet" />
                <PaymentMetric icon={ArrowDownCircle} label="Advance" value={summary.advanceReceived} tone="emerald" />
                <PaymentMetric icon={CreditCard} label="Balance" value={summary.balanceDue} tone="amber" />
              </div>
            </div>
          ) : null}

          <div className="mt-2.5 flex justify-end">
            <button
              type="button"
              onClick={() => document.getElementById('lead-customer-panel')?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-500"
            >
              View full details
              <ChevronRight className="h-3.5 w-3.5" />
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
