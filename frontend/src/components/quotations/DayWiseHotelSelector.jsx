import { useMemo, useState } from 'react';
import { BedDouble, Check, Copy } from 'lucide-react';
import { Button } from '../ui/button';
import UnoHotelSelector from './UnoHotelSelector';
import { formatINR } from './quotationUtils';
import { cn } from '../../lib/utils';
import { resolveHotelNightDisplayRate } from '../../lib/mealPlanDefaults';

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

export function sumDayWiseHotelCost(selections = []) {
  return selections.reduce((sum, item) => sum + Number(item.totalCost || item.perNight || 0), 0);
}

/**
 * Day-wise hotel total: sum each night's absolute room+meal rate (reference / display).
 * Each selection is one hotel night (nights defaults to 1).
 */
export function sumDayWiseHotelAbsolute(selections = []) {
  return selections.reduce((sum, item) => {
    const nights = Math.max(1, Number(item.nights) || 1);
    const absolute = Number(
      item.absolutePerNight || item.includedRate || 0
    );
    return sum + absolute * nights;
  }, 0);
}

/** Upgrade delta vs package-included stay (0 for default website config). */
export function sumDayWiseHotelUpgradeCost(selections = []) {
  return selections.reduce((sum, item) => {
    const nights = Math.max(1, Number(item.nights) || 1);
    const delta = Number(
      item.perNight ?? item.totalCost ?? item.priceDelta ?? 0
    );
    return sum + delta * nights;
  }, 0);
}

/** Package-included hotel portion (original rate when stay was seeded / selected). */
export function sumDayWiseHotelIncluded(selections = []) {
  return selections.reduce((sum, item) => {
    const nights = Math.max(1, Number(item.nights) || 1);
    const included = Number(item.includedRate ?? item.hotel?.startingPrice ?? 0);
    return sum + included * nights;
  }, 0);
}

/** Sum hotel nightly rates (same as day cards, no admin margin). */
export function sumDayWiseHotelRackTotal(selections = [], rooms = 1) {
  return round2(
    (Array.isArray(selections) ? selections : []).reduce((sum, item) => {
      const nights = Math.max(1, Number(item.nights) || 1);
      const upgrade = Number(item.perNight ?? item.totalCost ?? item.priceDelta ?? 0);
      const isIncluded = upgrade <= 0;
      const rate = resolveHotelNightDisplayRate(item, null, 'map');
      const nightTotal = isIncluded
        ? rate * nights
        : rate * nights * Math.max(1, Number(rooms) || 1);
      return sum + nightTotal;
    }, 0)
  );
}

/**
 * Hotel upgrade cost only — default package stay is inside website baseStartingPrice.
 */
export function resolvePackageHotelPricing(_packageResidual = 0, selections = []) {
  void _packageResidual;
  const upgradeCost = sumDayWiseHotelUpgradeCost(selections);
  const hotelCost = Math.round(Math.max(0, upgradeCost) * 100) / 100;

  return {
    baseCost: 0,
    hotelCost,
  };
}

export function isDayWiseHotelsComplete(selections = [], nights = 1) {
  const required = Math.max(1, Number(nights) || 1);
  if (selections.length < required) return false;
  return Array.from({ length: required }, (_, index) => index + 1).every((day) => {
    const entry = selections.find((item) => item.day === day);
    return Boolean(entry?.hotel && entry?.room && entry?.mealPlan);
  });
}

export default function DayWiseHotelSelector({
  destination,
  nights = 1,
  value = [],
  onChange,
  preferredMealPlanKey = 'map',
}) {
  const stayNights = Math.max(1, Number(nights) || 1);
  const dayNumbers = useMemo(
    () => Array.from({ length: stayNights }, (_, index) => index + 1),
    [stayNights]
  );
  const [activeDay, setActiveDay] = useState(1);

  const getDaySelection = (day) => value.find((item) => item.day === day) || null;

  const updateDaySelection = (day, selection) => {
    if (!selection) {
      onChange(value.filter((item) => item.day !== day));
      return;
    }
    const perNight = Number(selection.perNight || 0);
    const absolutePerNight = Number(
      selection.absolutePerNight ?? selection.mealPlan?.absolutePrice ?? perNight ?? 0
    );
    const next = value.filter((item) => item.day !== day);
    next.push({
      day,
      hotel: selection.hotel,
      room: selection.room,
      mealPlan: selection.mealPlan,
      perNight,
      absolutePerNight,
      totalCost: selection.mealPlan ? perNight : 0,
      nights: 1,
    });
    onChange(next.sort((a, b) => a.day - b.day));

    if (selection.mealPlan && day < stayNights) {
      const nextNight = day + 1;
      const nextNightDone = next.find((item) => item.day === nextNight)?.mealPlan;
      if (!nextNightDone) setActiveDay(nextNight);
    }
  };

  const applyToAllNights = () => {
    const source = getDaySelection(activeDay);
    if (!source?.mealPlan) return;
    onChange(
      dayNumbers.map((day) => ({
        day,
        hotel: source.hotel,
        room: source.room,
        mealPlan: source.mealPlan,
        perNight: source.perNight,
        absolutePerNight: source.absolutePerNight,
        totalCost: source.perNight,
        nights: 1,
      }))
    );
  };

  const activeSelection = getDaySelection(activeDay);
  const completedCount = dayNumbers.filter((day) => getDaySelection(day)?.mealPlan).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-subtle bg-gradient-to-br from-amber-500/5 to-transparent p-5">
        <h2 className="text-xl font-bold tracking-tight">Select Hotels — Day Wise</h2>
        <p className="text-sm text-content-muted mt-2">
          Choose hotel, room & meal plan for each night ({completedCount}/{stayNights} done)
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-content-muted px-0.5">Select night</p>
        <div className="flex flex-wrap gap-3">
          {dayNumbers.map((day) => {
            const sel = getDaySelection(day);
            const done = Boolean(sel?.mealPlan);
            const active = activeDay === day;
            return (
              <button
                key={day}
                type="button"
                onClick={() => setActiveDay(day)}
                className={cn(
                  'min-w-[132px] rounded-xl border px-4 py-3 text-left transition-all',
                  active && 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/25 shadow-sm',
                  !active && done && 'border-emerald-500/40 bg-emerald-500/5',
                  !active && !done && 'border-subtle hover:border-amber-400/40 hover:bg-surface-elevated/50'
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wide">Night {day}</span>
                  {done ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <BedDouble className="w-3.5 h-3.5 text-content-muted" />}
                </div>
                <p className="text-[11px] text-content-muted mt-2 truncate">
                  {sel?.hotel?.name || 'Select hotel'}
                </p>
                {sel?.room?.name && (
                  <p className="text-[10px] text-amber-700 truncate mt-1">{sel.room.name}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeSelection?.mealPlan && stayNights > 1 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl gap-1.5"
          onClick={applyToAllNights}
        >
          <Copy className="w-3.5 h-3.5" />
          Use Night {activeDay} hotel for all nights
        </Button>
      )}

      {activeSelection?.mealPlan && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 flex items-center justify-between gap-4">
          <span>
            Night {activeDay}: {activeSelection.hotel?.name} · {activeSelection.room?.name}
            {activeSelection.mealPlan?.label ? ` · ${activeSelection.mealPlan.label}` : ''}
          </span>
          <span className="font-semibold shrink-0">
            {formatINR(activeSelection.absolutePerNight || activeSelection.perNight, {
              zeroLabel: 'Not included',
            })}
            {Number(activeSelection.absolutePerNight || activeSelection.perNight || 0) > 0 ? '/night' : ''}
          </span>
        </div>
      )}

      <div className="rounded-2xl border border-subtle bg-surface-base p-4 sm:p-5 space-y-4">
        <p className="text-sm font-semibold text-content-primary">
          Night {activeDay} — Hotel, room & meals
        </p>
        <UnoHotelSelector
          key={`night-${activeDay}`}
          destination={destination}
          nights={1}
          preferredMealPlanKey={preferredMealPlanKey}
          value={activeSelection}
          onChange={(selection) => updateDaySelection(activeDay, selection)}
        />
      </div>
    </div>
  );
}
