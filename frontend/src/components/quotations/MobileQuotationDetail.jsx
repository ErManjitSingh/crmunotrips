import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BedDouble,
  Briefcase,
  Building2,
  Calendar,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  StickyNote,
  User,
  Users,
} from 'lucide-react';
import { beginLeadCall } from '../../lib/callSession';
import { openWhatsApp } from '../../lib/whatsappContact';
import { toast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';
import { formatINR } from './quotationUtils';

const STATUS_PILL = {
  draft: { label: 'Draft', className: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  pending_approval: { label: 'Pending Approval', className: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  sent: { label: 'Sent', className: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  viewed: { label: 'Viewed', className: 'bg-sky-100 text-sky-700', dot: 'bg-sky-500' },
  rejected: { label: 'Rejected', className: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
  negotiation: { label: 'Negotiation', className: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
};

const AVATAR_TONES = [
  'bg-rose-500',
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-orange-500',
];

function avatarTone(name = '') {
  return AVATAR_TONES[(name.charCodeAt(0) || 0) % AVATAR_TONES.length];
}

function initials(name = '') {
  return String(name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';
}

function formatTravelDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatCreatedOn(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatSource(lead = {}) {
  if (lead.sourceLabel) return lead.sourceLabel;
  const map = {
    dpw: 'DPW',
    dpw_wa: 'DPW WA',
    dpw_call: 'DPW CALL',
    dpw2: 'DPW2',
    dpw2_wa: 'DPW2 WA',
    dpw2_call: 'DPW2 CALL',
    call_lead: 'Call Lead',
    website: 'DPW',
    google_ads: 'DPW',
    facebook_ads: 'DPW2',
    facebook: 'DPW2',
    whatsapp: 'DPW WA',
    referral: 'Referral',
    phone: 'Call Lead',
    organic: 'Organic',
    'walk-in': 'Call Lead',
  };
  const key = String(lead.source || '').toLowerCase();
  return map[key] || (key ? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 border-b border-slate-100 pb-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 break-words text-[14px] font-semibold text-slate-900">{value || '—'}</p>
      </div>
    </div>
  );
}

function SectionCard({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{title}</h2>
        <ChevronRight className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-90')} />
      </button>
      {open ? <div className="px-4 pb-3">{children}</div> : null}
    </section>
  );
}

export default function MobileQuotationDetail({
  quote,
  open,
  onClose,
  onEdit,
  editHref,
  onFollowUp,
  onAddNote,
  onDownloadPdf,
  actions,
  headerExtra = null,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const summary = useMemo(() => {
    if (!quote) return null;
    return quote.packageSummary || {
      packageName: quote.package?.name || quote.packageSnapshot?.name || 'Custom package',
      destination: quote.lead?.destination || quote.packageSnapshot?.destination || '',
      hotelsCount: (quote.selectedHotels || []).length,
      hotelNames: (quote.selectedHotels || []).slice(0, 4).map((h) => h.name || h.snapshot?.name).filter(Boolean),
      cabsCount: (quote.selectedCabs || []).length,
      activitiesCount: (quote.selectedActivities || []).length,
      customizations: quote.customizations || '',
      duration: quote.packageSnapshot?.duration || quote.packageSnapshot?.days,
      durationLabel: quote.packageSnapshot?.durationLabel,
      nights: quote.packageSnapshot?.nights,
    };
  }, [quote]);

  if (!open || !quote || typeof document === 'undefined') return null;

  const lead = quote.lead || {};
  const customer = lead.name || 'Customer';
  const destination = lead.destination || summary?.destination || '—';
  const status = STATUS_PILL[quote.status] || STATUS_PILL.draft;
  const creatorName = quote.createdByExecutive?.name || quote.createdBy?.name || '—';
  const assignedName = lead.assignedTo?.name || quote.createdByExecutive?.name || '—';
  const packageName = summary?.packageName || 'Custom package';

  const nights = summary?.nights ?? (summary?.duration ? Math.max(0, Number(summary.duration) - 1) : null);
  const days = summary?.duration ?? (nights != null ? nights + 1 : null);
  const durationText = summary?.durationLabel
    || (days != null ? `${days}D / ${nights ?? Math.max(0, days - 1)}N` : '—');

  const adults = lead.adults ?? lead.travelers ?? 1;
  const children = lead.children ?? 0;
  const travelersText = [
    adults ? `${adults} Adult${adults === 1 ? '' : 's'}` : null,
    children ? `${children} Child${children === 1 ? '' : 'ren'}` : null,
  ].filter(Boolean).join(', ') || '—';

  const hotelType =
    lead.hotelCategory ||
    lead.hotelType ||
    quote.packageSnapshot?.hotelCategory ||
    summary?.hotelNames?.[0] ||
    (summary?.hotelsCount ? 'Package hotels' : '—');

  const goingTo = summary?.destination || destination;

  const handleCall = () => {
    if (!lead.phone) {
      toast.error('Phone number missing');
      return;
    }
    beginLeadCall({ leadId: lead._id, leadName: customer, phone: lead.phone });
  };

  const handleWhatsApp = () => {
    if (!lead.phone) {
      toast.error('Phone number missing');
      return;
    }
    const ok = openWhatsApp(lead.phone, `Hi ${customer}, regarding your quotation ${quote.quoteNumber || ''}`);
    if (!ok) toast.error('Could not open WhatsApp');
  };

  const handleFollowUp = () => {
    if (onFollowUp) onFollowUp(quote);
    else toast.info('Open Follow-ups from the bottom menu to schedule');
  };

  const handleAddNote = () => {
    if (onAddNote) onAddNote(quote);
    else toast.info('Open the lead profile to add a note');
  };

  return createPortal(
    <div className="fixed inset-0 z-[210] flex flex-col bg-[#f4f5fa]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-violet-100/80 via-indigo-50/40 to-transparent" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 20% 30%, rgba(139,92,246,0.18), transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(99,102,241,0.15), transparent 45%)',
        }}
      />

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quotes
        </button>
        <div className="flex items-center gap-2">
          {editHref ? (
            <Link
              to={editHref}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-sm font-semibold text-white shadow-sm"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          ) : onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(quote)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-600 px-3 text-sm font-semibold text-white shadow-sm"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          ) : null}
          <div className="relative">
            <button
              type="button"
              aria-label="More"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 z-20 mt-1.5 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                {onDownloadPdf ? (
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-violet-50"
                    onClick={() => {
                      setMenuOpen(false);
                      onDownloadPdf();
                    }}
                  >
                    View PDF
                  </button>
                ) : null}
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-violet-50"
                  onClick={() => {
                    setMenuOpen(false);
                    onClose?.();
                  }}
                >
                  Close
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-28">
        <div className="mb-4 pt-1">
          <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700">
            {quote.quoteNumber || 'QT'}
          </span>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[26px] font-bold leading-tight tracking-tight text-slate-900">
                {customer}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-violet-600">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{destination}</span>
              </p>
            </div>
            <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold', status.className)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
              {status.label}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {headerExtra}
          <SectionCard title="Customer Details">
            <div className="mb-1 flex items-center gap-3 rounded-xl bg-slate-50/80 px-2.5 py-2.5">
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white', avatarTone(customer))}>
                {initials(customer)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-slate-900">{customer}</p>
                <p className="text-[11px] text-slate-500">Lead Name</p>
              </div>
            </div>
            <DetailRow icon={Phone} label="Mobile" value={lead.phone} />
            <DetailRow icon={Mail} label="Email" value={lead.email} />
            <DetailRow icon={Building2} label="Source" value={formatSource(lead)} />
            <DetailRow icon={Calendar} label="Travel Date" value={formatTravelDate(lead.travelDate)} />
          </SectionCard>

          <SectionCard title="More Details & Travel Info">
            <DetailRow icon={User} label="Assigned To" value={assignedName} />
            <DetailRow icon={Users} label="Sales Executive" value={creatorName} />
            <DetailRow icon={MapPin} label="Destination" value={destination} />
            <DetailRow icon={BedDouble} label="Hotel Type" value={hotelType} />
            <DetailRow icon={CalendarClock} label="Created On" value={formatCreatedOn(quote.createdAt)} />
          </SectionCard>

          <SectionCard title="Package & Short Summary">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Briefcase className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-slate-900">{packageName}</p>
                <div className="mt-2 space-y-1.5 text-[12px] text-slate-600">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    Going to: <span className="font-semibold text-slate-800">{goingTo}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    For: <span className="font-semibold text-slate-800">{durationText}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-800">{travelersText}</span>
                  </p>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Cab: {summary?.cabsCount ?? 0} · Adventure: {summary?.activitiesCount ?? 0}
                  {(quote.pricing?.total || quote.costing2?.grandTotal || quote.costing1?.grandTotal) ? (
                    <span className="mt-1 block text-sm font-black normal-case tracking-normal text-violet-700 metric-tabular">
                      {formatINR(quote.pricing?.total || quote.costing2?.grandTotal || quote.costing1?.grandTotal)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </SectionCard>

          {actions ? (
            <div className="flex flex-wrap gap-2 pt-1">{actions}</div>
          ) : null}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/95 px-3 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={handleCall}
            className="flex flex-col items-center gap-1 rounded-2xl border border-violet-100 bg-violet-50/80 py-2.5 text-violet-700"
          >
            <Phone className="h-5 w-5" />
            <span className="text-[10px] font-bold">Call</span>
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            className="flex flex-col items-center gap-1 rounded-2xl border border-emerald-100 bg-emerald-50/80 py-2.5 text-emerald-700"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="text-[10px] font-bold">WhatsApp</span>
          </button>
          <button
            type="button"
            onClick={handleFollowUp}
            className="flex flex-col items-center gap-1 rounded-2xl border border-sky-100 bg-sky-50/80 py-2.5 text-sky-700"
          >
            <CalendarPlus className="h-5 w-5" />
            <span className="text-[10px] font-bold">Follow Up</span>
          </button>
          <button
            type="button"
            onClick={handleAddNote}
            className="flex flex-col items-center gap-1 rounded-2xl border border-orange-100 bg-orange-50/80 py-2.5 text-orange-700"
          >
            <StickyNote className="h-5 w-5" />
            <span className="text-[10px] font-bold">Add Note</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
