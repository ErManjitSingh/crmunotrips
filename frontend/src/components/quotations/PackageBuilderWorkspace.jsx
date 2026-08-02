import { useMemo, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Car,
  Hotel,
  Moon,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  FileText,
  Users,
  CalendarDays,
  MapPin,
  Leaf,
  Route,
  ListChecks,
  X,
} from 'lucide-react';
import { getPackageTypeConfig, formatINR } from './quotationUtils';
import PackageDestinationFlow from './PackageDestinationFlow';
import PackageBuilderDayTimeline from './PackageBuilderDayTimeline';
import PackageBuilderPriceSidebar from './PackageBuilderPriceSidebar';
import MobileQuotationActionBar from './MobileQuotationActionBar';
import InclusionExclusionEditor from './InclusionExclusionEditor';
import QuotationPdfOverlay from './QuotationPdfOverlay';
import PackageResourcePickerDrawer from './PackageResourcePickerDrawer';
import EmailComposerModal from '../email/EmailComposerModal';
import { openWhatsApp } from '../../lib/whatsappContact';
import { toast } from '../../context/ToastContext';
import { cn } from '../../lib/utils';

function buildQuotationShareText({ lead, pkg, pricing, nights, daysCount, quoteNumber }) {
  const total = formatINR(pricing?.total || 0);
  const guest = lead?.name || 'Guest';
  const destination = pkg?.routing || pkg?.destination || lead?.destination || '';
  const duration =
    nights != null || daysCount
      ? `${nights ?? Math.max(0, (daysCount || 1) - 1)}N / ${daysCount || (nights || 0) + 1}D`
      : '';

  return [
    `Hello ${guest},`,
    '',
    'Your customised travel quotation from UNO Trips is ready:',
    '',
    pkg?.name ? `📦 Package: ${pkg.name}` : null,
    destination ? `📍 Destination: ${destination}` : null,
    duration ? `🗓️ Duration: ${duration}` : null,
    `💰 Total: ${total}`,
    quoteNumber ? `🔖 Ref: ${quoteNumber}` : null,
    '',
    'Please reply to confirm or request any changes.',
    'Thank you — UNO Trips',
  ]
    .filter(Boolean)
    .join('\n');
}

function parseDestinationStops(pkg, lead) {
  const raw =
    pkg?.route ||
    pkg?.destinations ||
    pkg?.cities ||
    (pkg?.destination ? String(pkg.destination).split(/→|->|,|\|/).map((s) => s.trim()).filter(Boolean) : null) ||
    (lead?.destination ? String(lead.destination).split(/→|->|,|\|/).map((s) => s.trim()).filter(Boolean) : []);

  const list = Array.isArray(raw) ? raw : [];
  return list.map((item, i) => ({
    id: `dest-${i}-${typeof item === 'string' ? item : item.name || item}`,
    name: typeof item === 'string' ? item : item.name || String(item),
  }));
}

export function stripHtml(input = '') {
  return String(input || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<\/\s*div\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const SECTION_TONES = {
  package: {
    wrap: 'border-indigo-200/90 bg-gradient-to-br from-indigo-50 via-white to-sky-50 shadow-indigo-100/60',
    bar: 'from-indigo-500 to-sky-500',
    badge: 'bg-indigo-600 text-white',
    iconWrap: 'bg-indigo-100 text-indigo-600',
  },
  route: {
    wrap: 'border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-amber-100/60',
    bar: 'from-amber-500 to-orange-500',
    badge: 'bg-amber-500 text-white',
    iconWrap: 'bg-amber-100 text-amber-700',
  },
  travel: {
    wrap: 'border-sky-200/90 bg-gradient-to-br from-sky-50 via-white to-cyan-50 shadow-sky-100/60',
    bar: 'from-sky-500 to-cyan-500',
    badge: 'bg-sky-600 text-white',
    iconWrap: 'bg-sky-100 text-sky-700',
  },
  stay: {
    wrap: 'border-violet-200/90 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 shadow-violet-100/60',
    bar: 'from-violet-500 to-fuchsia-500',
    badge: 'bg-violet-600 text-white',
    iconWrap: 'bg-violet-100 text-violet-700',
  },
  itinerary: {
    wrap: 'border-teal-200/90 bg-gradient-to-br from-teal-50 via-cyan-50/40 to-white shadow-teal-100/60',
    bar: 'from-teal-500 to-emerald-500',
    badge: 'bg-teal-600 text-white',
    iconWrap: 'bg-teal-100 text-teal-700',
  },
  policy: {
    wrap: 'border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-rose-50 shadow-emerald-100/50',
    bar: 'from-emerald-500 to-rose-400',
    badge: 'bg-emerald-600 text-white',
    iconWrap: 'bg-emerald-100 text-emerald-700',
  },
  preview: {
    wrap: 'border-slate-300 bg-gradient-to-br from-slate-100 via-white to-violet-50 shadow-slate-200/50',
    bar: 'from-slate-600 to-violet-500',
    badge: 'bg-slate-800 text-white',
    iconWrap: 'bg-slate-200 text-slate-700',
  },
};

function SectionShell({
  tone = 'package',
  step,
  title,
  subtitle,
  icon: Icon,
  children,
  className,
  action,
}) {
  const t = SECTION_TONES[tone] || SECTION_TONES.package;
  return (
    <section
      className={cn(
        'rounded-2xl border overflow-hidden shadow-md relative',
        t.wrap,
        className
      )}
    >
      <div className={cn('h-1.5 w-full bg-gradient-to-r', t.bar)} />
      {(title || step) && (
        <div className="px-4 sm:px-5 pt-3.5 pb-3 sm:pt-4 flex flex-wrap items-start justify-between gap-2.5 sm:gap-3 border-b border-black/5">
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
            {Icon && (
              <span className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0', t.iconWrap)}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {step != null && (
                  <span className={cn('text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md', t.badge)}>
                    Step {step}
                  </span>
                )}
                {title && <h3 className="text-sm sm:text-base font-bold text-slate-900">{title}</h3>}
              </div>
              {subtitle && <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 line-clamp-2">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function PackageDescription({ text, fallback }) {
  const [expanded, setExpanded] = useState(false);
  const plain = stripHtml(text) || fallback || '';
  if (!plain) return null;
  const needsMore = plain.length > 160 || plain.split(/\n/).length > 2;

  return (
    <div className="space-y-1 rounded-xl bg-white/70 border border-indigo-100/80 px-3.5 py-3">
      <p className={cn('text-sm text-slate-700 leading-relaxed whitespace-pre-line', !expanded && 'line-clamp-2')}>
        {plain}
      </p>
      {needsMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          {expanded ? 'Show less' : 'Read more >'}
        </button>
      )}
    </div>
  );
}

function ChangeBtn({ onClick, label = 'Change' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-400/70 bg-emerald-50 text-xs font-bold text-emerald-700 hover:bg-emerald-100 shrink-0 shadow-sm shadow-emerald-200/50"
    >
      <RefreshCw className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export default function PackageBuilderWorkspace({
  lead,
  pkg,
  itinerary,
  onItineraryChange,
  inclusions,
  exclusions,
  onInclusionsChange,
  onExclusionsChange,
  dayWiseHotels,
  onDayWiseHotelsChange,
  selectedUnoCab,
  onCabChange,
  packageCabs = [],
  pricing,
  onPricingChange,
  nights,
  hotelDestination,
  draftQuote,
  onBack,
  onSaveDraft,
  onSubmit,
  saving,
  draftLabel,
  submitLabel,
  emailEndpoint = '/leads',
  needsResubmissionReason = false,
  resubmissionReason = '',
  onResubmissionReasonChange,
  disableSubmit = false,
}) {
  const [destinations, setDestinations] = useState(() => parseDestinationStops(pkg, lead));
  const [showPreview, setShowPreview] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [picker, setPicker] = useState(null);
  const [mobilePricingOpen, setMobilePricingOpen] = useState(false);
  const typeCfg = getPackageTypeConfig(pkg?.type || pkg?.category || 'family');
  const mobileTotal = Number(pricing?.total || 0);

  const emailQuotation = useMemo(() => {
    if (!draftQuote) return null;
    return {
      ...draftQuote,
      quoteNumber: draftQuote.quoteNumber,
      totalAmount: draftQuote.pricing?.total,
      grandTotal: draftQuote.pricing?.total,
      destination: draftQuote.package?.destination || pkg?.destination || lead?.destination,
      travelDate: lead?.travelDate,
    };
  }, [draftQuote, pkg?.destination, lead?.destination, lead?.travelDate]);

  const shareText = useMemo(
    () =>
      buildQuotationShareText({
        lead,
        pkg,
        pricing,
        nights,
        daysCount: itinerary?.length,
        quoteNumber: draftQuote?.quoteNumber,
      }),
    [lead, pkg, pricing, nights, itinerary?.length, draftQuote?.quoteNumber]
  );

  const handleShare = useCallback(async () => {
    if (!draftQuote) {
      toast.error('Build the package first, then share.');
      return;
    }
    const payload = {
      title: `UNO Trips quotation — ${pkg?.name || 'Package'}`,
      text: shareText,
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(payload);
        toast.success('Quotation shared');
        return;
      }
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success('Quotation copied — paste anywhere to share');
    } catch {
      toast.error('Unable to share. Please copy manually from Print preview.');
    }
  }, [draftQuote, pkg?.name, shareText]);

  const handleMail = useCallback(() => {
    if (!lead?._id) {
      toast.error('Select a lead first');
      return;
    }
    if (!draftQuote) {
      toast.error('Build the package first, then email.');
      return;
    }
    if (!lead.email) {
      toast.info('Lead has no email — you can type one in the composer');
    }
    setShowEmailComposer(true);
  }, [lead, draftQuote]);

  const handleWhatsApp = useCallback(() => {
    if (!lead?.phone) {
      toast.error('Lead phone number is missing');
      return;
    }
    if (!draftQuote) {
      toast.error('Build the package first, then send on WhatsApp.');
      return;
    }
    const opened = openWhatsApp(lead.phone, shareText);
    if (opened) {
      toast.success('Opening WhatsApp for the customer');
    } else {
      toast.error('Could not open WhatsApp');
    }
  }, [lead, draftQuote, shareText]);

  const handlePrint = useCallback(() => {
    if (!draftQuote) {
      toast.error('Build the package first, then print.');
      return;
    }
    setAutoPrint(true);
    setShowPreview(true);
  }, [draftQuote]);

  const durationLabel = useMemo(() => {
    if (pkg?.durationLabel) return pkg.durationLabel;
    const d = itinerary?.length || pkg?.duration || 0;
    const n = nights != null ? nights : Math.max(0, d - 1);
    return `${n}N / ${d}D`;
  }, [pkg, itinerary, nights]);

  const heroTags = useMemo(
    () => [
      { icon: Moon, label: durationLabel.includes('Night') ? durationLabel : `${nights ?? '—'} Nights / ${itinerary?.length || '—'} Days` },
      { icon: Sparkles, label: pkg?.isCustomizable !== false ? 'Customizable' : typeCfg.label },
      { icon: Car, label: selectedUnoCab?.name ? 'Private Transfer' : 'Transfer' },
      { icon: ShieldCheck, label: 'Best Price Guarantee' },
    ],
    [durationLabel, nights, itinerary, pkg, typeCfg, selectedUnoCab]
  );

  const staySummary = useMemo(() => {
    const hotels = (dayWiseHotels || [])
      .map((h) => h.hotel)
      .filter(Boolean)
      .concat((itinerary || []).map((d) => d.hotelMeta).filter(Boolean));
    const first = hotels[0];
    const stars = hotels
      .map((h) => Number(h.starRating || h.starCategory || 0))
      .filter((n) => n > 0);
    const avg = stars.length ? Math.round(stars.reduce((a, b) => a + b, 0) / stars.length) : 0;
    const name = first?.name || itinerary?.find((d) => d.hotel)?.hotel || 'Package Hotels';
    return {
      name: hotels.length > 1 ? 'Standard Hotels' : name,
      detail: avg ? `${avg}★ Category` : 'As per package',
      image: first?.image || first?.images?.[0] || '',
      count: hotels.length,
    };
  }, [dayWiseHotels, itinerary]);

  const stayOptions = useMemo(() => {
    const byId = new Map();
    for (const day of itinerary || []) {
      for (const opt of day.hotelOptions || []) {
        const key = opt.id || opt.hotelId || opt.name;
        if (key && !byId.has(key)) byId.set(key, { ...opt, _day: day });
      }
    }
    return [...byId.values()];
  }, [itinerary]);

  const metaRow = [
    { icon: Leaf, label: 'Trip Type', value: typeCfg.label || pkg?.packageType || 'Leisure', tone: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    {
      icon: Users,
      label: 'Suitable For',
      value: lead ? `${lead.adults || 0}A / ${lead.children || 0}C` : 'Family, Couple',
      tone: 'bg-sky-50 border-sky-200 text-sky-700',
    },
    {
      icon: CalendarDays,
      label: 'Best Season',
      value: pkg?.bestSeason || 'Mar–Jun, Sep–Feb',
      tone: 'bg-amber-50 border-amber-200 text-amber-700',
    },
    {
      icon: MapPin,
      label: 'Pickup / Drop',
      value: destinations[0]?.name && destinations[destinations.length - 1]?.name
        ? `${destinations[0].name} → ${destinations[destinations.length - 1].name}`
        : pkg?.destination || 'Delhi',
      tone: 'bg-violet-50 border-violet-200 text-violet-700',
    },
  ];

  const handleReplaceHotel = (day, option) => {
    if (!day || !option) return;
    const roomName = option.room?.name || option.tierName || 'Standard Room';
    const mealLabel = option.mealPlan?.label || option.meals || day.meals || 'As per package';
    // Cost contribution is upgrade delta only (package baseCost already includes default stay).
    const perNight = Number(option.perNight ?? option.priceDelta ?? 0);
    const absolutePerNight = Number(
      option.absolutePerNight ?? option.startingPrice ?? 0
    );
    const stayNights = 1;
    const totalCost = Number(option.totalCost ?? perNight);
    const existing = (dayWiseHotels || []).find((h) => h.day === day.day);
    // Keep original package-included rate stable across upgrades (for total itemization).
    const includedRate = Number(
      existing?.includedRate ??
        existing?.hotel?.startingPrice ??
        option.includedRate ??
        day?.hotelMeta?.startingPrice ??
        day?.hotelMeta?.includedRate ??
        0
    );
    const hotelMeta = {
      ...option,
      tierName: roomName,
      meals: mealLabel,
      priceDelta: perNight,
      absolutePerNight,
      includedRate,
      startingPrice: absolutePerNight || option.startingPrice || 0,
      room: option.room || { name: roomName },
      mealPlan: option.mealPlan || { label: mealLabel },
    };

    const nextItinerary = itinerary.map((d) => {
      if (d.id !== day.id && d.day !== day.day) return d;
      return {
        ...d,
        hotel: option.name,
        accommodation: option.name,
        meals: mealLabel,
        hotelMeta,
        hotelOptions: d.hotelOptions || [],
      };
    });
    onItineraryChange?.(nextItinerary);

    const nextHotels = (dayWiseHotels || []).filter((h) => h.day !== day.day);
    nextHotels.push({
      day: day.day,
      hotel: {
        id: option.id || option.hotelId,
        name: option.name,
        image: option.image || '',
        images: option.images || [],
        starCategory: option.starRating || 0,
        starRating: option.starRating || 0,
        location: option.location || '',
        city: option.city || '',
        slug: option.slug || '',
        startingPrice: option.startingPrice || absolutePerNight || 0,
      },
      room: option.room || { name: roomName },
      mealPlan: option.mealPlan || { label: mealLabel },
      perNight,
      absolutePerNight,
      includedRate,
      totalCost,
      nights: stayNights,
      fromPackage: true,
      hotelOptions: day.hotelOptions || [],
    });
    onDayWiseHotelsChange?.(nextHotels.sort((a, b) => a.day - b.day));
    setPicker(null);
  };

  const openCabPicker = () => setPicker({ type: 'cab' });
  const openStayPicker = () => setPicker({ type: 'hotel' });
  const openDayHotelPicker = (day) => setPicker({ type: 'hotel', day });

  const selectCab = (cab) => {
    onCabChange?.(cab);
    setPicker(null);
  };

  const applyStayOption = (opt) => {
    if (picker?.type === 'hotel' && picker.day) {
      handleReplaceHotel(picker.day, opt);
      return;
    }
    if (!opt?._day) return;
    handleReplaceHotel(opt._day, opt);
  };

  const hotelDrawerOptions = useMemo(() => {
    if (picker?.type !== 'hotel') return [];
    if (picker.day) return picker.day.hotelOptions || [];
    return stayOptions;
  }, [picker, stayOptions]);

  const hotelSelectedId = useMemo(() => {
    if (picker?.type !== 'hotel') return null;
    if (picker.day) {
      const meta = picker.day.hotelMeta;
      return meta?.id || meta?.hotelId || meta?.name || picker.day.hotel || null;
    }
    const firstMeta = itinerary?.find((d) => d.hotelMeta)?.hotelMeta;
    return firstMeta?.id || firstMeta?.hotelId || firstMeta?.name || null;
  }, [picker, itinerary]);

  const hotelBasePrice = useMemo(() => {
    // Absolute nightly rate of the current selection (for "vs current" UI), not the cost delta.
    const pickAbsolute = (meta, dayHotel) => {
      const absolute =
        Number(dayHotel?.absolutePerNight ?? meta?.absolutePerNight ?? 0) || 0;
      const included =
        Number(
          dayHotel?.includedRate ??
            dayHotel?.hotel?.startingPrice ??
            meta?.startingPrice ??
            meta?.includedRate ??
            0
        ) || 0;
      if (absolute > 0) return absolute;
      if (included > 0) return included;
      return 0;
    };
    if (picker?.type === 'hotel' && picker.day) {
      const meta = picker.day.hotelMeta;
      const dayHotel = (dayWiseHotels || []).find((h) => h.day === picker.day.day);
      return pickAbsolute(meta, dayHotel);
    }
    const firstMeta = itinerary?.find((d) => d.hotelMeta)?.hotelMeta;
    const firstDayHotel = (dayWiseHotels || [])[0];
    return pickAbsolute(firstMeta, firstDayHotel);
  }, [picker, itinerary, dayWiseHotels]);

  const cabBasePrice = Number(
    selectedUnoCab?.absoluteFare ??
      selectedUnoCab?.totalAmount ??
      selectedUnoCab?.cost ??
      selectedUnoCab?.priceDelta ??
      0
  ) || 0;

  const cabSelectedId =
    selectedUnoCab?.id || selectedUnoCab?.packageCabId || selectedUnoCab?.name || null;

  return (
    <div className="relative space-y-4 rounded-none bg-[#f4f5f9] p-0 pb-36 sm:space-y-5 sm:rounded-3xl sm:bg-gradient-to-b sm:from-slate-100 sm:via-indigo-50/40 sm:to-amber-50/30 sm:p-3 sm:pb-4 xl:pb-4 -mx-0 sm:-mx-1">
      {/* Mobile sticky top bar */}
      <div className="sticky top-0 z-30 -mx-0 border-b border-slate-200/80 bg-white/95 px-3 py-2.5 backdrop-blur-md xl:hidden">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to packages"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-violet-600">Create Quotation</p>
            <p className="truncate text-sm font-bold text-slate-900">{lead?.name || 'Customer'}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white shadow-sm"
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </button>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden flex-wrap items-start justify-between gap-3 rounded-2xl border border-indigo-200/70 bg-white/90 px-4 py-4 shadow-sm shadow-indigo-100/50 xl:flex">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Packages
          </button>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-900">Create Quotation</h1>
          <p className="mt-1 text-sm text-slate-600">
            Build and customize the perfect package for{' '}
            <span className="font-semibold text-indigo-700">{lead?.name || 'your customer'}</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onSaveDraft}
            className="h-10 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
          >
            {draftLabel || 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white shadow-md shadow-violet-600/25 hover:bg-violet-500"
          >
            <FileText className="w-4 h-4" />
            Generate PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 px-3 sm:gap-5 sm:px-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4 sm:space-y-5">
          <SectionShell
            tone="package"
            step={1}
            title="Package Overview"
            subtitle="Cover, highlights and trip meta"
            icon={Sparkles}
          >
            <div className="overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm">
              <div className="relative h-40 overflow-hidden bg-slate-200 sm:h-56">
                {pkg?.coverImage ? (
                  <img src={pkg.coverImage} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-500" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 space-y-2 p-3.5 sm:space-y-2.5 sm:p-5">
                  <span className="inline-flex rounded-md bg-indigo-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                    Package Preview
                  </span>
                  <h2 className="text-lg font-bold leading-snug text-white drop-shadow-sm sm:text-2xl">
                    {pkg?.name}
                    {durationLabel ? ` — ${durationLabel}` : ''}
                  </h2>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {heroTags.map(({ icon: Icon, label }) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/25 bg-white/20 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur sm:gap-1.5 sm:px-2.5 sm:text-[11px]"
                      >
                        <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-gradient-to-b from-indigo-50/50 to-white px-3.5 py-3.5 sm:space-y-4 sm:px-5 sm:py-4">
                <PackageDescription
                  text={pkg?.description || pkg?.shortDescription}
                  fallback={`Experience ${pkg?.destination || 'the hills'} with curated stays, private transfers and handpicked sightseeing — fully customisable for your guest.`}
                />

                <div className="grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4">
                  {metaRow.map(({ icon: Icon, label, value, tone }) => (
                    <div key={label} className={cn('rounded-xl border px-2.5 py-2 sm:px-3 sm:py-2.5', tone)}>
                      <p className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide opacity-80 sm:text-[10px]">
                        <Icon className="h-3 w-3" />
                        {label}
                      </p>
                      <p className="mt-1 truncate text-xs font-bold text-slate-900 sm:text-sm">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionShell>

          <SectionShell
            tone="route"
            step={2}
            title="Destination Flow"
            subtitle="Pickup → stops → drop — drag to reorder"
            icon={Route}
          >
            <PackageDestinationFlow destinations={destinations} onChange={setDestinations} embedded />
          </SectionShell>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SectionShell
              tone="travel"
              step={3}
              title="Transport"
              subtitle="Private vehicle for the trip"
              icon={Car}
              action={packageCabs.length > 0 ? <ChangeBtn onClick={openCabPicker} /> : null}
              className="h-full"
            >
              <div className="rounded-xl border border-sky-200 bg-white/80 px-3.5 py-3">
                <p className="text-sm font-bold text-slate-900">
                  {selectedUnoCab?.name || 'Sedan (Dzire / Etios)'}
                </p>
                <p className="mt-1 text-xs font-medium text-sky-700/80">
                  {[
                    'AC Vehicle',
                    selectedUnoCab?.seatingCapacity ? `${selectedUnoCab.seatingCapacity} Seats` : '4 Seats',
                  ].join(' · ')}
                </p>
              </div>
            </SectionShell>

            <SectionShell
              tone="stay"
              step={3}
              title="Stay"
              subtitle="Hotels linked to this package"
              icon={Hotel}
              action={stayOptions.length > 0 ? <ChangeBtn onClick={openStayPicker} /> : null}
              className="h-full"
            >
              <div className="rounded-xl border border-violet-200 bg-white/80 px-3.5 py-3">
                <p className="text-sm font-bold text-slate-900">{staySummary.name}</p>
                <p className="mt-1 text-xs font-medium text-violet-700/80">{staySummary.detail}</p>
              </div>
            </SectionShell>
          </div>

          <SectionShell
            tone="itinerary"
            step={4}
            title="Day-wise Itinerary"
            subtitle="Each day has its own color strip — hotels, cab & activities"
            icon={CalendarDays}
          >
            <PackageBuilderDayTimeline
              itinerary={itinerary}
              dayWiseHotels={dayWiseHotels}
              packageCab={selectedUnoCab}
              onChange={onItineraryChange}
              onOpenHotelPicker={openDayHotelPicker}
              onChangeCab={openCabPicker}
              destination={hotelDestination || pkg?.destination || 'Destination'}
              embedded
            />
          </SectionShell>

          <SectionShell
            tone="policy"
            step={5}
            title="Inclusions & Exclusions"
            subtitle="Green = included · Rose = not included"
            icon={ListChecks}
          >
            <InclusionExclusionEditor
              inclusions={inclusions}
              exclusions={exclusions}
              onChangeInclusions={onInclusionsChange}
              onChangeExclusions={onExclusionsChange}
            />
          </SectionShell>
        </div>

        <div className="hidden xl:block">
          <PackageBuilderPriceSidebar
            lead={lead}
            pkg={pkg}
            pricing={pricing}
            onPricingChange={onPricingChange}
            nights={nights}
            daysCount={itinerary?.length}
            onSaveDraft={onSaveDraft}
            onSubmit={onSubmit}
            onShare={handleShare}
            onMail={handleMail}
            onWhatsApp={handleWhatsApp}
            onPrint={handlePrint}
            saving={saving}
            draftLabel={draftLabel}
            submitLabel={submitLabel}
            needsResubmissionReason={needsResubmissionReason}
            resubmissionReason={resubmissionReason}
            onResubmissionReasonChange={onResubmissionReasonChange}
            disableSubmit={disableSubmit}
          />
        </div>
      </div>

      <MobileQuotationActionBar
        total={mobileTotal}
        saving={saving}
        draftLabel={draftLabel || 'Draft'}
        submitLabel={submitLabel || 'Submit'}
        onOpenPricing={() => setMobilePricingOpen(true)}
        onSaveDraft={onSaveDraft}
        onSubmit={onSubmit}
        needsResubmissionReason={needsResubmissionReason}
        resubmissionReason={resubmissionReason}
        onResubmissionReasonChange={onResubmissionReasonChange}
        disableSubmit={disableSubmit}
      />

      {mobilePricingOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/45"
            aria-label="Close pricing"
            onClick={() => setMobilePricingOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl bg-[#f7f7fb] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur">
              <div>
                <p className="text-sm font-bold text-slate-900">Package Pricing</p>
                <p className="text-[11px] text-slate-500">Adjust GST, markup & discount</p>
              </div>
              <button
                type="button"
                onClick={() => setMobilePricingOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <PackageBuilderPriceSidebar
                lead={lead}
                pkg={pkg}
                pricing={pricing}
                onPricingChange={onPricingChange}
                nights={nights}
                daysCount={itinerary?.length}
                onSaveDraft={onSaveDraft}
                onSubmit={() => {
                  setMobilePricingOpen(false);
                  onSubmit?.();
                }}
                onShare={handleShare}
                onMail={handleMail}
                onWhatsApp={handleWhatsApp}
                onPrint={handlePrint}
                saving={saving}
                draftLabel={draftLabel}
                submitLabel={submitLabel}
                needsResubmissionReason={needsResubmissionReason}
                resubmissionReason={resubmissionReason}
                onResubmissionReasonChange={onResubmissionReasonChange}
                disableSubmit={disableSubmit}
                hideActions
                className="!static"
              />
              <button
                type="button"
                onClick={() => setMobilePricingOpen(false)}
                className="w-full h-11 rounded-xl bg-violet-600 text-sm font-semibold text-white shadow-md"
              >
                Done · {formatINR(mobileTotal)}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <QuotationPdfOverlay
        quote={draftQuote}
        open={showPreview && !!draftQuote}
        autoPrint={autoPrint}
        onAutoPrintDone={() => setAutoPrint(false)}
        onClose={() => {
          setShowPreview(false);
          setAutoPrint(false);
        }}
      />

      <EmailComposerModal
        open={showEmailComposer}
        onClose={() => setShowEmailComposer(false)}
        lead={lead}
        leadId={lead?._id}
        emailEndpoint={emailEndpoint}
        quotation={emailQuotation}
        defaultCategory="quotation"
        onSent={() => toast.success('Quotation email queued for the customer')}
      />

      <PackageResourcePickerDrawer
        open={picker?.type === 'cab'}
        onClose={() => setPicker(null)}
        mode="cab"
        title="Choose your cab"
        subtitle="Prices show +extra or −savings vs your current cab"
        options={packageCabs}
        selectedId={cabSelectedId}
        onSelect={selectCab}
        basePrice={cabBasePrice}
      />

      <PackageResourcePickerDrawer
        open={picker?.type === 'hotel'}
        onClose={() => setPicker(null)}
        mode="hotel"
        title={
          picker?.day
            ? `Change hotel · Day ${picker.day.day}`
            : 'Choose your hotel'
        }
        subtitle={
          picker?.day
            ? 'Hotel → Room → Meal plan for this night'
            : 'Select hotel, then room & meal plan with prices'
        }
        options={hotelDrawerOptions}
        selectedId={hotelSelectedId}
        onSelect={applyStayOption}
        showDayBadge={!picker?.day}
        nights={picker?.day?.stayNights || nights || 1}
        destination={hotelDestination || pkg?.destination || ''}
        basePrice={hotelBasePrice}
      />
    </div>
  );
}
