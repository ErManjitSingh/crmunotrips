import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { getPackageTypeConfig } from './quotationUtils';
import PackageDestinationFlow from './PackageDestinationFlow';
import PackageBuilderDayTimeline from './PackageBuilderDayTimeline';
import PackageBuilderPriceSidebar from './PackageBuilderPriceSidebar';
import InclusionExclusionEditor from './InclusionExclusionEditor';
import QuotationPdfOverlay from './QuotationPdfOverlay';
import PackageResourcePickerDrawer from './PackageResourcePickerDrawer';
import { cn } from '../../lib/utils';

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
        <div className="px-4 sm:px-5 pt-4 pb-3 flex flex-wrap items-start justify-between gap-3 border-b border-black/5">
          <div className="flex items-start gap-3 min-w-0">
            {Icon && (
              <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', t.iconWrap)}>
                <Icon className="w-5 h-5" />
              </span>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {step != null && (
                  <span className={cn('text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md', t.badge)}>
                    Step {step}
                  </span>
                )}
                {title && <h3 className="text-base font-bold text-slate-900">{title}</h3>}
              </div>
              {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
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
}) {
  const [destinations, setDestinations] = useState(() => parseDestinationStops(pkg, lead));
  const [showPreview, setShowPreview] = useState(false);
  const [picker, setPicker] = useState(null);
  const typeCfg = getPackageTypeConfig(pkg?.type || pkg?.category || 'family');

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
    const perNight = Number(option.perNight ?? option.priceDelta ?? 0);
    const stayNights = Math.max(1, Number(option.nights || day.stayNights || 1));
    const totalCost = Number(option.totalCost ?? perNight * stayNights);
    const hotelMeta = {
      ...option,
      tierName: roomName,
      meals: mealLabel,
      priceDelta: perNight,
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
        startingPrice: option.startingPrice || 0,
      },
      room: option.room || { name: roomName },
      mealPlan: option.mealPlan || { label: mealLabel },
      perNight,
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
    const pickAmount = (meta, dayHotel) => {
      const perNight = Number(dayHotel?.perNight ?? meta?.perNight ?? 0) || 0;
      const delta = Number(meta?.priceDelta ?? 0) || 0;
      const start = Number(meta?.startingPrice ?? dayHotel?.hotel?.startingPrice ?? 0) || 0;
      if (perNight !== 0) return perNight;
      if (delta !== 0) return delta;
      return start;
    };
    if (picker?.type === 'hotel' && picker.day) {
      const meta = picker.day.hotelMeta;
      const dayHotel = (dayWiseHotels || []).find((h) => h.day === picker.day.day);
      return pickAmount(meta, dayHotel);
    }
    const firstMeta = itinerary?.find((d) => d.hotelMeta)?.hotelMeta;
    const firstDayHotel = (dayWiseHotels || [])[0];
    return pickAmount(firstMeta, firstDayHotel);
  }, [picker, itinerary, dayWiseHotels]);

  const cabBasePrice = Number(
    selectedUnoCab?.cost ?? selectedUnoCab?.priceDelta ?? selectedUnoCab?.totalAmount ?? 0
  ) || 0;

  const cabSelectedId =
    selectedUnoCab?.id || selectedUnoCab?.packageCabId || selectedUnoCab?.name || null;

  return (
    <div className="space-y-5 rounded-3xl bg-gradient-to-b from-slate-100 via-indigo-50/40 to-amber-50/30 p-3 sm:p-4 -mx-1">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-indigo-200/70 bg-white/90 px-4 py-4 shadow-sm shadow-indigo-100/50">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Packages
          </button>
          <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">Create Quotation</h1>
          <p className="text-sm text-slate-600 mt-1">
            Build and customize the perfect package for{' '}
            <span className="font-semibold text-indigo-700">{lead?.name || 'your customer'}</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onSaveDraft}
            className="h-10 px-4 rounded-xl border border-indigo-200 bg-indigo-50 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
          >
            {draftLabel || 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="h-10 px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold shadow-md shadow-violet-600/25 hover:bg-violet-500 inline-flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            Generate PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <SectionShell
            tone="package"
            step={1}
            title="Package Overview"
            subtitle="Cover, highlights and trip meta"
            icon={Sparkles}
          >
            <div className="rounded-xl overflow-hidden border border-indigo-100 bg-white shadow-sm">
              <div className="relative h-48 sm:h-56 overflow-hidden bg-slate-200">
                {pkg?.coverImage ? (
                  <img src={pkg.coverImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-500" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 space-y-2.5">
                  <span className="inline-flex text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-indigo-500 text-white shadow-sm">
                    Package Preview
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-white drop-shadow-sm leading-snug">
                    {pkg?.name}
                    {durationLabel ? ` — ${durationLabel}` : ''}
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {heroTags.map(({ icon: Icon, label }) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 backdrop-blur border border-white/25 px-2.5 py-1 text-[11px] font-semibold text-white"
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-4 sm:px-5 py-4 space-y-4 bg-gradient-to-b from-indigo-50/50 to-white">
                <PackageDescription
                  text={pkg?.description || pkg?.shortDescription}
                  fallback={`Experience ${pkg?.destination || 'the hills'} with curated stays, private transfers and handpicked sightseeing — fully customisable for your guest.`}
                />

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {metaRow.map(({ icon: Icon, label, value, tone }) => (
                    <div key={label} className={cn('rounded-xl border px-3 py-2.5', tone)}>
                      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 inline-flex items-center gap-1">
                        <Icon className="w-3 h-3" />
                        {label}
                      </p>
                      <p className="text-sm font-bold text-slate-900 mt-1 truncate">{value}</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <p className="text-xs text-sky-700/80 mt-1 font-medium">
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
                <p className="text-xs text-violet-700/80 mt-1 font-medium">{staySummary.detail}</p>
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

        <PackageBuilderPriceSidebar
          lead={lead}
          pkg={pkg}
          pricing={pricing}
          onPricingChange={onPricingChange}
          nights={nights}
          daysCount={itinerary?.length}
          onSaveDraft={onSaveDraft}
          onSubmit={onSubmit}
          onPreview={() => setShowPreview(true)}
          onPrint={() => setShowPreview(true)}
          saving={saving}
          draftLabel={draftLabel}
          submitLabel={submitLabel}
        />
      </div>

      <QuotationPdfOverlay
        quote={draftQuote}
        open={showPreview && !!draftQuote}
        onClose={() => setShowPreview(false)}
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
