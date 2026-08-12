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
import { useState } from 'react';
import { cn } from '../../lib/utils';
import { defaultItineraryDay, formatINR } from './quotationUtils';
import { resolvePartyOccupancy, resolveCabCount } from './partyCosting';
import { resolveHotelNightDisplayRate } from '../../lib/mealPlanDefaults';
import {
  getCabCapacityHint,
  getHotelRoomHint,
  getRoomLinesForDay,
} from './partyCapacityHints';

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

function CapacityAlert({ message, tone = 'amber' }) {
  if (!message) return null;
  const styles =
    tone === 'sky'
      ? 'border-sky-200 bg-sky-50 text-sky-900'
      : 'border-amber-200 bg-amber-50 text-amber-950';
  return (
    <p className={cn('rounded-lg border px-2.5 py-2 text-[11px] font-medium leading-snug', styles)}>
      {message}
    </p>
  );
}

function HotelCard({
  meta,
  hotelSel,
  options = [],
  onOpenPicker,
  onAddRoom,
  emptyLabel,
  rooms = 1,
  showTotal = true,
  roomHint = null,
  extraRoomLines = [],
}) {
  const image = meta?.image || meta?.images?.[0];
  const stars = Math.min(5, Math.round(Number(meta?.starRating || 0)));
  const hasOptions = options.length > 0;
  const nights = Math.max(1, Number(hotelSel?.nights ?? 1));
  const upgradePerNight = Number(
    hotelSel?.perNight ?? hotelSel?.totalCost ?? meta?.priceDelta ?? 0
  );
  const isIncluded = upgradePerNight <= 0;
  const rateNight = resolveHotelNightDisplayRate(hotelSel, meta, 'map');
  const rawTotal = isIncluded
    ? rateNight * nights
    : rateNight * nights * Math.max(1, Number(rooms) || 1);
  const displayTotal = Math.round(rawTotal * 100) / 100;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/70 overflow-hidden shadow-sm shadow-violet-100/50">
      {roomHint?.needsAction && (
        <div className="px-3 pt-3">
          <CapacityAlert message={roomHint.message} />
        </div>
      )}
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
                {isIncluded && (meta?.name || hotelSel?.hotel?.name) ? (
                  <span className="font-medium text-emerald-700">· Included in package</span>
                ) : displayTotal <= 0 ? (
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
              {showTotal && isIncluded && displayTotal > 0 && (
                <p className="text-[10px] font-semibold text-emerald-700 leading-none">
                  Included in package
                </p>
              )}
              {hasOptions && onOpenPicker && <ChangeBtn onClick={onOpenPicker} label="Change room" />}
            </div>
          </div>
        </div>
      </div>
      {extraRoomLines.length > 0 && (
        <div className="border-t border-violet-100 px-3 py-2 space-y-1.5">
          {extraRoomLines.map((line, idx) => (
            <div
              key={line.roomSlot || idx + 2}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/80 border border-violet-100 px-2.5 py-2 text-[11px]"
            >
              <span className="font-semibold text-violet-800">
                Room {line.roomSlot || idx + 2}: {line.room?.name || line.hotel?.name || 'Added room'}
                {line.mealPlan?.label ? ` · ${line.mealPlan.label}` : ''}
              </span>
              {line.absolutePerNight > 0 && (
                <span className="font-bold text-violet-700">{formatINR(line.absolutePerNight)}/night</span>
              )}
            </div>
          ))}
        </div>
      )}
      {(roomHint?.needsAction) && (
        <div className="flex flex-wrap gap-2 px-3 pb-3 pt-0">
          {onOpenPicker && (
            <button
              type="button"
              onClick={onOpenPicker}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-violet-300 bg-white text-[11px] font-bold text-violet-700 hover:bg-violet-50"
            >
              <RefreshCw className="w-3 h-3" />
              Change hotel / room
            </button>
          )}
          {onAddRoom && (
            <button
              type="button"
              onClick={onAddRoom}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-violet-600 text-[11px] font-bold text-white hover:bg-violet-500 shadow-sm"
            >
              <Plus className="w-3 h-3" />
              Add room
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CabCard({
  packageCab,
  onChangeCab,
  onAddCab,
  cabCount = 1,
  cabHint = null,
  extraCabs = [],
}) {
  if (!packageCab) return null;
  const upgradeFare = Number(
    packageCab.upgradePrice ?? packageCab.priceDelta ?? packageCab.cost ?? 0
  ) || 0;
  const isDefault = Boolean(packageCab.isDefault) || upgradeFare <= 0;
  const unitFare = Number(
    packageCab.absoluteFare ?? packageCab.totalAmount ?? packageCab.cost ?? 0
  ) || 0;
  const rawTotal = unitFare * Math.max(1, Number(cabCount) || 1);
  const displayTotal = Math.round(rawTotal * 100) / 100;
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 overflow-hidden shadow-sm shadow-sky-100/60">
      {cabHint?.needsAction && (
        <div className="px-3 pt-3">
          <CapacityAlert message={cabHint.message} tone="sky" />
        </div>
      )}
      <div className="flex gap-3 p-3">
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
          {isDefault && displayTotal > 0 && (
            <p className="text-[10px] font-semibold text-sky-600">Included in package</p>
          )}
          <div className="flex flex-col gap-1.5">
            {onChangeCab && <ChangeBtn onClick={onChangeCab} label="Change cab" />}
            {cabHint?.needsAction && onAddCab && (
              <button
                type="button"
                onClick={onAddCab}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-sky-600 text-[10px] font-bold text-white hover:bg-sky-500 shrink-0"
              >
                <Plus className="w-3 h-3" />
                Add cab
              </button>
            )}
          </div>
        </div>
      </div>
      </div>
      {extraCabs.length > 0 && (
        <div className="border-t border-sky-100 px-3 py-2 space-y-1.5">
          {extraCabs.map((cab, idx) => (
            <div
              key={cab.id || cab.slug || idx}
              className="flex items-center justify-between gap-2 rounded-lg bg-white/80 border border-sky-100 px-2.5 py-2 text-[11px]"
            >
              <span className="font-semibold text-sky-800">
                Cab {idx + 2}: {cab.name}
                {cab.seatingCapacity ? ` · ${cab.seatingCapacity} seats` : ''}
              </span>
              {(cab.absoluteFare ?? cab.totalAmount ?? cab.cost) > 0 && (
                <span className="font-bold text-sky-700">
                  {formatINR(Number(cab.absoluteFare ?? cab.totalAmount ?? cab.cost ?? 0))}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildHotelSelFromDay(day, dayNum) {
  const meta = day?.hotelMeta || (day?.hotel ? { name: day.hotel } : null);
  if (!meta?.name && !day?.hotel) return null;
  const name = meta.name || day.hotel;
  const absolute = resolveHotelNightDisplayRate(
    { room: meta.room, mealPlan: meta.mealPlan, absolutePerNight: meta.absolutePerNight },
    meta,
    meta.mealPlanKey || 'map'
  );
  return {
    day: dayNum,
    hotel: {
      id: meta.id || meta.hotelId,
      name,
      image: meta.image || '',
      images: meta.images || [],
      starCategory: meta.starRating || 0,
      starRating: meta.starRating || 0,
      location: meta.location || '',
      city: meta.city || '',
      slug: meta.slug || '',
      startingPrice: absolute,
    },
    room: meta.room || { name: meta.tierName || 'Deluxe' },
    mealPlan:
      meta.mealPlan ||
      (meta.mealPlanKey || meta.meals
        ? { key: meta.mealPlanKey, label: meta.meals }
        : null),
    meals: meta.meals || meta.mealPlan?.label,
    perNight: Number(meta.priceDelta || 0),
    totalCost: Number(meta.priceDelta || 0),
    absolutePerNight: absolute,
    includedRate: Number(meta.includedRate || absolute),
    nights: 1,
    hotelOptions: day.hotelOptions || [],
    fromPackage: true,
  };
}

function SortableDayCard({
  day,
  hotelSel,
  packageCab,
  onChange,
  onRemove,
  onDuplicate,
  onOpenHotelPicker,
  onAddHotelRoom,
  onChangeCab,
  onAddCab,
  extraCabs = [],
  renderHotelActions,
  canRemove,
  isLastDay,
  colorIndex = 0,
  rooms = 1,
  cabCount = 1,
  party = null,
  lead = null,
  dayWiseHotels = [],
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.9 : 1,
  };
  const accent = DAY_ACCENTS[colorIndex % DAY_ACCENTS.length];

  const update = (field, value) => onChange({ ...day, [field]: value });

  // Manual fallback inputs (when API returns empty sightseeing/activities options)
  const [sightAdd, setSightAdd] = useState('');
  const [actAdd, setActAdd] = useState('');

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
  const dayNum = day.day || 1;
  const roomLines = getRoomLinesForDay(dayWiseHotels, dayNum);
  const primaryLine = roomLines[0] || hotelSel;
  const extraRoomLines = roomLines.slice(1);
  const roomHint = getHotelRoomHint(lead, party, roomLines.length);
  const cabHint = day.day === 1 ? getCabCapacityHint(lead, packageCab, party) : null;

  const facts = [
    { icon: Car, label: 'Travel & Transfer', value: packageCab?.name || day.transport || 'Private Transfer', tone: 'border-sky-200 bg-sky-50 text-sky-700' },
    { icon: Hotel, label: 'Hotel & Stay', value: hotelMeta?.name || day.hotel || (isLastDay ? 'Departure' : '—'), tone: 'border-violet-200 bg-violet-50 text-violet-700' },
    { icon: Sparkles, label: 'Activities', value: day.activities || day.sightseeing || 'Sightseeing', tone: 'border-amber-200 bg-amber-50 text-amber-700' },
    { icon: UtensilsCrossed, label: 'Meals', value: hotelMeta?.meals || day.meals || 'As per plan', tone: 'border-rose-200 bg-rose-50 text-rose-700' },
  ];

  const joinNames = (items = []) => (Array.isArray(items) ? items.map((x) => x?.name).filter(Boolean) : []).join(' · ');

  const commitDay = (patch) => onChange({ ...day, ...patch });

  const splitTextNames = (text = '') =>
    String(text || '')
      .split(/\s*[·•]\s*|,\s*|\n+/)
      .map((x) => String(x || '').trim())
      .filter(Boolean);

  const toggleSightseeing = (opt) => {
    const sightseeingOptions = Array.isArray(day.sightseeingOptions) ? day.sightseeingOptions : [];
    if (!opt || !opt.id) return;
    const isLocked = Boolean(opt.isIncluded) || opt.isOptional === false;
    if (isLocked) return;

    const current = Array.isArray(day.selectedSightseeingIds) ? day.selectedSightseeingIds : [];
    const set = new Set(current);
    set.has(opt.id) ? set.delete(opt.id) : set.add(opt.id);
    const nextIds = [...set];

    const selected = sightseeingOptions.filter((o) => nextIds.includes(o.id));
    const text = joinNames(selected);
    commitDay({ selectedSightseeingIds: nextIds, sightseeing: text });
  };

  const toggleActivity = (opt) => {
    const activityOptions = Array.isArray(day.activityOptions) ? day.activityOptions : [];
    if (!opt || !opt.id) return;
    const isLocked = Boolean(opt.isIncluded) || opt.isOptional === false;
    if (isLocked) return;

    const current = Array.isArray(day.selectedActivityIds) ? day.selectedActivityIds : [];
    const set = new Set(current);
    set.has(opt.id) ? set.delete(opt.id) : set.add(opt.id);
    const nextIds = [...set];

    const selected = activityOptions.filter((o) => nextIds.includes(o.id));
    const optionText = joinNames(selected);
    const legacyText = day.activityLegacyText || '';
    const nextActivities = [optionText, legacyText].filter(Boolean).join(' · ');
    commitDay({ selectedActivityIds: nextIds, activities: nextActivities });
  };

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
            hotelSel={primaryLine || hotelSel}
            options={hotelOptions}
            onOpenPicker={() => onOpenHotelPicker?.(day)}
            onAddRoom={!isLastDay ? () => onAddHotelRoom?.(day) : undefined}
            emptyLabel={isLastDay ? 'Departure day · no overnight stay' : 'Select hotel for this night'}
            rooms={extraRoomLines.length > 0 ? 1 : rooms}
            roomHint={!isLastDay ? roomHint : null}
            extraRoomLines={extraRoomLines}
            showTotal={Boolean(
              !isLastDay && (primaryLine?.hotel || hotelSel?.hotel || hotelMeta?.name || day.hotel)
            )}
          />
          {renderHotelActions?.(day)}
          {packageCab && day.day === 1 && (
            <CabCard
              packageCab={packageCab}
              onChangeCab={onChangeCab}
              onAddCab={onAddCab}
              cabCount={cabCount}
              cabHint={cabHint}
              extraCabs={extraCabs}
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

        <div className="mt-3 space-y-3">
          {/* Sightseeing */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-700">Sightseeing</p>
            {Array.isArray(day.sightseeingOptions) && day.sightseeingOptions.length > 0 ? (
              <>
                <p className="text-[10px] text-amber-800/70">Included items are locked</p>
                <div className="flex flex-wrap gap-2">
                  {day.sightseeingOptions.map((opt) => {
                    const selected = (day.selectedSightseeingIds || []).includes(opt.id);
                    const locked = Boolean(opt.isIncluded) || opt.isOptional === false;
                    const priceText =
                      Number(opt.price || 0) > 0
                        ? ` · ${formatINR(Number(opt.price || 0), { zeroLabel: '' })}${opt.priceType === 'per_person' ? '/pax' : ''}`
                        : '';
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer select-none',
                          selected
                            ? 'border-amber-300 bg-amber-50 text-amber-900'
                            : 'border-amber-200 bg-white/70 text-amber-800 hover:bg-amber-50/60',
                          locked && 'opacity-60 cursor-not-allowed'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={locked}
                          onChange={() => toggleSightseeing(opt)}
                          className="h-3.5 w-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500/20"
                        />
                        <span className="font-semibold">{opt.name}</span>
                        {priceText && <span className="text-[10px] text-amber-800/70">{priceText}</span>}
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] text-amber-800/70">Type sightseeing (comma / • / · separated)</p>
                <div className="flex flex-wrap gap-1.5">
                  {splitTextNames(day.sightseeing || '').map((name) => (
                    <span key={name} className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                      {name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={sightAdd}
                    onChange={(e) => setSightAdd(e.target.value)}
                    placeholder="e.g. Solang Valley"
                    className="h-9 flex-1 rounded-lg border border-amber-200 bg-white/80 px-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nextNames = [...splitTextNames(day.sightseeing || ''), ...splitTextNames(sightAdd)];
                      const uniq = [...new Set(nextNames)];
                      commitDay({ sightseeing: uniq.join(' · ') });
                      setSightAdd('');
                    }}
                    className="h-9 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500"
                  >
                    Add
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Activities */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-700">Activities</p>
            {Array.isArray(day.activityOptions) && day.activityOptions.length > 0 ? (
              <>
                <p className="text-[10px] text-amber-800/70">Included items are locked</p>
                <div className="flex flex-wrap gap-2">
                  {day.activityOptions.map((opt) => {
                    const selected = (day.selectedActivityIds || []).includes(opt.id);
                    const locked = Boolean(opt.isIncluded) || opt.isOptional === false;
                    const priceText =
                      Number(opt.price || 0) > 0
                        ? ` · ${formatINR(Number(opt.price || 0), { zeroLabel: '' })}${opt.priceType === 'per_person' ? '/pax' : ''}`
                        : '';
                    return (
                      <label
                        key={opt.id}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer select-none',
                          selected
                            ? 'border-amber-300 bg-amber-50 text-amber-900'
                            : 'border-amber-200 bg-white/70 text-amber-800 hover:bg-amber-50/60',
                          locked && 'opacity-60 cursor-not-allowed'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={locked}
                          onChange={() => toggleActivity(opt)}
                          className="h-3.5 w-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500/20"
                        />
                        <span className="font-semibold">{opt.name}</span>
                        {priceText && <span className="text-[10px] text-amber-800/70">{priceText}</span>}
                      </label>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] text-amber-800/70">Type activities (comma / • / · separated)</p>
                <div className="flex flex-wrap gap-1.5">
                  {splitTextNames(day.activities || '').map((name) => (
                    <span key={name} className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                      {name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={actAdd}
                    onChange={(e) => setActAdd(e.target.value)}
                    placeholder="e.g. Hatu Peak"
                    className="h-9 flex-1 rounded-lg border border-amber-200 bg-white/80 px-3 text-sm outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nextNames = [...splitTextNames(day.activities || ''), ...splitTextNames(actAdd)];
                      const uniq = [...new Set(nextNames)];
                      commitDay({ activities: uniq.join(' · ') });
                      setActAdd('');
                    }}
                    className="h-9 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500"
                  >
                    Add
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
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
  onAddHotelRoom,
  onChangeCab,
  onAddCab,
  extraCabs = [],
  renderHotelActions,
  destination = 'Destination',
  embedded = false,
  lead = null,
  party = null,
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const occ = party || resolvePartyOccupancy(lead || {});
  const rooms = Math.max(1, Number(occ.rooms) || 1);
  const cabCount = Math.max(
    1,
    Number(party?.cabCount) ||
      resolveCabCount(occ.travelers, packageCab?.seatingCapacity || 4)
  );

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
              const dayNum = day.day || idx + 1;
              const roomLines = getRoomLinesForDay(dayWiseHotels, dayNum);
              let hotelSel = roomLines[0];
              if (!hotelSel && (day.hotelMeta?.name || day.hotel)) {
                hotelSel = buildHotelSelFromDay(day, dayNum);
              }
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
                  onAddHotelRoom={onAddHotelRoom}
                  onChangeCab={onChangeCab}
                  onAddCab={onAddCab}
                  extraCabs={extraCabs}
                  renderHotelActions={renderHotelActions}
                  canRemove={itinerary.length > 1}
                  isLastDay={idx === itinerary.length - 1}
                  colorIndex={idx}
                  rooms={rooms}
                  cabCount={cabCount}
                  party={party}
                  lead={lead}
                  dayWiseHotels={dayWiseHotels}
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
