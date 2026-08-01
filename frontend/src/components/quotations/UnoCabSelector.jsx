import { useEffect, useMemo, useRef, useState } from 'react';
import { Car, Check, Loader2, Package, RefreshCw, Search, Users } from 'lucide-react';
import API from '../../api/axios';
import { Button } from '../ui/button';
import { resolvePackageCabs } from '../../lib/packageCabMapper';
import { formatINR } from './quotationUtils';
import { cn } from '../../lib/utils';

function formatApiDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function inferStateFromDestination(destination = '') {
  const text = String(destination || '').trim();
  const known = [
    'Himachal Pradesh', 'Uttarakhand', 'Rajasthan', 'Kerala', 'Goa', 'Punjab',
    'Jammu and Kashmir', 'Ladakh', 'Sikkim', 'West Bengal', 'Maharashtra',
  ];
  for (const state of known) {
    if (new RegExp(state.replace(/\s+/g, '\\s+'), 'i').test(text)) return state;
  }
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1].replace(/\s+india$/i, '').trim();
  return '';
}

function parseRouteCities(routing = '') {
  return String(routing || '')
    .split(/[→\-–>|,/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function inferCityFromDestination(destination = '') {
  const text = String(destination || '').trim();
  if (!text) return '';
  const first = text.split(',')[0]?.trim() || text;
  return first.replace(/\s+(India|Himachal Pradesh|Uttarakhand|Rajasthan|Kerala|Goa|Punjab|Delhi)$/i, '').trim() || first;
}

function cabKey(cab) {
  return cab?.id || cab?.slug || cab?.packageCabId || '';
}

function CabResultRow({ cab, selected, onSelect, priceLabel = 'total fare' }) {
  const isPackageCab = cab.isPackageCab || cab.externalSource === 'uno_package';

  return (
    <button
      type="button"
      onClick={() => onSelect(cab)}
      className={cn(
        'w-full rounded-2xl border p-4 text-left transition-all',
        selected
          ? 'border-emerald-500/50 bg-emerald-500/10 ring-2 ring-emerald-500/20'
          : 'border-subtle hover:border-emerald-400/40 hover:bg-surface-elevated/50'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm">{cab.name}</p>
            {isPackageCab && (
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-violet-500/10 text-violet-700">
                Package Cab
              </span>
            )}
            {cab.isDefault && (
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700">
                Default
              </span>
            )}
            {cab.isPopular && (
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700">
                Popular
              </span>
            )}
            {selected && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
          </div>
          <p className="text-xs text-content-muted mt-1">
            {isPackageCab
              ? `Included with this package · ${cab.seatingCapacity || '—'} seats`
              : [cab.pickupCity, cab.dropCity].filter(Boolean).join(' → ') || 'Route cab'}
            {!isPackageCab && cab.tripType ? ` · ${cab.tripType.replace(/_/g, ' ')}` : ''}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {cab.seatingCapacity && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-surface-elevated">
                <Users className="w-3 h-3" /> {cab.seatingCapacity} seats
              </span>
            )}
            {cab.isAc && (
              <span className="text-[10px] font-medium px-2 py-1 rounded-lg bg-sky-500/10 text-sky-700">AC</span>
            )}
            {cab.vehicleModel && (
              <span className="text-[10px] font-medium px-2 py-1 rounded-lg bg-surface-elevated">{cab.vehicleModel}</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base font-bold text-emerald-700">{formatINR(cab.totalAmount || cab.cost)}</p>
          <p className="text-[10px] text-content-muted">{priceLabel}</p>
        </div>
      </div>
    </button>
  );
}

export default function UnoCabSelector({
  lead,
  pkg,
  packageCabs = [],
  value,
  onChange,
}) {
  const destination = lead?.destination || pkg?.destination || '';
  const routing = pkg?.routing || pkg?.route || '';
  const routeCities = useMemo(() => parseRouteCities(routing), [routing]);
  const attachedCabs = useMemo(
    () => resolvePackageCabs({ packageCabs, _apiRaw: pkg?._apiRaw }),
    [packageCabs, pkg?._apiRaw]
  );

  const [mode, setMode] = useState(attachedCabs.length ? 'package' : 'manual');
  const autoSelectedRef = useRef(false);

  const defaults = useMemo(() => ({
    pickupCity: routeCities[0] || lead?.city || inferCityFromDestination(destination),
    dropCity: routeCities[routeCities.length - 1] || inferCityFromDestination(destination),
    dropState: lead?.state || inferStateFromDestination(destination),
    tripType: 'full_day',
    travelDate: formatApiDate(lead?.travelDate),
    returnDate: lead?.travelDate && pkg?.duration
      ? formatApiDate(new Date(new Date(lead.travelDate).getTime() + (Number(pkg.duration) - 1) * 86400000))
      : '',
    passengers: Math.max(1, Number(lead?.travelers) || 2),
  }), [lead, pkg, destination, routing, routeCities]);

  const [form, setForm] = useState(defaults);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(defaults);
  }, [defaults]);

  useEffect(() => {
    autoSelectedRef.current = false;
    if (attachedCabs.length) setMode('package');
    else setMode('manual');
  }, [attachedCabs.length, pkg?.id, pkg?.slug]);

  useEffect(() => {
    if (!attachedCabs.length || value || autoSelectedRef.current) return;
    const defaultCab = attachedCabs.find((cab) => cab.isDefault) || attachedCabs[0];
    if (defaultCab) {
      onChange(defaultCab);
      autoSelectedRef.current = true;
    }
  }, [attachedCabs, value, onChange]);

  const canSearch = form.pickupCity && form.dropCity && form.dropState && form.travelDate;

  const runSearch = async () => {
    if (!canSearch) {
      setError('Fill pickup city, drop city, state, and travel date to search cabs.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await API.get('/uno-cabs/search', {
        params: {
          pickup_city: form.pickupCity,
          drop_city: form.dropCity,
          drop_state: form.dropState,
          trip_type: form.tripType,
          travel_date: form.travelDate,
          return_date: form.tripType === 'round_trip' ? form.returnDate || undefined : undefined,
          passengers: form.passengers,
          destination,
          routing,
        },
        skipErrorToast: true,
      });
      setResults(res.data?.items || []);
      setSearched(true);
    } catch (err) {
      setResults([]);
      setSearched(true);
      setError(err.response?.data?.message || 'Could not search cabs from Uno API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== 'manual' || !canSearch || searched) return;
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const setField = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    if (nextMode === 'manual' && !searched && canSearch) runSearch();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-subtle bg-gradient-to-br from-emerald-500/5 to-transparent p-4 space-y-3">
        <div>
          <h3 className="text-lg font-bold tracking-tight">Select Transport</h3>
          <p className="text-sm text-content-muted mt-1">
            Use the cab attached to <strong>{pkg?.name || 'this package'}</strong>, or search manually from Uno API.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleModeChange('package')}
            disabled={!attachedCabs.length}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all',
              mode === 'package'
                ? 'bg-violet-500 text-white border-violet-500 shadow-sm'
                : 'bg-white border-subtle text-content-secondary hover:border-violet-400/40',
              !attachedCabs.length && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Package className="w-4 h-4" />
            Package Cab {attachedCabs.length ? `(${attachedCabs.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('manual')}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all',
              mode === 'manual'
                ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                : 'bg-white border-subtle text-content-secondary hover:border-emerald-400/40'
            )}
          >
            <Search className="w-4 h-4" />
            Manual Search
          </button>
        </div>
      </div>

      {value && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold truncate">
              {value.name} · {value.cabCategory || value.vehicleType}
              {value.isPackageCab ? ' · Package' : ' · Manual'}
            </p>
            <p className="text-xs opacity-80 truncate">
              {value.isPackageCab
                ? 'Attached to package'
                : `${value.pickupCity || '—'} → ${value.dropCity || '—'}`}
            </p>
          </div>
          <p className="font-bold shrink-0">{formatINR(value.totalAmount || value.cost)}</p>
        </div>
      )}

      {mode === 'package' && (
        <div className="space-y-3">
          {attachedCabs.length === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-dashed border-subtle">
              <Package className="w-10 h-10 mx-auto text-content-muted/40 mb-3" />
              <p className="text-sm font-medium">No cab attached to this package</p>
              <p className="text-xs text-content-muted mt-1">Switch to Manual Search to pick a cab from Uno API.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {attachedCabs.map((cab) => (
                <CabResultRow
                  key={cabKey(cab)}
                  cab={cab}
                  selected={cabKey(value) === cabKey(cab)}
                  onSelect={onChange}
                  priceLabel="package price"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {mode === 'manual' && (
        <>
          <div className="rounded-2xl border border-subtle bg-surface-base p-4 space-y-3">
            <p className="text-sm font-semibold text-content-primary">Search route on Uno Cabs API</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase text-content-muted">Pickup City</span>
                <input
                  value={form.pickupCity}
                  onChange={(e) => setField('pickupCity', e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-subtle bg-white text-sm"
                  placeholder="Delhi"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase text-content-muted">Drop City</span>
                <input
                  value={form.dropCity}
                  onChange={(e) => setField('dropCity', e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-subtle bg-white text-sm"
                  placeholder="Manali"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase text-content-muted">Drop State</span>
                <input
                  value={form.dropState}
                  onChange={(e) => setField('dropState', e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-subtle bg-white text-sm"
                  placeholder="Himachal Pradesh"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase text-content-muted">Trip Type</span>
                <select
                  value={form.tripType}
                  onChange={(e) => setField('tripType', e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-subtle bg-white text-sm"
                >
                  <option value="full_day">Full Day (Package)</option>
                  <option value="one_way">One Way</option>
                  <option value="round_trip">Round Trip</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase text-content-muted">Travel Date</span>
                <input
                  type="date"
                  value={form.travelDate}
                  onChange={(e) => setField('travelDate', e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-subtle bg-white text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase text-content-muted">Passengers</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.passengers}
                  onChange={(e) => setField('passengers', Number(e.target.value) || 1)}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-subtle bg-white text-sm"
                />
              </label>
            </div>

            <Button type="button" variant="outline" className="rounded-xl gap-2" onClick={runSearch} disabled={loading || !canSearch}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Search Cabs
            </Button>
          </div>

          {error && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-14 text-content-muted gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p className="text-sm">Searching cabs...</p>
            </div>
          ) : searched && results.length === 0 ? (
            <div className="text-center py-14 rounded-2xl border border-dashed border-subtle">
              <Car className="w-10 h-10 mx-auto text-content-muted/40 mb-3" />
              <p className="text-sm font-medium">No cabs found for this route</p>
              <p className="text-xs text-content-muted mt-1 max-w-sm mx-auto">
                Try different cities or use Package Cab if available.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {results.map((cab) => (
                <CabResultRow
                  key={cabKey(cab)}
                  cab={cab}
                  selected={cabKey(value) === cabKey(cab)}
                  onSelect={onChange}
                />
              ))}
            </div>
          )}
        </>
      )}

      {value && (
        <Button type="button" variant="ghost" size="sm" className="rounded-xl" onClick={() => onChange(null)}>
          Clear cab selection
        </Button>
      )}
    </div>
  );
}

export function buildSelectedCabSnapshot(cab, { vehicleCount = 1, travelers } = {}) {
  if (!cab) return [];
  const count = Math.max(1, Number(vehicleCount) || 1);
  const unit = Number(cab.absoluteFare ?? cab.totalAmount ?? cab.cost ?? 0) || 0;
  const upgrade = Number(cab.upgradePrice ?? cab.priceDelta ?? 0) || 0;
  const total = Math.round(unit * count * 100) / 100;
  return [{
    _id: cab.id || cab.slug || cab.packageCabId,
    id: cab.id || cab.packageCabId,
    slug: cab.slug,
    packageCabId: cab.packageCabId || (cab.isPackageCab ? cab.id : null),
    cabTypeId: cab.cabTypeId || null,
    name: cab.name,
    vehicleType: cab.vehicleType || cab.cabCategory || cab.name,
    cabCategory: cab.cabCategory || cab.vehicleType || '',
    pickupLocation: cab.pickupCity || cab.pickupLocation || '',
    dropLocation: cab.dropCity || cab.dropLocation || '',
    pickupCity: cab.pickupCity || '',
    dropCity: cab.dropCity || '',
    dropState: cab.dropState || '',
    tripType: cab.tripType || 'full_day',
    travelDate: cab.travelDate || '',
    seatingCapacity: cab.seatingCapacity,
    vehicleCount: count,
    travelers: travelers != null ? Number(travelers) : undefined,
    isAc: cab.isAc,
    isPackageCab: Boolean(cab.isPackageCab),
    isDefault: Boolean(cab.isDefault),
    absoluteFare: unit,
    unitCost: unit,
    cost: total,
    totalAmount: total,
    priceDelta: upgrade,
    upgradePrice: upgrade,
    fare: cab.fare || {},
    externalSource: cab.externalSource || (cab.isPackageCab ? 'uno_package' : 'uno_cabs'),
  }];
}
