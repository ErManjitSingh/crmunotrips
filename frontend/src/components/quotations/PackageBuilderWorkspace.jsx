import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Car, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { formatINR, getPackageTypeConfig } from './quotationUtils';
import PackageDestinationFlow from './PackageDestinationFlow';
import PackageBuilderDayTimeline from './PackageBuilderDayTimeline';
import PackageBuilderPriceSidebar from './PackageBuilderPriceSidebar';
import InclusionExclusionEditor from './InclusionExclusionEditor';
import QuotePdfPreview from './QuotePdfPreview';
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

/** Strip HTML tags / entities so package descriptions render as plain text. */
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

  const needsMore = plain.length > 140 || plain.split(/\n/).length > 2;

  return (
    <div className="space-y-1.5">
      <p
        className={cn(
          'text-sm text-slate-600 leading-relaxed whitespace-pre-line',
          !expanded && 'line-clamp-2'
        )}
      >
        {plain}
      </p>
      {needsMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-xs font-bold text-violet-600 hover:text-violet-700"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
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
  const [cabPickerOpen, setCabPickerOpen] = useState(false);
  const cabSectionRef = useRef(null);
  const typeCfg = getPackageTypeConfig(pkg?.type || pkg?.category || 'family');

  const highlights = useMemo(() => {
    const lines = [];
    if (nights != null) lines.push(`${nights} Nights Stay`);
    if (itinerary?.length) lines.push(`${itinerary.length} Days Itinerary`);
    if (pkg?.durationLabel) lines.push(pkg.durationLabel);
    const mealHint = itinerary?.some((d) => /breakfast|dinner|lunch/i.test(d.meals || d.hotelMeta?.meals || ''));
    if (mealHint) lines.push('Daily Breakfast & Dinner');
    if (selectedUnoCab?.name || packageCabs[0]?.name) lines.push('Private Cab Included');
    return lines.slice(0, 6);
  }, [nights, itinerary, pkg, selectedUnoCab, packageCabs]);

  const handleReplaceHotel = (day, option) => {
    if (!day || !option) return;
    const nextItinerary = itinerary.map((d) => {
      if (d.id !== day.id && d.day !== day.day) return d;
      return {
        ...d,
        hotel: option.name,
        accommodation: option.name,
        meals: option.meals || d.meals,
        hotelMeta: option,
        hotelOptions: d.hotelOptions || [],
      };
    });
    onItineraryChange?.(nextItinerary);

    const nextHotels = (dayWiseHotels || []).filter((h) => h.day !== day.day);
    nextHotels.push({
      day: day.day,
      hotel: {
        id: option.id,
        name: option.name,
        image: option.image || '',
        images: option.images || [],
        starCategory: option.starRating || 0,
        starRating: option.starRating || 0,
        location: option.location || '',
      },
      room: { name: option.tierName || 'Standard Room' },
      mealPlan: { label: option.meals || day.meals || 'As per package' },
      perNight: Number(option.priceDelta || 0),
      totalCost: Number(option.priceDelta || 0),
      nights: day.stayNights || 1,
      fromPackage: true,
      hotelOptions: day.hotelOptions || [],
    });
    onDayWiseHotelsChange?.(nextHotels.sort((a, b) => a.day - b.day));
  };

  const openCabPicker = () => {
    setCabPickerOpen(true);
    requestAnimationFrame(() => {
      cabSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const selectCab = (cab) => {
    onCabChange?.(cab);
    setCabPickerOpen(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-violet-600"
        >
          <ArrowLeft className="w-4 h-4" /> Change package
        </button>
        <button
          type="button"
          onClick={() => setShowPreview((v) => !v)}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:border-violet-300"
        >
          {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showPreview ? 'Hide Preview' : 'Show PDF Preview'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          <div className="rounded-[24px] border border-slate-200/80 bg-white overflow-hidden shadow-sm">
            {pkg?.coverImage ? (
              <div className="relative h-44 sm:h-56 overflow-hidden">
                <img src={pkg.coverImage} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5">
                  <span className="inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-white/20 text-white backdrop-blur">
                    {typeCfg.label}
                  </span>
                  <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5 drop-shadow">{pkg.name}</h1>
                </div>
              </div>
            ) : (
              <div className="px-6 pt-6">
                <span className="inline-flex text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100">
                  {typeCfg.label}
                </span>
                <h1 className="text-2xl font-bold text-slate-900 mt-2">{pkg?.name}</h1>
              </div>
            )}

            <div className="px-6 py-5 space-y-4">
              <PackageDescription
                text={pkg?.description || pkg?.shortDescription}
                fallback={`Customisable ${pkg?.destination || 'tour'} package for ${lead?.name || 'your guest'} — day-wise hotels and cabs loaded from package API.`}
              />

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {highlights.map((h) => (
                  <li key={h} className="inline-flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                    {h}
                  </li>
                ))}
              </ul>

              {lead && (
                <div className="rounded-2xl border border-violet-100 bg-violet-50/50 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <p className="text-slate-400 font-medium">Guest</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{lead.name}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Pax</p>
                    <p className="font-semibold text-slate-800 mt-0.5">
                      {lead.adults || 0}A / {lead.children || 0}C / {lead.infants || 0}I
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Budget</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{formatINR(lead.budget)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-medium">Source</p>
                    <p className="font-semibold text-slate-800 mt-0.5">{lead.source || '—'}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <PackageDestinationFlow destinations={destinations} onChange={setDestinations} />

          {packageCabs.length > 0 && (
            <div
              ref={cabSectionRef}
              className="rounded-[20px] border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Car className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">Package Cab</p>
                    <p className="text-xs text-slate-500 truncate">
                      {selectedUnoCab
                        ? `${selectedUnoCab.name}${selectedUnoCab.seatingCapacity ? ` · ${selectedUnoCab.seatingCapacity} seats` : ''}`
                        : 'Pick a cab from package day-options'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => (cabPickerOpen ? setCabPickerOpen(false) : openCabPicker())}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {cabPickerOpen ? 'Hide options' : 'Change Cab'}
                </button>
              </div>

              {!cabPickerOpen && selectedUnoCab && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
                  <div className="w-14 h-14 rounded-lg bg-white border border-emerald-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {selectedUnoCab.featuredImage ? (
                      <img src={selectedUnoCab.featuredImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Car className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{selectedUnoCab.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {[selectedUnoCab.seatingCapacity ? `${selectedUnoCab.seatingCapacity} seats` : null, selectedUnoCab.isDefault ? 'Default' : null]
                        .filter(Boolean)
                        .join(' · ') || 'Selected cab'}
                    </p>
                  </div>
                  {Number(selectedUnoCab.cost || selectedUnoCab.priceDelta) > 0 && (
                    <p className="text-xs font-bold text-emerald-600 shrink-0">
                      {formatINR(selectedUnoCab.cost || selectedUnoCab.priceDelta)}
                    </p>
                  )}
                </div>
              )}

              {(!selectedUnoCab || cabPickerOpen) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {packageCabs.map((cab) => {
                    const active =
                      (selectedUnoCab?.id || selectedUnoCab?.packageCabId) === (cab.id || cab.packageCabId);
                    return (
                      <button
                        key={cab.id || cab.packageCabId || cab.name}
                        type="button"
                        onClick={() => selectCab(cab)}
                        className={cn(
                          'flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all',
                          active
                            ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-400/20'
                            : 'border-slate-200 hover:border-emerald-300'
                        )}
                      >
                        <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                          {cab.featuredImage ? (
                            <img src={cab.featuredImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Car className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{cab.name}</p>
                          <p className="text-[10px] text-slate-500">
                            {cab.seatingCapacity ? `${cab.seatingCapacity} seats` : 'Cab'}
                            {cab.isDefault ? ' · Default' : ''}
                          </p>
                          {Number(cab.cost || cab.priceDelta) > 0 && (
                            <p className="text-[10px] font-bold text-emerald-600">
                              {formatINR(cab.cost || cab.priceDelta)}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <PackageBuilderDayTimeline
            itinerary={itinerary}
            dayWiseHotels={dayWiseHotels}
            packageCab={selectedUnoCab}
            onChange={onItineraryChange}
            onReplaceHotel={handleReplaceHotel}
            onChangeCab={openCabPicker}
            destination={hotelDestination || pkg?.destination || 'Destination'}
          />

          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-900">Inclusions & Exclusions</h3>
              <p className="text-xs text-slate-500">Edit package inclusions on the same page</p>
            </div>
            <InclusionExclusionEditor
              inclusions={inclusions}
              exclusions={exclusions}
              onChangeInclusions={onInclusionsChange}
              onChangeExclusions={onExclusionsChange}
            />
          </div>

          {showPreview && draftQuote && (
            <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
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
    </div>
  );
}
