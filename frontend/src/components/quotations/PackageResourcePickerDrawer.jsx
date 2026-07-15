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
  Sparkles,
  UtensilsCrossed,
  ArrowLeft,
  BedDouble,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppDrawer from '../ui/AppDrawer';
import API from '../../api/axios';
import { formatINR } from './quotationUtils';
import { cn } from '../../lib/utils';

const HOTEL_STEPS = [
  { key: 'hotel', label: 'Hotel' },
  { key: 'room', label: 'Room' },
  { key: 'meal', label: 'Meal Plan' },
];

const FALLBACK_MEAL_PLANS = [
  { key: 'ep', label: 'EP (Room Only)', price: 0, meals: [] },
  { key: 'cp', label: 'CP — Breakfast', price: 0, meals: ['breakfast'] },
  { key: 'map', label: 'MAP — Breakfast + Dinner', price: 0, meals: ['breakfast', 'dinner'] },
  { key: 'ap', label: 'AP — All Meals', price: 0, meals: ['breakfast', 'lunch', 'dinner'] },
];

function Stars({ count = 0 }) {
  const n = Math.min(5, Math.max(0, Math.round(Number(count) || 0)));
  if (!n) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: n }).map((_, i) => (
        <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
      ))}
    </span>
  );
}

function StepBar({ step }) {
  const idx = HOTEL_STEPS.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white/10 border border-white/15 p-1">
      {HOTEL_STEPS.map((s, i) => {
        const active = s.key === step;
        const done = i < idx;
        return (
          <div key={s.key} className="flex items-center flex-1 min-w-0">
            <div
              className={cn(
                'flex-1 rounded-lg px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide transition-colors',
                active && 'bg-white text-violet-700 shadow-sm',
                done && !active && 'text-white/90',
                !done && !active && 'text-white/45'
              )}
            >
              {done ? '✓ ' : `${i + 1}. `}
              {s.label}
            </div>
            {i < HOTEL_STEPS.length - 1 && (
              <ChevronRight className="w-3 h-3 text-white/35 shrink-0 mx-0.5" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CabOptionCard({ cab, selected, onSelect }) {
  const image = cab.featuredImage || cab.image;
  const price = Number(cab.cost || cab.priceDelta || 0);

  return (
    <motion.button
      type="button"
      layout
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => onSelect(cab)}
      className={cn(
        'group relative w-full text-left rounded-2xl border overflow-hidden transition-all duration-200',
        selected
          ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-white shadow-lg shadow-emerald-500/15 ring-2 ring-emerald-400/30'
          : 'border-slate-200/90 bg-white hover:border-emerald-300 hover:shadow-md hover:shadow-slate-200/80'
      )}
    >
      <div className="flex gap-3 p-3.5">
        <div className="relative w-24 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-sky-100 to-emerald-50 shrink-0">
          {image ? (
            <img src={image} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Car className="w-7 h-7 text-emerald-500/70" />
            </div>
          )}
          {cab.isDefault && (
            <span className="absolute top-1.5 left-1.5 rounded-md bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
              Default
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{cab.name}</p>
            <span
              className={cn(
                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                selected
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-slate-300 bg-white text-transparent group-hover:border-emerald-300'
              )}
            >
              <Check className="w-3 h-3" />
            </span>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {cab.seatingCapacity ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                <Users className="w-3 h-3" />
                {cab.seatingCapacity} seats
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
              AC Vehicle
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            {price > 0 ? (
              <p className="text-sm font-bold text-emerald-600">+{formatINR(price)}</p>
            ) : (
              <p className="text-[11px] font-semibold text-slate-400">Included in package</p>
            )}
            {selected && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Selected</span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function HotelOptionCard({ option, selected, onSelect, showDay, loading }) {
  const image = option.image || option.images?.[0];
  const price = Number(option.priceDelta || 0);
  const stars = Number(option.starRating || 0);

  return (
    <motion.button
      type="button"
      layout
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      disabled={loading}
      onClick={() => onSelect(option)}
      className={cn(
        'group relative w-full text-left rounded-2xl border overflow-hidden transition-all duration-200 disabled:opacity-70',
        selected
          ? 'border-violet-400 bg-gradient-to-br from-violet-50 to-white shadow-lg shadow-violet-500/15 ring-2 ring-violet-400/30'
          : 'border-slate-200/90 bg-white hover:border-violet-300 hover:shadow-md hover:shadow-slate-200/80'
      )}
    >
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-violet-100 via-fuchsia-50 to-sky-50">
        {image ? (
          <img
            src={image}
            alt=""
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Hotel className="w-10 h-10 text-violet-400/70" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-slate-950/5 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
          {showDay && option._day?.day != null && (
            <span className="rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold text-violet-700 shadow-sm">
              Day {option._day.day}
            </span>
          )}
          {stars > 0 && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-slate-950/55 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
              <Stars count={stars} />
              <span className="text-white/90">{stars}★</span>
            </span>
          )}
        </div>
        {(selected || loading) && (
          <span className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white shadow-md">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </span>
        )}
      </div>

      <div className="p-3.5 space-y-2">
        <div>
          <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{option.name}</p>
          {(option.location || option.tierName) && (
            <p className="mt-1 text-[11px] text-slate-500 inline-flex items-center gap-1 min-w-0">
              {option.location ? <MapPin className="w-3 h-3 shrink-0 text-violet-400" /> : null}
              <span className="truncate">
                {[option.tierName, option.location].filter(Boolean).join(' · ')}
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {price > 0 ? (
            <p className="text-sm font-bold text-emerald-600">from +{formatINR(price)}</p>
          ) : (
            <p className="text-[11px] font-semibold text-slate-400">Package rate</p>
          )}
          <span className="text-[10px] font-semibold text-violet-600 group-hover:underline">
            Select → Rooms
          </span>
        </div>
      </div>
    </motion.button>
  );
}

function RoomPickCard({ room, hotel, selected, onSelect }) {
  const image = room.images?.[0] || hotel?.thumbnailUrl || hotel?.images?.[0] || hotel?.image;
  const price = Number(room.pricePerNight || 0);

  return (
    <button
      type="button"
      onClick={() => onSelect(room)}
      className={cn(
        'w-full text-left rounded-2xl border overflow-hidden transition-all',
        selected
          ? 'border-violet-400 ring-2 ring-violet-400/25 bg-violet-50/40 shadow-md'
          : 'border-slate-200 bg-white hover:border-violet-300 hover:shadow-sm'
      )}
    >
      <div className="flex gap-3 p-3">
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-violet-50 shrink-0 flex items-center justify-center">
          {image ? (
            <img src={image} alt="" className="w-full h-full object-cover" />
          ) : (
            <BedDouble className="w-7 h-7 text-violet-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-slate-900 leading-snug">{room.name}</p>
            {selected && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-white shrink-0">
                <Check className="w-3 h-3" />
              </span>
            )}
          </div>
          {room.description && (
            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{room.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {room.bedType && (
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                {room.bedType}
              </span>
            )}
            {room.maxOccupancy && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                <Users className="w-3 h-3" /> Max {room.maxOccupancy}
              </span>
            )}
          </div>
          <p className="mt-2 text-base font-bold text-violet-700">
            {price > 0 ? formatINR(price) : 'Package rate'}
            {price > 0 && <span className="text-[11px] font-medium text-slate-400"> / night</span>}
          </p>
        </div>
      </div>
    </button>
  );
}

function MealPlanCard({ plan, roomPrice, nights, selected, onSelect }) {
  const perNight = Number(roomPrice || 0) + Number(plan.price || 0);
  const total = perNight * Math.max(1, nights);

  return (
    <button
      type="button"
      onClick={() => onSelect(plan)}
      className={cn(
        'w-full text-left rounded-2xl border p-4 transition-all',
        selected
          ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-white ring-2 ring-emerald-400/25 shadow-md'
          : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">{plan.label}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {Number(plan.price) > 0
              ? `+ ${formatINR(plan.price)} meal supplement / night`
              : 'No meal supplement'}
          </p>
        </div>
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
            selected ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300'
          )}
        >
          {selected && <Check className="w-3 h-3" />}
        </span>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Per night</p>
          <p className="text-sm font-bold text-slate-900">{formatINR(perNight)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {nights} night{nights !== 1 ? 's' : ''}
          </p>
          <p className="text-base font-bold text-emerald-600">{formatINR(total)}</p>
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
  let slug = option.slug || option.raw?.slug || '';

  if (city && slug) {
    const res = await API.get('/uno-hotels/detail', {
      params: { city, slug },
      skipErrorToast: true,
    });
    return res.data;
  }

  const searchCity = city || destination || '';
  const searchRes = await API.get('/uno-hotels', {
    params: {
      destination: searchCity || destination || '',
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

  if (!hit?.city || !hit?.slug) {
    throw new Error('Hotel catalog detail unavailable');
  }

  const detailRes = await API.get('/uno-hotels/detail', {
    params: { city: hit.city, slug: hit.slug },
    skipErrorToast: true,
  });
  return detailRes.data;
}

function buildFallbackRooms(option) {
  return [
    {
      id: option.roomTypeId || `pkg-room-${option.id || option.name}`,
      name: option.tierName || 'Standard Room',
      description: 'Package room option',
      pricePerNight: Number(option.priceDelta || 0),
      mealPlanOptions: FALLBACK_MEAL_PLANS.map((p) =>
        option.meals && p.label.toLowerCase().includes(String(option.meals).toLowerCase().slice(0, 4))
          ? { ...p, price: 0 }
          : p
      ),
      images: option.images || (option.image ? [option.image] : []),
      fromPackage: true,
    },
  ];
}

/**
 * Right-side picker for package cabs or hotels (hotel → room → meal plan).
 */
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
}) {
  const [query, setQuery] = useState('');
  const [step, setStep] = useState('hotel');
  const [packageHotel, setPackageHotel] = useState(null);
  const [hotelDetail, setHotelDetail] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');
  const isCab = mode === 'cab';
  const stayNights = Math.max(1, Number(nights) || 1);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setStep('hotel');
      setPackageHotel(null);
      setHotelDetail(null);
      setSelectedRoom(null);
      setLoadingDetail(false);
      setDetailError('');
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const hay = [
        opt.name,
        opt.location,
        opt.tierName,
        opt.meals,
        opt.seatingCapacity && `${opt.seatingCapacity} seats`,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  const rooms = hotelDetail?.rooms?.length
    ? hotelDetail.rooms
    : packageHotel
      ? buildFallbackRooms(packageHotel)
      : [];

  const mealPlans =
    selectedRoom?.mealPlanOptions?.length > 0
      ? selectedRoom.mealPlanOptions
      : FALLBACK_MEAL_PLANS;

  const resetClose = () => {
    setQuery('');
    setStep('hotel');
    setPackageHotel(null);
    setHotelDetail(null);
    setSelectedRoom(null);
    setDetailError('');
    onClose?.();
  };

  const selectHotelOption = async (option) => {
    setPackageHotel(option);
    setSelectedRoom(null);
    setHotelDetail(null);
    setDetailError('');
    setLoadingDetail(true);
    setStep('room');
    try {
      const detail = await fetchHotelDetailForOption(option, destination);
      setHotelDetail(detail);
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

  const selectRoom = (room) => {
    setSelectedRoom(room);
    setStep('meal');
  };

  const selectMealPlan = (plan) => {
    if (!packageHotel || !selectedRoom) return;
    const perNight = Number(selectedRoom.pricePerNight || 0) + Number(plan.price || 0);
    const totalCost = perNight * stayNights;
    const catalogHotel = hotelDetail || packageHotel;

    onSelect?.({
      ...packageHotel,
      name: catalogHotel.name || packageHotel.name,
      image: catalogHotel.thumbnailUrl || catalogHotel.image || packageHotel.image || '',
      images: catalogHotel.images?.length ? catalogHotel.images : packageHotel.images || [],
      starRating: catalogHotel.starCategory || catalogHotel.starRating || packageHotel.starRating || 0,
      location: catalogHotel.location || packageHotel.location || '',
      city: catalogHotel.city || packageHotel.city || '',
      slug: catalogHotel.slug || packageHotel.slug || '',
      tierName: selectedRoom.name,
      meals: plan.label,
      priceDelta: perNight,
      room: {
        id: selectedRoom.id,
        name: selectedRoom.name,
        pricePerNight: Number(selectedRoom.pricePerNight || 0),
        bedType: selectedRoom.bedType,
        maxOccupancy: selectedRoom.maxOccupancy,
      },
      mealPlan: {
        key: plan.key,
        label: plan.label,
        price: Number(plan.price || 0),
      },
      perNight,
      totalCost,
      nights: stayNights,
    });
  };

  const heading =
    title || (isCab ? 'Choose your cab' : step === 'hotel' ? 'Choose your hotel' : step === 'room' ? 'Choose your room' : 'Choose meal plan');
  const sub =
    subtitle ||
    (isCab
      ? 'Pick the private transfer that fits your guest'
      : step === 'hotel'
        ? 'Select a hotel, then pick room & meal plan'
        : step === 'room'
          ? `${rooms.length || 0} room type${rooms.length === 1 ? '' : 's'} · prices per night`
          : `Meal plans with totals for ${stayNights} night${stayNights !== 1 ? 's' : ''}`);

  return (
    <AppDrawer
      open={open}
      onClose={resetClose}
      className="max-w-[560px] bg-white border-slate-200/80 shadow-2xl shadow-slate-900/25"
    >
      {/* Hero header */}
      <div
        className={cn(
          'relative shrink-0 overflow-hidden border-b',
          isCab
            ? 'border-emerald-100 bg-gradient-to-br from-emerald-600 via-teal-600 to-sky-700'
            : 'border-violet-100 bg-gradient-to-br from-violet-600 via-fuchsia-600 to-indigo-700'
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35) 0%, transparent 45%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.2) 0%, transparent 40%)',
          }}
        />
        <div className="relative px-5 pt-5 pb-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur border border-white/20 shadow-inner">
                {isCab ? (
                  <Car className="w-5 h-5" />
                ) : step === 'meal' ? (
                  <UtensilsCrossed className="w-5 h-5" />
                ) : step === 'room' ? (
                  <BedDouble className="w-5 h-5" />
                ) : (
                  <Hotel className="w-5 h-5" />
                )}
              </span>
              <div className="min-w-0">
                <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
                  <Sparkles className="w-3 h-3" />
                  {isCab ? 'Transport' : 'Stay'}
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-white leading-tight">{heading}</h2>
                <p className="mt-1 text-xs text-white/75 leading-relaxed">{sub}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={resetClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white border border-white/15 hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!isCab && <StepBar step={step} />}

          {step === 'hotel' && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isCab ? 'Search cabs…' : 'Search hotels…'}
                className="w-full h-10 rounded-xl border border-white/20 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/45 outline-none focus:bg-white/15 focus:ring-2 focus:ring-white/25"
              />
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_48%)]">
        {isCab ? (
          <>
            <div className="flex items-center justify-between px-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {filtered.length} option{filtered.length === 1 ? '' : 's'}
              </p>
            </div>
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
                <p className="text-sm font-semibold text-slate-800">No matches</p>
              </div>
            ) : (
              filtered.map((cab) => {
                const id = cab.id || cab.packageCabId || cab.name;
                return (
                  <CabOptionCard
                    key={id}
                    cab={cab}
                    selected={selectedId != null && selectedId === id}
                    onSelect={onSelect}
                  />
                );
              })
            )}
          </>
        ) : (
          <AnimatePresence mode="wait">
            {step === 'hotel' && (
              <motion.div
                key="hotel-step"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between px-0.5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {filtered.length} hotel{filtered.length === 1 ? '' : 's'}
                  </p>
                  {query && (
                    <button type="button" onClick={() => setQuery('')} className="text-[11px] font-semibold text-slate-500">
                      Clear search
                    </button>
                  )}
                </div>
                {filtered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-800">No matches</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filtered.map((opt) => {
                      const id = `${opt.id || opt.hotelId || opt.name}-${opt._day?.day ?? ''}`;
                      const selKey = opt.id || opt.hotelId || opt.name;
                      const selected = packageHotel
                        ? (packageHotel.id || packageHotel.name) === (opt.id || opt.name)
                        : selectedId != null && selectedId === selKey;
                      return (
                        <HotelOptionCard
                          key={id}
                          option={opt}
                          selected={selected}
                          loading={loadingDetail && selected}
                          onSelect={selectHotelOption}
                          showDay={showDayBadge}
                        />
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {step === 'room' && (
              <motion.div
                key="room-step"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="space-y-3"
              >
                <button
                  type="button"
                  onClick={() => setStep('hotel')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to hotels
                </button>

                {packageHotel && (
                  <div className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white shrink-0 flex items-center justify-center">
                      {packageHotel.image || hotelDetail?.thumbnailUrl ? (
                        <img
                          src={hotelDetail?.thumbnailUrl || packageHotel.image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Hotel className="w-5 h-5 text-violet-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">Hotel</p>
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {hotelDetail?.name || packageHotel.name}
                      </p>
                    </div>
                  </div>
                )}

                {detailError && (
                  <p className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    {detailError}
                  </p>
                )}

                {loadingDetail ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                    <p className="text-sm font-medium">Loading rooms & prices…</p>
                  </div>
                ) : rooms.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
                    <BedDouble className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-800">No rooms found</p>
                  </div>
                ) : (
                  rooms.map((room) => (
                    <RoomPickCard
                      key={room.id || room.name}
                      room={room}
                      hotel={hotelDetail || packageHotel}
                      selected={false}
                      onSelect={selectRoom}
                    />
                  ))
                )}
              </motion.div>
            )}

            {step === 'meal' && selectedRoom && (
              <motion.div
                key="meal-step"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="space-y-3"
              >
                <button
                  type="button"
                  onClick={() => setStep('room')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to rooms
                </button>

                <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Selected room</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{selectedRoom.name}</p>
                  </div>
                  <p className="text-sm font-bold text-violet-700 shrink-0">
                    {formatINR(selectedRoom.pricePerNight || 0)}
                    <span className="text-[10px] font-medium text-slate-400"> /night</span>
                  </p>
                </div>

                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 px-0.5">
                  Meal plans · totals for {stayNights} night{stayNights !== 1 ? 's' : ''}
                </p>

                {mealPlans.map((plan) => (
                  <MealPlanCard
                    key={plan.key || plan.label}
                    plan={plan}
                    roomPrice={selectedRoom.pricePerNight}
                    nights={stayNights}
                    selected={false}
                    onSelect={selectMealPlan}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-3">
        <p className="text-[11px] text-slate-500 text-center">
          {isCab
            ? 'Selection updates your quotation instantly'
            : step === 'meal'
              ? 'Pick a meal plan to apply hotel + room + price'
              : 'Hotel → Room → Meal plan with live pricing'}
        </p>
      </div>
    </AppDrawer>
  );
}
