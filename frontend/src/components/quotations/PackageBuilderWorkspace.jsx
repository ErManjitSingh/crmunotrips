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
} from 'lucide-react';
import { getPackageTypeConfig } from './quotationUtils';
import PackageDestinationFlow from './PackageDestinationFlow';
import PackageBuilderDayTimeline from './PackageBuilderDayTimeline';
import PackageBuilderPriceSidebar from './PackageBuilderPriceSidebar';
import InclusionExclusionEditor from './InclusionExclusionEditor';
import QuotePdfPreview from './QuotePdfPreview';
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

function PackageDescription({ text, fallback }) {
  const [expanded, setExpanded] = useState(false);
  const plain = stripHtml(text) || fallback || '';
  if (!plain) return null;
  const needsMore = plain.length > 160 || plain.split(/\n/).length > 2;

  return (
    <div className="space-y-1">
      <p className={cn('text-sm text-slate-600 leading-relaxed whitespace-pre-line', !expanded && 'line-clamp-2')}>
        {plain}
      </p>
      {needsMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-sm font-semibold text-sky-600 hover:text-sky-700"
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
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-300 bg-white text-xs font-bold text-emerald-600 hover:bg-emerald-50 shrink-0"
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
    { icon: Leaf, label: 'Trip Type', value: typeCfg.label || pkg?.packageType || 'Leisure' },
    {
      icon: Users,
      label: 'Suitable For',
      value: lead ? `${lead.adults || 0}A / ${lead.children || 0}C` : 'Family, Couple',
    },
    {
      icon: CalendarDays,
      label: 'Best Season',
      value: pkg?.bestSeason || 'Mar–Jun, Sep–Feb',
    },
    {
      icon: MapPin,
      label: 'Pickup / Drop',
      value: destinations[0]?.name && destinations[destinations.length - 1]?.name
        ? `${destinations[0].name} → ${destinations[destinations.length - 1].name}`
        : pkg?.destination || 'Delhi',
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
    if (picker.day) {
      return picker.day.hotelOptions || [];
    }
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

  const cabSelectedId =
    selectedUnoCab?.id || selectedUnoCab?.packageCabId || selectedUnoCab?.name || null;

  return (
    <div className="space-y-5">
      {/* Page header — mockup style */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-violet-600 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Packages
          </button>
          <h1 className="text-2xl sm:text-[28px] font-bold text-slate-900 tracking-tight">Create Quotation</h1>
          <p className="text-sm text-slate-500 mt-1">
            Build and customize the perfect package for {lead?.name || 'your customer'}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onSaveDraft}
            className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {draftLabel || 'Save as Draft'}
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="h-10 px-4 rounded-xl bg-violet-600 text-white text-sm font-semibold shadow-md shadow-violet-600/25 hover:bg-violet-500 inline-flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            Generate PDF Preview
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {/* Hero package card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm">
            <div className="relative h-52 sm:h-64 overflow-hidden bg-slate-200">
              {pkg?.coverImage ? (
                <img src={pkg.coverImage} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-500" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6 space-y-3">
                <span className="inline-flex text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-white/20 text-white backdrop-blur border border-white/20">
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
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 backdrop-blur border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-5 space-y-5">
              <PackageDescription
                text={pkg?.description || pkg?.shortDescription}
                fallback={`Experience ${pkg?.destination || 'the hills'} with curated stays, private transfers and handpicked sightseeing — fully customisable for your guest.`}
              />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {metaRow.map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 inline-flex items-center gap-1">
                      <Icon className="w-3 h-3 text-violet-500" />
                      {label}
                    </p>
                    <p className="text-sm font-semibold text-slate-800 mt-1 truncate">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <PackageDestinationFlow destinations={destinations} onChange={setDestinations} />

          {/* Transport & Stay twin cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                    <Car className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Transport</p>
                    <p className="text-[11px] text-slate-500">Private vehicle for the trip</p>
                  </div>
                </div>
                {packageCabs.length > 0 && <ChangeBtn onClick={openCabPicker} />}
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {selectedUnoCab?.name || 'Sedan (Dzire / Etios)'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {[
                  'AC Vehicle',
                  selectedUnoCab?.seatingCapacity ? `${selectedUnoCab.seatingCapacity} Seats` : '4 Seats',
                ].join(' · ')}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                    <Hotel className="w-4 h-4" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Stay</p>
                    <p className="text-[11px] text-slate-500">Day-wise hotels from package</p>
                  </div>
                </div>
                {stayOptions.length > 0 && <ChangeBtn onClick={openStayPicker} />}
              </div>
              <p className="text-sm font-semibold text-slate-900">{staySummary.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{staySummary.detail}</p>
            </div>
          </div>

          <PackageBuilderDayTimeline
            itinerary={itinerary}
            dayWiseHotels={dayWiseHotels}
            packageCab={selectedUnoCab}
            onChange={onItineraryChange}
            onOpenHotelPicker={openDayHotelPicker}
            onChangeCab={openCabPicker}
            destination={hotelDestination || pkg?.destination || 'Destination'}
          />

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Inclusions & Exclusions</h3>
              <p className="text-xs text-slate-500">Edit what is included in this quotation</p>
            </div>
            <InclusionExclusionEditor
              inclusions={inclusions}
              exclusions={exclusions}
              onChangeInclusions={onInclusionsChange}
              onChangeExclusions={onExclusionsChange}
            />
          </div>

          {showPreview && draftQuote && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-4">Live PDF Preview</h3>
              <QuotePdfPreview quote={draftQuote} />
            </div>
          )}
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
          saving={saving}
          draftLabel={draftLabel}
          submitLabel={submitLabel}
        />
      </div>

      <PackageResourcePickerDrawer
        open={picker?.type === 'cab'}
        onClose={() => setPicker(null)}
        mode="cab"
        title="Choose your cab"
        subtitle="Private transfer options for this package"
        options={packageCabs}
        selectedId={cabSelectedId}
        onSelect={selectCab}
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
      />
    </div>
  );
}
