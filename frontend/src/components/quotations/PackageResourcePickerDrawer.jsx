import { useEffect, useMemo, useState } from 'react';
import {
  X,
  Car,
  Hotel,
  Star,
  Search,
  Check,
  Users,
  MapPin,
  UtensilsCrossed,
  ArrowLeft,
  BedDouble,
  Loader2,
  Wifi,
  ParkingSquare,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppDrawer from '../ui/AppDrawer';
import API from '../../api/axios';
import { formatINR } from './quotationUtils';
import {
  ensureMealPlanOptions,
  mealPlanNightlyRate,
  normalizeMealPlanKey,
  pickDefaultPackageRoom,
  pickPreferredMealPlan,
  resolveSelectedMealPlan,
} from '../../lib/mealPlanDefaults';
import { cn } from '../../lib/utils';

const HOTEL_STEPS = [
  { key: 'hotel', label: 'Hotel', hint: 'Select your hotel' },
  { key: 'room', label: 'Room', hint: 'Choose room type' },
  { key: 'meal', label: 'Meal Plan', hint: 'Package meal default — change if needed' },
];

const BADGE_STYLES = [
  { key: 'best', label: 'BEST SELLER', className: 'bg-rose-500 text-white' },
  { key: 'popular', label: 'POPULAR', className: 'bg-violet-600 text-white' },
  { key: 'premium', label: 'PREMIUM', className: 'bg-amber-500 text-white' },
  { key: 'value', label: 'VALUE', className: 'bg-emerald-600 text-white' },
];

/** Price of an option relative to currently selected stay/cab. */
function getOptionAmount(opt = {}) {
  // Cabs: absoluteFare is the trip fare used for relative comparison
  const cabAbs = Number(opt.absoluteFare ?? 0) || 0;
  if (cabAbs > 0) return cabAbs;
  // Prefer true upgrade / cost delta. Catalog starting_price is display-only (included in package).
  const explicit =
    Number(opt.perNight ?? opt.priceDelta ?? opt.cost ?? opt.totalAmount ?? opt.upgrade_price ?? 0) || 0;
  if (explicit !== 0) return explicit;
  // For relative UI against current absolute rate, fall back to catalog rate when no upgrade.
  return Number(opt.absolutePerNight ?? opt.startingPrice ?? opt.starting_price ?? 0) || 0;
}

/** Absolute nightly rate for "vs current" comparisons (not the cost delta). */
function getAbsoluteNightly(opt = {}) {
  return (
    Number(opt.absolutePerNight ?? 0) ||
    Number(opt.startingPrice ?? opt.starting_price ?? 0) ||
    Number(opt.perNight ?? opt.priceDelta ?? 0) ||
    0
  );
}

function formatRelativePrice(amount, basePrice, { isCurrent = false } = {}) {
  if (isCurrent) {
    return {
      primary: 'Current',
      secondary: amount > 0 ? formatINR(amount) : 'Not included',
      tone: 'text-slate-700',
      chip: 'bg-slate-100 text-slate-600 border-slate-200',
      hint: 'Already selected',
    };
  }
  const diff = Math.round(Number(amount) - Number(basePrice || 0));
  if (diff === 0) {
    return {
      primary: 'Same price',
      secondary: amount > 0 ? formatINR(amount) : 'Not included',
      tone: 'text-slate-600',
      chip: 'bg-slate-100 text-slate-600 border-slate-200',
      hint: amount > 0 ? 'Same as current stay' : 'No extra charge',
    };
  }
  if (diff > 0) {
    return {
      primary: `+${formatINR(diff)}`,
      secondary: amount > 0 ? formatINR(amount) : null,
      tone: 'text-emerald-700',
      chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      hint: 'More than current',
    };
  }
  return {
    primary: `−${formatINR(Math.abs(diff))}`,
    secondary: amount > 0 ? formatINR(amount) : null,
    tone: 'text-sky-700',
    chip: 'bg-sky-50 text-sky-700 border-sky-200',
    hint: 'Less than current',
  };
}

function hotelBadge(option, index) {
  if (option.isDefault) return BADGE_STYLES[0];
  if (Number(option.starRating) >= 5) return BADGE_STYLES[2];
  if (Number(option.starRating) >= 4) return BADGE_STYLES[1];
  return BADGE_STYLES[(index % 2) + 1];
}

function HotelStepHeader({ step, onClose, title }) {
  const idx = HOTEL_STEPS.findIndex((s) => s.key === step);
  return (
    <div className="shrink-0 border-b border-violet-100 bg-white">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-500">Stay</p>
          <h2 className="text-base font-bold text-slate-900 truncate">{title || 'Change Hotel'}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-5 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {HOTEL_STEPS.map((s, i) => {
            const active = s.key === step;
            const done = i < idx;
            return (
              <div
                key={s.key}
                className={cn(
                  'rounded-xl border px-3 py-2.5 transition-all',
                  active && 'border-violet-300 bg-violet-50 shadow-sm shadow-violet-100',
                  done && !active && 'border-emerald-200 bg-emerald-50/70',
                  !done && !active && 'border-slate-200 bg-slate-50'
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black',
                      active && 'bg-violet-600 text-white',
                      done && !active && 'bg-emerald-500 text-white',
                      !done && !active && 'bg-slate-200 text-slate-500'
                    )}
                  >
                    {done && !active ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-[10px] font-black uppercase tracking-wide',
                        active ? 'text-violet-700' : done ? 'text-emerald-700' : 'text-slate-400'
                      )}
                    >
                      {s.label}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate hidden sm:block">{s.hint}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CabOptionCard({ cab, selected, onSelect, basePrice = 0 }) {
  const image = cab.featuredImage || cab.image;
  const amount = getOptionAmount(cab);
  const rel = formatRelativePrice(amount, basePrice, { isCurrent: selected });

  return (
    <button
      type="button"
      onClick={() => onSelect(cab)}
      className={cn(
        'group relative w-full text-left rounded-2xl border overflow-hidden transition-all',
        selected
          ? 'border-emerald-400 bg-emerald-50/40 ring-2 ring-emerald-400/20'
          : 'border-slate-200 bg-white hover:border-emerald-300'
      )}
    >
      <div className="flex gap-3 p-3.5">
        <div className="relative w-24 h-20 rounded-xl overflow-hidden bg-sky-50 shrink-0">
          {image ? (
            <img src={image} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Car className="w-7 h-7 text-emerald-500/70" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">{cab.name}</p>
            {selected && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="w-3 h-3" />
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {[cab.seatingCapacity ? `${cab.seatingCapacity} seats` : null, 'AC Vehicle', cab.isDefault ? 'Default' : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className={cn('text-base font-black leading-none', rel.tone)}>{rel.primary}</p>
              <p className="text-[10px] font-medium text-slate-400 mt-1">{rel.hint}</p>
            </div>
            {rel.secondary && !selected && (
              <p className="text-[11px] font-semibold text-slate-500">{rel.secondary}</p>
            )}
          </div>
          <span className={cn('mt-2 inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold', rel.chip)}>
            vs current cab
          </span>
        </div>
      </div>
    </button>
  );
}

/** Horizontal list-row hotel card (mockup style, stacked vertically). */
function HotelListRow({ option, selected, loading, onSelect, showDay, index, basePrice = 0 }) {
  const image = option.image || option.images?.[0];
  const upgrade = Number(option.priceDelta ?? option.upgrade_price ?? 0) || 0;
  const absolute = getAbsoluteNightly(option);
  // Compare absolute nightly rates so upgrade-only options don't look like −₹base.
  const compareAmount = absolute > 0 ? absolute : Number(basePrice || 0) + upgrade;
  const amount = absolute > 0 ? absolute : upgrade;
  const rel = formatRelativePrice(compareAmount, basePrice, { isCurrent: selected });
  const stars = Number(option.starRating || 0);
  const badge = hotelBadge(option, index);
  const amenities = (option.amenities || []).slice(0, 3);

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white overflow-hidden transition-all',
        selected
          ? 'border-violet-400 ring-2 ring-violet-400/25 shadow-md shadow-violet-100'
          : 'border-slate-200 hover:border-violet-300 hover:shadow-sm'
      )}
    >
      <div className="flex flex-col sm:flex-row gap-0">
        <div className="relative sm:w-[168px] h-36 sm:h-auto sm:min-h-[132px] shrink-0 bg-violet-50 overflow-hidden">
          {image ? (
            <img src={image} alt="" className="w-full h-full object-cover min-h-[132px]" />
          ) : (
            <div className="w-full h-full min-h-[132px] flex items-center justify-center bg-gradient-to-br from-violet-100 to-fuchsia-50">
              <Hotel className="w-10 h-10 text-violet-300" />
            </div>
          )}
          <span className={cn('absolute top-2.5 left-2.5 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wide shadow-sm', badge.className)}>
            {badge.label}
          </span>
          {stars > 0 && (
            <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-md bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {stars.toFixed ? stars.toFixed(1) : stars}
            </span>
          )}
          {selected && (
            <span className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white shadow-md">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </span>
          )}
          {showDay && option._day?.day != null && (
            <span className="absolute bottom-2.5 right-2.5 rounded-md bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">
              Day {option._day.day}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 p-3.5 sm:p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[15px] font-bold text-slate-900 leading-snug">{option.name}</p>
            <p className="text-xs text-slate-500 inline-flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 shrink-0 text-violet-400" />
              <span className="truncate">
                {[option.tierName || 'Standard', option.location].filter(Boolean).join(' · ') || 'As per package'}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {amenities.length > 0 ? (
                amenities.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 capitalize"
                  >
                    {String(a).toLowerCase().includes('wifi') ? <Wifi className="w-3 h-3" /> : null}
                    {String(a).toLowerCase().includes('park') ? <ParkingSquare className="w-3 h-3" /> : null}
                    {String(a).replace(/_/g, ' ')}
                  </span>
                ))
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    <Wifi className="w-3 h-3" /> Wi‑Fi
                  </span>
                  {option.meals && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      <UtensilsCrossed className="w-3 h-3" />
                      {option.meals}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="sm:text-right shrink-0 space-y-2 sm:min-w-[148px]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {amount > 0 ? 'From' : 'Package'}
              </p>
              <p className="text-lg font-black text-violet-700 leading-none mt-0.5">
                {amount > 0 ? formatINR(amount) : 'Not included'}
              </p>
              {amount > 0 && (
                <p className="text-[10px] font-medium text-slate-400 mt-0.5">Per night</p>
              )}
              <p className={cn('text-sm font-black mt-1.5 leading-none', rel.tone)}>
                {selected ? 'Current hotel' : rel.primary}
              </p>
              <p className="text-[10px] font-medium text-slate-400 mt-1">
                {selected ? 'Your selection' : rel.hint}
              </p>
            </div>
            {!selected && (
              <span className={cn('inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold', rel.chip)}>
                vs current · {rel.primary}
              </span>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => onSelect(option)}
              className={cn(
                'w-full h-9 rounded-xl text-xs font-bold transition-colors disabled:opacity-60',
                selected
                  ? 'bg-violet-700 text-white'
                  : 'bg-violet-600 text-white hover:bg-violet-500 shadow-sm shadow-violet-600/25'
              )}
            >
              {loading && selected ? 'Loading…' : selected ? 'Selected' : 'Select Hotel'}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => onSelect(option)}
              className="w-full text-[11px] font-semibold text-violet-600 hover:text-violet-700"
            >
              Select Rooms →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomListRow({ room, hotel, selected, onSelect, basePrice = 0, defaultMealPlanKey = 'map' }) {
  const image = room.images?.[0] || hotel?.thumbnailUrl || hotel?.images?.[0] || hotel?.image;
  const preferred = pickPreferredMealPlan(ensureMealPlanOptions(room), room, defaultMealPlanKey);
  const price = mealPlanNightlyRate(preferred, room) || Number(room.pricePerNight || room.epPrice || 0);
  const rel = formatRelativePrice(price, basePrice, { isCurrent: false });
  const mealKey = normalizeMealPlanKey(preferred?.key || defaultMealPlanKey) || 'map';

  return (
    <button
      type="button"
      onClick={() => onSelect(room)}
      className={cn(
        'w-full text-left rounded-2xl border overflow-hidden transition-all',
        selected
          ? 'border-violet-400 ring-2 ring-violet-400/25 bg-violet-50/30'
          : 'border-slate-200 bg-white hover:border-violet-300'
      )}
    >
      <div className="flex gap-3 p-3">
        <div className="w-28 h-24 rounded-xl overflow-hidden bg-violet-50 shrink-0 flex items-center justify-center">
          {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <BedDouble className="w-7 h-7 text-violet-400" />}
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">{room.name}</p>
            {selected && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white shrink-0">
                <Check className="w-3 h-3" />
              </span>
            )}
          </div>
          {room.description && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{room.description}</p>}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {room.bedType && (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">{room.bedType}</span>
            )}
            {room.maxOccupancy && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                <Users className="w-3 h-3" /> Max {room.maxOccupancy}
              </span>
            )}
            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              {mealKey.toUpperCase()} default
            </span>
            {room.rates?.ep > 0 && (
              <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                EP {formatINR(room.rates.ep)}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-base font-black text-violet-700">
                {price > 0 ? formatINR(price) : 'Not included'}
                {price > 0 && (
                  <span className="text-[10px] font-medium text-slate-400"> / night {mealKey.toUpperCase()}</span>
                )}
              </p>
              <p className={cn('text-xs font-bold mt-0.5', rel.tone)}>{rel.primary}</p>
            </div>
            <span className={cn('inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold', rel.chip)}>
              vs current
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function MealPlanCard({ plan, room, nights, onSelect, basePrice = 0, selected = false }) {
  const perNight = mealPlanNightlyRate(plan, room);
  const total = perNight * Math.max(1, nights);
  const rel = formatRelativePrice(perNight, basePrice, { isCurrent: false });
  const hasSupplement = Number(plan.price || 0) > 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(plan)}
      className={cn(
        'w-full text-left rounded-2xl border bg-white p-4 transition-all',
        selected
          ? 'border-violet-500 ring-2 ring-violet-500/20 shadow-sm'
          : 'border-slate-200 hover:border-violet-300 hover:shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{plan.label}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {hasSupplement
              ? `+ ${formatINR(plan.price)} vs EP room-only`
              : Number(plan.absolutePrice || 0) > 0
                ? 'Room only rate'
                : 'No meal supplement'}
          </p>
        </div>
        {selected ? (
          <Check className="w-4 h-4 text-violet-600 shrink-0" />
        ) : (
          <UtensilsCrossed className="w-4 h-4 text-violet-400 shrink-0" />
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Per night</p>
          <p className="text-sm font-black text-violet-700">
            {formatINR(perNight, { zeroLabel: 'Not included' })}
          </p>
          <p className={cn('text-xs font-bold mt-0.5', rel.tone)}>{rel.primary}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {nights} night{nights !== 1 ? 's' : ''}
          </p>
          <p className="text-base font-black text-slate-900">
            {formatINR(total, { zeroLabel: 'Not included' })}
          </p>
          <span className={cn('inline-flex mt-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold', rel.chip)}>
            vs current
          </span>
        </div>
      </div>
    </button>
  );
}

function resolveCity(option, destination) {
  if (option?.city) return String(option.city).trim();
  if (option?.location) return String(option.location).split(',')[0].trim();
  if (destination) return String(destination).split(/→|->|,|\|/)[0].trim();
  return '';
}

async function fetchHotelDetailForOption(option, destination) {
  let city = resolveCity(option, destination);
  let slug = option.slug || option.hotel_slug || option.raw?.slug || option.raw?.hotel_slug || '';

  if (city && slug) {
    const res = await API.get('/uno-hotels/detail', {
      params: { city, slug },
      skipErrorToast: true,
    });
    return res.data;
  }

  const searchRes = await API.get('/uno-hotels', {
    params: {
      destination: city || destination || '',
      search: option.name,
      limit: 8,
    },
    skipErrorToast: true,
  });
  const items = searchRes.data?.items || [];
  const hit =
    items.find((h) => String(h.id) === String(option.id || option.hotelId)) ||
    items.find((h) => String(h.name).toLowerCase() === String(option.name || '').toLowerCase()) ||
    items[0];

  if (!hit?.city || !hit?.slug) throw new Error('Hotel catalog detail unavailable');

  const detailRes = await API.get('/uno-hotels/detail', {
    params: { city: hit.city, slug: hit.slug },
    skipErrorToast: true,
  });
  return detailRes.data;
}

function buildFallbackRooms(option) {
  if (option.rooms?.length) {
    return option.rooms.map((room, index) => {
      const mapped = {
        id: room.id || room._id || `${option.id || option.name}-room-${index}`,
        name: room.name || room.roomType || `Room ${index + 1}`,
        description: room.description || 'Hotel room option',
        pricePerNight: Number(room.pricePerNight ?? room.baseRate ?? room.price ?? 0),
        rates: room.rates || null,
        epPrice: Number(room.epPrice || room.pricePerNight || 0),
        images: room.images || option.images || (option.image ? [option.image] : []),
        bedType: room.bedType,
        maxOccupancy: room.maxOccupancy,
        fromPackage: true,
        mealPlanOptions: room.mealPlanOptions || [],
      };
      return { ...mapped, mealPlanOptions: ensureMealPlanOptions(mapped) };
    });
  }
  const fallback = {
    id: option.roomTypeId || `pkg-room-${option.id || option.name}`,
    name: option.tierName || 'Deluxe',
    description: 'Package room option',
    pricePerNight: Number(option.room?.rates?.map || option.absolutePerNight || 0),
    epPrice: Number(option.room?.epPrice || option.room?.rates?.ep || 0),
    rates: option.room?.rates || null,
    images: option.images || (option.image ? [option.image] : []),
    fromPackage: true,
    mealPlanOptions: option.room?.mealPlanOptions || [],
  };
  return [{ ...fallback, mealPlanOptions: ensureMealPlanOptions(fallback) }];
}

export default function PackageResourcePickerDrawer({
  open,
  onClose,
  mode = 'hotel',
  title,
  subtitle,
  options = [],
  selectedId,
  onSelect,
  showDayBadge = false,
  nights = 1,
  destination = '',
  basePrice = 0,
  /** Package API meal for this day (map/ep/…). Defaults picker + costing baseline. */
  defaultMealPlanKey = 'map',
}) {
  const [query, setQuery] = useState('');
  const [starFilter, setStarFilter] = useState(0); // 0 = all, 1-5 = star rating
  const [step, setStep] = useState('hotel');
  const [packageHotel, setPackageHotel] = useState(null);
  const [hotelDetail, setHotelDetail] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedMealPlan, setSelectedMealPlan] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');
  const isCab = mode === 'cab';
  const stayNights = Math.max(1, Number(nights) || 1);
  const locationLabel = resolveCity(options[0], destination) || destination || 'Destination';

  useEffect(() => {
    if (!open) {
      setQuery('');
      setStarFilter(0);
      setStep('hotel');
      setPackageHotel(null);
      setHotelDetail(null);
      setSelectedRoom(null);
      setSelectedMealPlan(null);
      setLoadingDetail(false);
      setDetailError('');
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((opt) => {
      if (starFilter > 0) {
        const stars = Number(opt.starRating || opt.starCategory || 0);
        if (Math.round(stars) !== starFilter) return false;
      }
      if (!q) return true;
      const hay = [opt.name, opt.location, opt.tierName, opt.meals, opt.seatingCapacity && `${opt.seatingCapacity} seats`]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [options, query, starFilter]);

  const rooms = (hotelDetail?.rooms?.length
    ? hotelDetail.rooms
    : packageHotel
      ? buildFallbackRooms(packageHotel)
      : []
  ).map((room) => ({ ...room, mealPlanOptions: ensureMealPlanOptions(room) }));

  const mealPlans = useMemo(
    () => (selectedRoom ? ensureMealPlanOptions(selectedRoom) : []),
    // Recompute when room identity / catalog meal options change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedRoom?.id, selectedRoom?.pricePerNight, selectedRoom?.mealPlanOptions]
  );

  const packageMealKey = normalizeMealPlanKey(defaultMealPlanKey) || 'map';

  const resolvedMealPlan = selectedRoom
    ? resolveSelectedMealPlan(selectedMealPlan, mealPlans, selectedRoom, packageMealKey)
    : null;

  const selectedMealNightly =
    selectedRoom && resolvedMealPlan
      ? mealPlanNightlyRate(resolvedMealPlan, selectedRoom)
      : 0;

  const packageMealOnRoom = selectedRoom
    ? pickPreferredMealPlan(mealPlans, selectedRoom, packageMealKey)
    : null;
  const packageMealNightly =
    selectedRoom && packageMealOnRoom
      ? mealPlanNightlyRate(packageMealOnRoom, selectedRoom)
      : 0;
  // Compare meal cards vs package-included meal rate (MAP), not EP / stale base.
  const mealCompareBase =
    packageMealNightly > 0 ? packageMealNightly : Number(basePrice || 0) || 0;

  const resetClose = () => {
    setQuery('');
    setStep('hotel');
    setPackageHotel(null);
    setHotelDetail(null);
    setSelectedRoom(null);
    setSelectedMealPlan(null);
    setDetailError('');
    onClose?.();
  };

  const selectHotelOption = async (option) => {
    setPackageHotel(option);
    setSelectedRoom(null);
    setSelectedMealPlan(null);
    setHotelDetail(null);
    setDetailError('');
    setLoadingDetail(true);
    setStep('room');
    try {
      const detail = await fetchHotelDetailForOption(option, destination);
      setHotelDetail(detail);
      const roomList = (detail?.rooms?.length ? detail.rooms : buildFallbackRooms(option)).map(
        (room) => ({ ...room, mealPlanOptions: ensureMealPlanOptions(room) })
      );
      const defaultRoom = pickDefaultPackageRoom(roomList, {
        tierName: option.tierName,
        roomTypeId: option.roomTypeId,
      });
      if (defaultRoom) {
        setSelectedRoom(defaultRoom);
        setSelectedMealPlan(
          pickPreferredMealPlan(defaultRoom.mealPlanOptions, defaultRoom, packageMealKey)
        );
      }
    } catch {
      setHotelDetail({
        ...option,
        name: option.name,
        image: option.image,
        images: option.images || [],
        thumbnailUrl: option.image,
        rooms: buildFallbackRooms(option),
      });
      setDetailError('Showing package room options (catalog rooms unavailable)');
    } finally {
      setLoadingDetail(false);
    }
  };

  const selectMealPlan = (plan, roomOverride = null) => {
    const room = roomOverride || selectedRoom;
    if (!packageHotel || !room || !plan) return;
    const plans = ensureMealPlanOptions(room);
    // Always apply the priced list entry (never a zero/EP stub with same key).
    const applied = resolveSelectedMealPlan(plan, plans, room, packageMealKey) || plan;
    const absolutePerNight = mealPlanNightlyRate(applied, room);
    const packageMealPlan = pickPreferredMealPlan(plans, room, packageMealKey);
    const packageMealAbs = mealPlanNightlyRate(packageMealPlan, room);
    const hotelDelta =
      Number(packageHotel.priceDelta ?? packageHotel.upgrade_price ?? packageHotel.perNight ?? 0) || 0;
    const mealDelta =
      packageMealAbs > 0
        ? Math.round((absolutePerNight - packageMealAbs) * 100) / 100
        : 0;
    const costDeltaPerNight = Math.round((hotelDelta + mealDelta) * 100) / 100;
    const totalCost = costDeltaPerNight;
    const catalogHotel = hotelDetail || packageHotel;
    const includedRate =
      packageMealAbs > 0
        ? packageMealAbs
        : Number(basePrice || 0) > 0
          ? Number(basePrice)
          : Number(packageHotel.startingPrice || packageHotel.absolutePerNight || 0) || 0;
    const epRate = Number(room.epPrice || room.rates?.ep || room.pricePerNight || 0) || 0;
    const mealKey = normalizeMealPlanKey(applied.key || applied.label) || packageMealKey;

    onSelect?.({
      ...packageHotel,
      name: catalogHotel.name || packageHotel.name,
      image: catalogHotel.thumbnailUrl || catalogHotel.image || packageHotel.image || '',
      images: catalogHotel.images?.length ? catalogHotel.images : packageHotel.images || [],
      starRating: catalogHotel.starCategory || catalogHotel.starRating || packageHotel.starRating || 0,
      location: catalogHotel.location || packageHotel.location || '',
      city: catalogHotel.city || packageHotel.city || '',
      slug: catalogHotel.slug || packageHotel.slug || '',
      startingPrice: absolutePerNight || packageHotel.startingPrice || catalogHotel.startingPrice || 0,
      tierName: room.name,
      meals: applied.label,
      mealPlanKey: mealKey,
      priceDelta: costDeltaPerNight,
      room: {
        id: room.id,
        name: room.name,
        // Selected meal rack — never leave EP here while mealPlan says MAP.
        pricePerNight: absolutePerNight || Number(room.pricePerNight || 0),
        epPrice: epRate,
        rates: room.rates || null,
        bedType: room.bedType,
        maxOccupancy: room.maxOccupancy,
        mealPlanOptions: plans,
      },
      mealPlan: {
        key: mealKey,
        label: applied.label,
        price: Number(applied.price || 0),
        absolutePrice: absolutePerNight,
      },
      perNight: costDeltaPerNight,
      absolutePerNight,
      includedRate,
      totalCost,
      nights: 1,
    });
  };

  const selectRoom = (room) => {
    const normalized = { ...room, mealPlanOptions: ensureMealPlanOptions(room) };
    setSelectedRoom(normalized);
    const preferred = pickPreferredMealPlan(
      normalized.mealPlanOptions,
      normalized,
      packageMealKey
    );
    setSelectedMealPlan(preferred);
    setStep('meal');
  };

  const continueDisabled =
    (step === 'hotel' && !packageHotel) ||
    (step === 'room' && !selectedRoom) ||
    (step === 'meal' && !resolvedMealPlan) ||
    loadingDetail;

  const handleContinue = () => {
    if (step === 'hotel' && packageHotel) {
      selectHotelOption(packageHotel);
      return;
    }
    if (step === 'room' && selectedRoom) {
      selectRoom(selectedRoom);
      return;
    }
    if (step === 'meal' && resolvedMealPlan) {
      selectMealPlan(resolvedMealPlan);
    }
  };

  const footerPrimaryLabel =
    step === 'hotel'
      ? 'Continue to Rooms →'
      : step === 'room'
        ? 'Continue to Meal Plan →'
        : `Confirm · ${resolvedMealPlan?.label || 'MAP'} · ${
            selectedMealNightly > 0 ? formatINR(selectedMealNightly) : 'MAP'
          }`;

  return (
    <AppDrawer
      open={open}
      onClose={resetClose}
      className={cn(
        'bg-white border-slate-200/80 shadow-2xl shadow-slate-900/30',
        isCab ? 'max-w-lg w-full' : 'w-full max-w-none sm:w-1/2 sm:max-w-[50vw]'
      )}
    >
      {isCab ? (
        <>
          <div className="shrink-0 border-b border-emerald-100 bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-700 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">Transport</p>
                <h2 className="text-lg font-bold text-white">{title || 'Choose your cab'}</h2>
                <p className="text-xs text-white/75 mt-1">{subtitle || 'Private transfer options'}</p>
              </div>
              <button type="button" onClick={resetClose} className="h-9 w-9 rounded-xl bg-white/10 text-white border border-white/15 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cabs…"
                className="w-full h-10 rounded-xl border border-white/20 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/45 outline-none"
              />
            </div>
            <p className="mt-2 text-[11px] text-white/75">
              +extra / −savings vs current cab
              {Number(basePrice) > 0 ? ` (${formatINR(basePrice)})` : ''}
            </p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
            {filtered.map((cab) => {
              const id = cab.id || cab.packageCabId || cab.name;
              return (
                <CabOptionCard
                  key={id}
                  cab={cab}
                  selected={selectedId != null && selectedId === id}
                  onSelect={onSelect}
                  basePrice={basePrice}
                />
              );
            })}
          </div>
        </>
      ) : (
        <>
          <HotelStepHeader step={step} onClose={resetClose} title={title || 'Change Hotel'} />

          <div className="flex-1 min-h-0 overflow-y-auto bg-[#F7F6FB]">
            <AnimatePresence mode="wait">
              {step === 'hotel' && (
                <motion.div
                  key="hotel"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="p-4 space-y-3"
                >
                  {/* Search / filter toolbar */}
                  <div className="rounded-2xl border border-violet-100 bg-white p-3 shadow-sm space-y-2.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search hotels by name or location…"
                        className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-500/15"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-violet-500" />
                        {locationLabel}
                      </span>
                      {[0, 1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setStarFilter(star)}
                          className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                            starFilter === star
                              ? 'border-violet-300 bg-violet-50 text-violet-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200'
                          }`}
                        >
                          {star === 0 ? 'All' : `${star}★`}
                        </button>
                      ))}
                      <span className="ml-auto text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        {filtered.length} hotel{filtered.length === 1 ? '' : 's'} found
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Prices show <span className="font-bold text-rose-600">+extra</span> or{' '}
                      <span className="font-bold text-emerald-600">−savings</span> vs your current hotel
                      {Number(basePrice) > 0 ? ` (${formatINR(basePrice)}/night)` : ''}.
                    </p>
                  </div>

                  {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-14 text-center">
                      <Hotel className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-sm font-semibold text-slate-800">No hotels match</p>
                      <p className="text-xs text-slate-500 mt-1">Try a different search.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filtered.map((opt, index) => {
                        const id = `${opt.id || opt.hotelId || opt.name}-${opt._day?.day ?? ''}`;
                        const selKey = opt.id || opt.hotelId || opt.name;
                        const selected = packageHotel
                          ? (packageHotel.id || packageHotel.name) === (opt.id || opt.name)
                          : selectedId != null && selectedId === selKey;
                        return (
                          <HotelListRow
                            key={id}
                            option={opt}
                            index={index}
                            selected={selected}
                            loading={loadingDetail && selected}
                            onSelect={selectHotelOption}
                            showDay={showDayBadge}
                            basePrice={basePrice}
                          />
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {step === 'room' && (
                <motion.div
                  key="room"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="p-4 space-y-3"
                >
                  <button
                    type="button"
                    onClick={() => setStep('hotel')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to hotels
                  </button>

                  {packageHotel && (
                    <div className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50 p-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0 flex items-center justify-center">
                        {(hotelDetail?.thumbnailUrl || packageHotel.image) ? (
                          <img src={hotelDetail?.thumbnailUrl || packageHotel.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Hotel className="w-5 h-5 text-violet-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">Selected hotel</p>
                        <p className="text-sm font-bold text-slate-900 truncate">{hotelDetail?.name || packageHotel.name}</p>
                      </div>
                    </div>
                  )}

                  {detailError && (
                    <p className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                      {detailError}
                    </p>
                  )}

                  {loadingDetail ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                      <p className="text-sm font-medium">Loading rooms & prices…</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 px-0.5">
                        {rooms.length} room type{rooms.length === 1 ? '' : 's'}
                      </p>
                      {rooms.map((room) => (
                        <RoomListRow
                          key={room.id || room.name}
                          room={room}
                          hotel={hotelDetail || packageHotel}
                          selected={selectedRoom?.id === room.id}
                          onSelect={selectRoom}
                          basePrice={basePrice}
                          defaultMealPlanKey={packageMealKey}
                        />
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {step === 'meal' && selectedRoom && (
                <motion.div
                  key="meal"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  className="p-4 space-y-3"
                >
                  <button
                    type="button"
                    onClick={() => setStep('room')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to rooms
                  </button>

                  <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Selected room</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{selectedRoom.name}</p>
                      <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                        {resolvedMealPlan?.label || 'MAP — Breakfast + Dinner'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-violet-700">
                        {formatINR(selectedMealNightly || 0, { zeroLabel: 'Not included' })}
                        {selectedMealNightly > 0 && (
                          <span className="text-[10px] font-medium text-slate-400"> /night</span>
                        )}
                      </p>
                      {Number(selectedRoom.epPrice || selectedRoom.rates?.ep || 0) > 0 &&
                        selectedMealNightly >
                          Number(selectedRoom.epPrice || selectedRoom.rates?.ep || 0) && (
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                          EP {formatINR(selectedRoom.epPrice || selectedRoom.rates?.ep)}
                        </p>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 px-0.5">
                    Meal plans · package default {packageMealKey.toUpperCase()} · tap a plan to apply ·{' '}
                    {stayNights} night{stayNights !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-3">
                    {mealPlans.map((plan) => (
                      <MealPlanCard
                        key={plan.key || plan.label}
                        plan={plan}
                        room={selectedRoom}
                        nights={stayNights}
                        selected={
                          normalizeMealPlanKey(resolvedMealPlan?.key || resolvedMealPlan?.label) ===
                          normalizeMealPlanKey(plan.key || plan.label)
                        }
                        onSelect={(nextPlan) => {
                          const priced = resolveSelectedMealPlan(
                            nextPlan,
                            mealPlans,
                            selectedRoom,
                            packageMealKey
                          );
                          setSelectedMealPlan(priced || nextPlan);
                          selectMealPlan(priced || nextPlan);
                        }}
                        basePrice={mealCompareBase}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer — mockup style */}
          <div className="shrink-0 border-t border-violet-100 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-emerald-700">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Best Price Guarantee
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={resetClose}
                className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={continueDisabled}
                onClick={handleContinue}
                className="h-10 px-4 rounded-xl bg-violet-600 text-white text-sm font-bold shadow-md shadow-violet-600/25 hover:bg-violet-500 disabled:opacity-45 disabled:pointer-events-none"
              >
                {footerPrimaryLabel}
              </button>
            </div>
          </div>
        </>
      )}
    </AppDrawer>
  );
}
