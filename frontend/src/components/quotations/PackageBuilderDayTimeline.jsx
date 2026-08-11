import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Plus,
  Trash2,
  Copy,
  Car,
  Hotel,
  UtensilsCrossed,
  Sparkles,
  Star,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { defaultItineraryDay, formatINR, applyAdminMarginToAmount } from './quotationUtils';
import { resolvePartyOccupancy } from './partyCosting';

const DAY_ACCENTS = [
  { card: 'border-teal-200 bg-gradient-to-br from-teal-50 to-white', badge: 'bg-teal-600 shadow-teal-600/30', strip: 'from-teal-500 to-cyan-400' },
  { card: 'border-violet-200 bg-gradient-to-br from-violet-50 to-white', badge: 'bg-violet-600 shadow-violet-600/30', strip: 'from-violet-500 to-fuchsia-400' },
  { card: 'border-sky-200 bg-gradient-to-br from-sky-50 to-white', badge: 'bg-sky-600 shadow-sky-600/30', strip: 'from-sky-500 to-blue-400' },
  { card: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white', badge: 'bg-amber-500 shadow-amber-500/30', strip: 'from-amber-500 to-orange-400' },
  { card: 'border-rose-200 bg-gradient-to-br from-rose-50 to-white', badge: 'bg-rose-500 shadow-rose-500/30', strip: 'from-rose-500 to-pink-400' },
  { card: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white', badge: 'bg-emerald-600 shadow-emerald-600/30', strip: 'from-emerald-500 to-lime-400' },
];

function Chip({ children, tone = 'bg-teal-100 text-teal-800' }) {
  return (
    <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold', tone)}>
      {children}
    </span>
  );
}

function ChangeBtn({ onClick, label = 'Change' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-emerald-300 bg-white text-[10px] font-bold text-emerald-600 hover:bg-emerald-50 shrink-0"
    >
      <RefreshCw className="w-3 h-3" />
      {label}
    </button>
  );
}

function HotelCard({
  meta,
  hotelSel,
  options = [],
  onOpenPicker,
  emptyLabel,
  rooms = 1,
  adminMarginPercent = 0,
  showTotal = true,
}) {
  const image = meta?.image || meta?.images?.[0];
  const stars = Math.min(5, Math.round(Number(meta?.starRating || 0)));
  const hasOptions = options.length > 0;
  const nights = Math.max(1, Number(hotelSel?.nights ?? 1));
  const absoluteNight = Number(
    hotelSel?.absolutePerNight ??
      meta?.absolutePerNight ??
      meta?.startingPrice ??
      meta?.includedRate ??
      0
  );
  const rawTotal = absoluteNight * nights * Math.max(1, Number(rooms) || 1);
  const displayTotal = applyAdminMarginToAmount(rawTotal, adminMarginPercent);

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/70 overflow-hidden shadow-sm shadow-violet-100/50">
      <div className="flex gap-3 p-3">
        <div className="w-16 h-16 rounded-xl bg-violet-200/70 flex items-center justify-center shrink-0 overflow-hidden ring-2 ring-violet-100">
          {image ? (
            <img src={image} alt="" className="w-full h-full object-cover" />
          ) : (
            <Hotel className="w-6 h-6 text-violet-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Hotel & Stay</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{meta?.name || emptyLabel}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-600">
                {stars > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    {stars}★
                  </span>
                )}
                {meta?.tierName && <span>{meta.tierName}</span>}
                {meta?.room?.name && meta.room.name !== meta.tierName && (
                  <span>· {meta.room.name}</span>
                )}
                {(meta?.mealPlan?.label || meta?.meals) && (
                  <span>· {meta.mealPlan?.label || meta.meals}</span>
                )}
                {!showTotal || displayTotal <= 0 ? (
                  <span className="font-medium text-slate-400">· Not included</span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {showTotal && displayTotal > 0 && (
                <p className="text-base font-bold text-violet-800 metric-tabular leading-none">
                  {formatINR(displayTotal)}
                </p>
              )}
              {hasOptions && onOpenPicker && <ChangeBtn onClick={onOpenPicker} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CabCard({ packageCab, onChangeCab, cabCount = 1, adminMarginPercent = 0 }) {
  if (!packageCab) return null;
  const unitFare = Number(
    packageCab.absoluteFare ?? packageCab.totalAmount ?? packageCab.cost ?? 0
  ) || 0;
  const rawTotal = unitFare * Math.max(1, Number(cabCount) || 1);
  const displayTotal = applyAdminMarginToAmount(rawTotal, adminMarginPercent);
  return (
    <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 shadow-sm shadow-sky-100/60">
      <div className="w-16 h-16 rounded-xl bg-white border border-sky-200 overflow-hidden shrink-0 flex items-center justify-center">
        {packageCab.featuredImage ? (
          <img src={packageCab.featuredImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <Car className="w-6 h-6 text-sky-600" />
        )}
      </div>
      <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700">Cab Included</p>
          <p className="text-sm font-semibold text-slate-900 truncate">{packageCab.name}</p>
          <p className="text-[11px] text-sky-800/70 mt-0.5 font-medium">
            {[packageCab.seatingCapacity ? `${packageCab.seatingCapacity} seats` : null, 'AC Vehicle']
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {displayTotal > 0 && (
            <p className="text-base font-bold text-sky-800 metric-tabular leading-none">
              {formatINR(displayTotal)}
            </p>
          )}
          {onChangeCab && <ChangeBtn onClick={onChangeCab} />}
        </div>
      </div>
    </div>
  );
}

function SortableDayCard({
  day,
  hotelSel,
  packageCab,
  onChange,
  onRemove,
  onDuplicate,
  onOpenHotelPicker,
  onChangeCab,
  renderHotelActions,
  canRemove,
  isLastDay,
  colorIndex = 0,
  rooms = 1,
  cabCount = 1,
  adminMarginPercent = 0,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  };
  const accent = DAY_ACCENTS[colorIndex % DAY_ACCENTS.length];

  const update = (field, value) => onChange({ ...day, [field]: value });

  const hotelMeta =
    day.hotelMeta ||
    (hotelSel?.hotel
      ? {
          name: hotelSel.hotel.name,
          image: hotelSel.hotel.image || hotelSel.hotel.images?.[0],
          images: hotelSel.hotel.images,
          starRating: hotelSel.hotel.starRating || hotelSel.hotel.starCategory,
          meals: hotelSel.mealPlan?.label || day.meals,
          mealPlan: hotelSel.mealPlan,
          mealPlanKey: hotelSel.mealPlan?.key,
          room: hotelSel.room,
          tierName: hotelSel.room?.name,
          location: hotelSel.hotel.location,
          priceDelta: hotelSel.perNight,
          absolutePerNight: hotelSel.absolutePerNight,
          startingPrice: hotelSel.hotel?.startingPrice || hotelSel.absolutePerNight,
          includedRate: hotelSel.includedRate,
        }
      : day.hotel
        ? { name: day.hotel, meals: day.meals }
        : null);

  const hotelOptions = day.hotelOptions || hotelSel?.hotelOptions || [];

  const facts = [
    { icon: Car, label: 'Travel & Transfer', value: packageCab?.name || day.transport || 'Private Transfer', tone: 'border-sky-200 bg-sky-50 text-sky-700' },
    { icon: Hotel, label: 'Hotel & Stay', value: hotelMeta?.name || day.hotel || (isLastDay ? 'Departure' : '—'), tone: 'border-violet-200 bg-violet-50 text-violet-700' },
    { icon: Sparkles, label: 'Activities', value: day.activities || day.sightseeing || 'Sightseeing', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
    { icon: UtensilsCrossed, label: 'Meals', value: hotelMeta?.meals || day.meals || 'As per plan', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
  ];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'rounded-2xl border overflow-hidden shadow-md',
        accent.card,
        isDragging && 'ring-2 ring-teal-400'
      )}
    >
      <div className={cn('h-1.5 w-full bg-gradient-to-r', accent.strip)} />
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-4">
          <button
            type="button"
            className="mt-1 p-1 rounded-lg text-slate-400 hover:bg-white/80 cursor-grab"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[58px] h-7 px-2.5 rounded-full text-white text-[11px] font-bold shadow-sm',
                  accent.badge
                )}
              >
                Day {day.day}
              </span>
              <input
                value={day.title || ''}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Day title"
                className="flex-1 min-w-[160px] h-9 rounded-lg border border-white/80 bg-white/70 hover:border-teal-200 focus:border-teal-400 px-2 text-sm font-bold text-slate-900 focus:outline-none"
              />
              <button type="button" onClick={onDuplicate} className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-teal-600">
                <Copy className="w-4 h-4" />
              </button>
              {canRemove && (
                <button type="button" onClick={onRemove} className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Chip tone="bg-sky-100 text-sky-800">Transport</Chip>
              <Chip tone="bg-violet-100 text-violet-800">Stay</Chip>
              <Chip tone="bg-rose-100 text-rose-800">Meals</Chip>
              {day.sightseeing && <Chip tone="bg-amber-100 text-amber-800">Sightseeing</Chip>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          {facts.map(({ icon: Icon, label, value, tone }) => (
            <div key={label} className={cn('rounded-xl border px-2.5 py-2', tone)}>
              <p className="text-[10px] font-bold inline-flex items-center gap-1 mb-1 opacity-80">
                <Icon className="w-3 h-3" />
                {label}
              </p>
              <p className="text-xs font-semibold text-slate-900 line-clamp-2">{value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3 mb-3">
          <HotelCard
            meta={hotelMeta}
            hotelSel={hotelSel}
            options={hotelOptions}
            onOpenPicker={() => onOpenHotelPicker?.(day)}
            emptyLabel={isLastDay ? 'Departure day · no overnight stay' : 'Hotel not linked'}
            rooms={rooms}
            adminMarginPercent={adminMarginPercent}
            showTotal={!isLastDay && Boolean(hotelSel?.hotel || hotelMeta?.name)}
          />
          {renderHotelActions?.(day)}
          {packageCab && day.day === 1 && (
            <CabCard
              packageCab={packageCab}
              onChangeCab={onChangeCab}
              cabCount={cabCount}
              adminMarginPercent={adminMarginPercent}
            />
          )}
        </div>

        <textarea
          value={day.description || ''}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Describe experiences, sightseeing and transfers for this day..."
          rows={3}
          className="w-full rounded-xl border border-white bg-white/80 px-3 py-2.5 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/25"
        />
      </div>
    </div>
  );
}

export default function PackageBuilderDayTimeline({
  itinerary = [],
  dayWiseHotels = [],
  packageCab = null,
  onChange,
  onOpenHotelPicker,
  onChangeCab,
  renderHotelActions,
  destination = 'Destination',
  embedded = false,
  lead = null,
  party = null,
  adminMarginPercent = 0,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const occ = party || resolvePartyOccupancy(lead || {});
  const rooms = Math.max(1, Number(occ.rooms) || 1);
  const cabCount = Math.max(1, Number(occ.cabCount) || 1);
  const marginPct = Math.max(0, Number(adminMarginPercent) || 0);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itinerary.findIndex((d) => d.id === active.id);
    const newIndex = itinerary.findIndex((d) => d.id === over.id);
    onChange?.(arrayMove(itinerary, oldIndex, newIndex).map((d, i) => ({ ...d, day: i + 1 })));
  };

  const addDay = () => {
    onChange?.([...itinerary, defaultItineraryDay(itinerary.length + 1, destination)]);
  };

  const updateDay = (idx, day) => {
    const next = [...itinerary];
    next[idx] = day;
    onChange?.(next);
  };

  const removeDay = (idx) => {
    onChange?.(itinerary.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day: i + 1 })));
  };

  const duplicateDay = (idx) => {
    const copy = {
      ...JSON.parse(JSON.stringify(itinerary[idx])),
      id: `day-${Date.now()}-${idx}`,
      day: itinerary.length + 1,
      title: `${itinerary[idx].title || `Day ${idx + 1}`} (copy)`,
    };
    onChange?.([...itinerary, copy].map((d, i) => ({ ...d, day: i + 1 })));
  };

  return (
    <div className="space-y-4">
      <div className={cn('flex items-center justify-between gap-3', embedded && 'mb-1')}>
        {!embedded && (
          <div>
            <h3 className="text-base font-bold text-slate-900">Day-wise Itinerary</h3>
            <p className="text-xs text-slate-500">Hotels & cab from package API · drag to reorder</p>
          </div>
        )}
        <button
          type="button"
          onClick={addDay}
          className={cn(
            'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-teal-600 text-white text-xs font-semibold shadow-sm shadow-teal-600/25',
            embedded && 'ml-auto'
          )}
        >
          <Plus className="w-3.5 h-3.5" /> Add Day
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={itinerary.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {itinerary.map((day, idx) => {
              const hotelSel = dayWiseHotels.find((h) => h.day === (day.day || idx + 1));
              return (
                <SortableDayCard
                  key={day.id}
                  day={day}
                  hotelSel={hotelSel}
                  packageCab={packageCab}
                  onChange={(d) => updateDay(idx, d)}
                  onRemove={() => removeDay(idx)}
                  onDuplicate={() => duplicateDay(idx)}
                  onOpenHotelPicker={onOpenHotelPicker}
                  onChangeCab={onChangeCab}
                  renderHotelActions={renderHotelActions}
                  canRemove={itinerary.length > 1}
                  isLastDay={idx === itinerary.length - 1}
                  colorIndex={idx}
                  rooms={rooms}
                  cabCount={cabCount}
                  adminMarginPercent={marginPct}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {!itinerary.length && (
        <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/50 px-6 py-12 text-center">
          <p className="text-sm font-semibold text-teal-900">No days yet</p>
          <p className="text-xs text-teal-700/70 mt-1">Select a package or add a day to start building.</p>
        </div>
      )}
    </div>
  );
}
