import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Hotel as HotelIcon,
  Car,
  Sparkles,
  ListChecks,
  Eye,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatINR, getPackageTypeConfig } from './quotationUtils';
import PackageDestinationFlow from './PackageDestinationFlow';
import PackageBuilderDayTimeline from './PackageBuilderDayTimeline';
import PackageBuilderPriceSidebar from './PackageBuilderPriceSidebar';
import DayWiseHotelSelector from './DayWiseHotelSelector';
import UnoCabSelector from './UnoCabSelector';
import InclusionExclusionEditor from './InclusionExclusionEditor';
import QuotePdfPreview from './QuotePdfPreview';

const SECTIONS = [
  { id: 'itinerary', label: 'Itinerary', icon: Sparkles },
  { id: 'hotels', label: 'Hotels', icon: HotelIcon },
  { id: 'cab', label: 'Cab', icon: Car },
  { id: 'inclusions', label: 'Inclusions', icon: ListChecks },
  { id: 'preview', label: 'Preview', icon: Eye },
];

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
  const [section, setSection] = useState('itinerary');
  const [destinations, setDestinations] = useState(() => parseDestinationStops(pkg, lead));
  const typeCfg = getPackageTypeConfig(pkg?.type || pkg?.category || 'family');

  const highlights = useMemo(() => {
    const lines = [];
    if (nights != null) lines.push(`${nights} Nights Stay`);
    if (itinerary?.length) lines.push(`${itinerary.length} Days Itinerary`);
    if (pkg?.durationLabel) lines.push(pkg.durationLabel);
    const mealHint = itinerary?.some((d) => /breakfast|dinner|lunch/i.test(d.meals || ''));
    if (mealHint) lines.push('Daily Breakfast & Dinner');
    lines.push('Private Transfers');
    return lines.slice(0, 6);
  }, [nights, itinerary, pkg]);

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
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={cn(
                'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors',
                section === id
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="space-y-5 min-w-0">
          {/* Package hero — GTrip style */}
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
              {!pkg?.coverImage && null}
              <p className="text-sm text-slate-600 leading-relaxed">
                {pkg?.description ||
                  `Customisable ${pkg?.destination || 'tour'} package for ${lead?.name || 'your guest'} — hotels, cabs, meals and experiences loaded from live inventory.`}
              </p>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Tour Highlights</p>
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
              </div>

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

          {section === 'itinerary' && (
            <PackageBuilderDayTimeline
              itinerary={itinerary}
              dayWiseHotels={dayWiseHotels}
              onChange={onItineraryChange}
              destination={hotelDestination || pkg?.destination || 'Destination'}
            />
          )}

          {section === 'hotels' && (
            <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-1">Hotels & Meals</h3>
              <p className="text-xs text-slate-500 mb-4">Live inventory from Hotel API — search, replace, choose room & meal plan</p>
              <DayWiseHotelSelector
                nights={nights}
                destination={hotelDestination}
                value={dayWiseHotels}
                onChange={onDayWiseHotelsChange}
              />
            </div>
          )}

          {section === 'cab' && (
            <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
              <h3 className="text-base font-bold text-slate-900 mb-1">Cab & Transfers</h3>
              <p className="text-xs text-slate-500 mb-4">Package-included and searchable cabs from Cab API</p>
              <UnoCabSelector
                lead={lead}
                pkg={pkg}
                packageCabs={packageCabs}
                value={selectedUnoCab}
                onChange={onCabChange}
              />
            </div>
          )}

          {section === 'inclusions' && (
            <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm space-y-5">
              <InclusionExclusionEditor
                inclusions={inclusions}
                exclusions={exclusions}
                onChangeInclusions={onInclusionsChange}
                onChangeExclusions={onExclusionsChange}
              />
            </div>
          )}

          {section === 'preview' && draftQuote && (
            <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm">
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
          onPreview={() => setSection('preview')}
          saving={saving}
          draftLabel={draftLabel}
          submitLabel={submitLabel}
        />
      </div>
    </div>
  );
}
