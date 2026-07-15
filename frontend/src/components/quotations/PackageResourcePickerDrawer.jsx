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
  SlidersHorizontal,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AppDrawer from '../ui/AppDrawer';
import API from '../../api/axios';
import { formatINR } from './quotationUtils';
import { cn } from '../../lib/utils';

const HOTEL_STEPS = [
  { key: 'hotel', label: 'Hotel', hint: 'Select your hotel' },
  { key: 'room', label: 'Room', hint: 'Choose room type' },
  { key: 'meal', label: 'Meal Plan', hint: 'Select meal plan' },
];

const FALLBACK_MEAL_PLANS = [
  { key: 'ep', label: 'EP (Room Only)', price: 0, meals: [] },
  { key: 'cp', label: 'CP — Breakfast', price: 0, meals: ['breakfast'] },
  { key: 'map', label: 'MAP — Breakfast + Dinner', price: 0, meals: ['breakfast', 'dinner'] },
  { key: 'ap', label: 'AP — All Meals', price: 0, meals: ['breakfast', 'lunch', 'dinner'] },
];

const BADGE_STYLES = [
  { key: 'best', label: 'BEST SELLER', className: 'bg-rose-500 text-white' },
  { key: 'popular', label: 'POPULAR', className: 'bg-violet-600 text-white' },
  { key: 'premium', label: 'PREMIUM', className: 'bg-amber-500 text-white' },
  { key: 'value', label: 'VALUE', className: 'bg-emerald-600 text-white' },
];

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

function CabOptionCard({ cab, selected, onSelect }) {
  const image = cab.featuredImage || cab.image;
  const price = Number(cab.cost || cab.priceDelta || 0);

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
          <p className="mt-2 text-sm font-bold text-emerald-600">
            {price > 0 ? `+${formatINR(price)}` : 'Included in package'}
          </p>
        </div>
      </div>
    </button>
  );
}

/** Horizontal list-row hotel card (mockup style, stacked vertically). */
function HotelListRow({ option, selected, loading, onSelect, showDay, index }) {
  const image = option.image || option.images?.[0];
  const price = Number(option.priceDelta || 0);
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

          <div className="sm:text-right shrink-0 space-y-2 sm:min-w-[140px]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Package rate</p>
              <p className="text-lg font-black text-violet-700 leading-none mt-0.5">
                {price > 0 ? formatINR(price) : 'Included'}
              </p>
              {price > 0 && <p className="text-[10px] font-medium text-slate-400 mt-0.5">Per Night</p>}
            </div>
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

function RoomListRow({ room, hotel, selected, onSelect }) {
  const image = room.images?.[0] || hotel?.thumbnailUrl || hotel?.images?.[0] || hotel?.image;
  const price = Number(room.pricePerNight || 0);

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
          </div>
          <p className="mt-2 text-base font-black text-violet-700">
            {price > 0 ? formatINR(price) : 'Package rate'}
            {price > 0 && <span className="text-[10px] font-medium text-slate-400"> / night</span>}
          </p>
        </div>
      </div>
    </button>
  );
}

function MealPlanCard({ plan, roomPrice, nights, onSelect }) {
  const perNight = Number(roomPrice || 0) + Number(plan.price || 0);
  const total = perNight * Math.max(1, nights);

  return (
    <button
      type="button"
      onClick={() => onSelect(plan)}
      className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-violet-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{plan.label}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            {Number(plan.price) > 0 ? `+ ${formatINR(plan.price)} meal / night` : 'No meal supplement'}
          </p>
        </div>
        <UtensilsCrossed className="w-4 h-4 text-violet-400 shrink-0" />
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Per night</p>
          <p className="text-sm font-bold text-slate-900">{formatINR(perNight)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
            {nights} night{nights !== 1 ? 's' : ''}
          </p>
          <p className="text-base font-black text-violet-700">{formatINR(total)}</p>
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
  return [
    {
      id: option.roomTypeId || `pkg-room-${option.id || option.name}`,
      name: option.tierName || 'Standard Room',
      description: 'Package room option',
      pricePerNight: Number(option.priceDelta || 0),
      mealPlanOptions: FALLBACK_MEAL_PLANS,
      images: option.images || (option.image ? [option.image] : []),
      fromPackage: true,
    },
  ];
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
  const locationLabel = resolveCity(options[0], destination) || destination || 'Destination';

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
      const hay = [opt.name, opt.location, opt.tierName, opt.meals, opt.seatingCapacity && `${opt.seatingCapacity} seats`]
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
    selectedRoom?.mealPlanOptions?.length > 0 ? selectedRoom.mealPlanOptions : FALLBACK_MEAL_PLANS;

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
      mealPlan: { key: plan.key, label: plan.label, price: Number(plan.price || 0) },
      perNight,
      totalCost,
      nights: stayNights,
    });
  };

  const continueDisabled =
    (step === 'hotel' && !packageHotel) ||
    (step === 'room' && !selectedRoom) ||
    loadingDetail;

  const handleContinue = () => {
    if (step === 'hotel' && packageHotel) {
      selectHotelOption(packageHotel);
      return;
    }
    if (step === 'room' && selectedRoom) {
      setStep('meal');
    }
  };

  const footerPrimaryLabel =
    step === 'hotel' ? 'Continue to Rooms →' : step === 'room' ? 'Continue to Meal Plan →' : 'Confirm stay';

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
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </span>
                      <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-violet-200 bg-violet-50 text-[11px] font-semibold text-violet-700">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        Filters
                      </span>
                      <span className="ml-auto text-[11px] font-bold uppercase tracking-wide text-slate-400">
                        {filtered.length} hotel{filtered.length === 1 ? '' : 's'} found
                      </span>
                    </div>
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
                    </div>
                    <p className="text-sm font-black text-violet-700 shrink-0">
                      {formatINR(selectedRoom.pricePerNight || 0)}
                      <span className="text-[10px] font-medium text-slate-400"> /night</span>
                    </p>
                  </div>

                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 px-0.5">
                    Meal plans · {stayNights} night{stayNights !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-3">
                    {mealPlans.map((plan) => (
                      <MealPlanCard
                        key={plan.key || plan.label}
                        plan={plan}
                        roomPrice={selectedRoom.pricePerNight}
                        nights={stayNights}
                        onSelect={selectMealPlan}
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
              {step !== 'meal' && (
                <button
                  type="button"
                  disabled={continueDisabled}
                  onClick={handleContinue}
                  className="h-10 px-4 rounded-xl bg-violet-600 text-white text-sm font-bold shadow-md shadow-violet-600/25 hover:bg-violet-500 disabled:opacity-45 disabled:pointer-events-none"
                >
                  {footerPrimaryLabel}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </AppDrawer>
  );
}
