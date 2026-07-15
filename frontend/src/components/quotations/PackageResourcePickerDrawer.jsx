import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { motion } from 'framer-motion';
import AppDrawer from '../ui/AppDrawer';
import { formatINR } from './quotationUtils';
import { cn } from '../../lib/utils';

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
      <div className="flex gap-3 p-3">
        <div className="relative w-[88px] h-[72px] rounded-xl overflow-hidden bg-gradient-to-br from-sky-100 to-emerald-50 shrink-0">
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
              <p className="text-xs font-bold text-emerald-600">+{formatINR(price)}</p>
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

function HotelOptionCard({ option, selected, onSelect, showDay }) {
  const image = option.image || option.images?.[0];
  const price = Number(option.priceDelta || 0);
  const stars = Number(option.starRating || 0);

  return (
    <motion.button
      type="button"
      layout
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => onSelect(option)}
      className={cn(
        'group relative w-full text-left rounded-2xl border overflow-hidden transition-all duration-200',
        selected
          ? 'border-violet-400 bg-gradient-to-br from-violet-50 to-white shadow-lg shadow-violet-500/15 ring-2 ring-violet-400/30'
          : 'border-slate-200/90 bg-white hover:border-violet-300 hover:shadow-md hover:shadow-slate-200/80'
      )}
    >
      <div className="relative h-32 overflow-hidden bg-gradient-to-br from-violet-100 via-fuchsia-50 to-sky-50">
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
        {selected && (
          <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white shadow-md">
            <Check className="w-3.5 h-3.5" />
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
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

        <div className="flex flex-wrap items-center gap-1.5">
          {option.meals && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              <UtensilsCrossed className="w-3 h-3" />
              {option.meals}
            </span>
          )}
          {option.tierName && !option.location && (
            <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
              {option.tierName}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {price > 0 ? (
            <p className="text-xs font-bold text-emerald-600">+{formatINR(price)}</p>
          ) : (
            <p className="text-[11px] font-semibold text-slate-400">Package rate</p>
          )}
          {selected ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Selected</span>
          ) : (
            <span className="text-[10px] font-semibold text-slate-400 group-hover:text-violet-500 transition-colors">
              Tap to select
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

/**
 * Right-side picker for package cabs or hotels.
 * mode: 'cab' | 'hotel'
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
}) {
  const [query, setQuery] = useState('');
  const isCab = mode === 'cab';

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

  const handleSelect = (opt) => {
    onSelect?.(opt);
  };

  const heading =
    title || (isCab ? 'Choose your cab' : 'Choose your hotel');
  const sub =
    subtitle ||
    (isCab
      ? 'Pick the private transfer that fits your guest'
      : 'Select a stay option from this package');

  return (
    <AppDrawer
      open={open}
      onClose={() => {
        setQuery('');
        onClose?.();
      }}
      className="max-w-[440px] bg-white border-slate-200/80 shadow-2xl shadow-slate-900/25"
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
        <div className="relative px-5 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-white backdrop-blur border border-white/20 shadow-inner">
                {isCab ? <Car className="w-5 h-5" /> : <Hotel className="w-5 h-5" />}
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
              onClick={() => {
                setQuery('');
                onClose?.();
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white border border-white/15 hover:bg-white/20 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={isCab ? 'Search cabs…' : 'Search hotels…'}
              className="w-full h-10 rounded-xl border border-white/20 bg-white/10 pl-9 pr-3 text-sm text-white placeholder:text-white/45 outline-none focus:bg-white/15 focus:ring-2 focus:ring-white/25"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_48%)]">
        <div className="flex items-center justify-between px-0.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {filtered.length} option{filtered.length === 1 ? '' : 's'}
          </p>
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
            >
              Clear search
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
            <p className="text-sm font-semibold text-slate-800">No matches</p>
            <p className="text-xs text-slate-500 mt-1">Try a different name or clear the search.</p>
          </div>
        ) : isCab ? (
          filtered.map((cab) => {
            const id = cab.id || cab.packageCabId || cab.name;
            return (
              <CabOptionCard
                key={id}
                cab={cab}
                selected={selectedId != null && selectedId === id}
                onSelect={handleSelect}
              />
            );
          })
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((opt) => {
              const id = `${opt.id || opt.hotelId || opt.name}-${opt._day?.day ?? ''}`;
              const selKey = opt.id || opt.hotelId || opt.name;
              return (
                <HotelOptionCard
                  key={id}
                  option={opt}
                  selected={selectedId != null && selectedId === selKey}
                  onSelect={handleSelect}
                  showDay={showDayBadge}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-3">
        <p className="text-[11px] text-slate-500 text-center">
          Selection updates your quotation instantly
        </p>
      </div>
    </AppDrawer>
  );
}
