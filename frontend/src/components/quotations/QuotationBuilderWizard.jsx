import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, ExternalLink, Search } from 'lucide-react';
import API from '../../api/axios';
import { Button } from '../ui/button';
import Avatar from '../ui/Avatar';
import VirtualizedList from '../ui/VirtualizedList';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { buildListParams, unwrapPagination } from '../../utils/apiHelpers';
import { fetchUnoPublicPackages, fetchUnoPublicPackageDetail } from '../../lib/unoPublicPackages';
import { logSelectedPackageDebug } from '../../lib/logPackageDebug';
import { resolvePackageItinerary, seedDayWiseHotelsFromItinerary } from '../../lib/packageItineraryMapper';
import { resolvePackageCabs } from '../../lib/packageCabMapper';
import InclusionExclusionEditor, { cleanInclusionExclusionLines } from './InclusionExclusionEditor';
import { sumDayWiseHotelCost } from './DayWiseHotelSelector';
import { buildSelectedCabSnapshot } from './UnoCabSelector';
import { parsePackageNights } from './UnoHotelSelector';
import { WIZARD_STEPS } from './constants';
import { calculatePricing, defaultItineraryDay, defaultWizardState, formatINR, matchesResourceDestination } from './quotationUtils';
import { buildSelectedHotelsSnapshot } from './quotePdfHelpers';
import { unwrapList } from '../../utils/apiHelpers';
import PackageBuilderWorkspace from './PackageBuilderWorkspace';
import PackageBuilderOpeningOverlay from './PackageBuilderOpeningOverlay';
import { cn } from '../../lib/utils';

const ADMIN_CONFIG = {
  leadsPath: '/leads',
  leadViewPath: (id) => `/leads/${id}`,
  savePath: '/quotations',
  backPath: '/quotations',
  successPath: '/quotations',
  title: 'Package Builder',
  subtitle: 'Customize Uno packages with live hotels, cabs, itinerary and pricing',
  draftStatus: 'draft',
  submitStatus: 'sent',
  draftLabel: 'Save Draft',
  submitLabel: 'Save & Send',
  approvalNote: null,
};

const EXECUTIVE_CONFIG = {
  leadsPath: '/sales-executive/leads/all',
  leadViewPath: (id) => `/sales-executive/leads/${id}/view`,
  savePath: '/sales-executive/quotations',
  backPath: '/sales-executive/quotations',
  successPath: '/sales-executive/quotations',
  title: 'Package Builder',
  subtitle: 'Lead auto-loads into a GTrip-style tour package builder with live hotels, cabs & pricing',
  draftStatus: 'draft',
  submitStatus: 'pending_approval',
  draftLabel: 'Save Draft',
  submitLabel: 'Submit Quotation',
  approvalNote: 'The first quotation for a lead is approved automatically. From the second quote onward, Team Leader approval is required before sending to the customer.',
};

const TEAM_LEADER_CONFIG = {
  leadsPath: '/team-leader/leads',
  leadViewPath: (id) => `/team-leader/leads/${id}/view`,
  leadsParams: { filter: 'all', page: 1, limit: 50 },
  savePath: '/team-leader/quotations',
  backPath: '/team-leader/quotations/pending',
  successPath: '/team-leader/quotations/approved',
  title: 'Package Builder',
  subtitle: 'Build and approve a tour package for your team lead',
  draftStatus: 'draft',
  submitStatus: 'approved',
  draftLabel: 'Save Draft',
  submitLabel: 'Create & Approve',
  approvalNote: 'Executive can send the approved quote to the customer.',
};

const MANAGER_CONFIG = {
  leadsPath: '/sales-manager/leads',
  leadViewPath: (id) => `/sales-manager/leads/${id}/view`,
  leadsParams: { filter: 'all', page: 1, limit: 50 },
  savePath: '/sales-manager/quotations',
  backPath: '/sales-manager/quotations/pending',
  successPath: '/sales-manager/quotations/approved',
  title: 'Package Builder',
  subtitle: 'Build and approve a tour package for any team lead in your branch',
  draftStatus: 'draft',
  submitStatus: 'approved',
  draftLabel: 'Save Draft',
  submitLabel: 'Create & Approve',
  approvalNote: 'Quote is approved on creation. Executive can send to customer.',
};

const CONFIG_BY_MODE = {
  executive: EXECUTIVE_CONFIG,
  team_leader: TEAM_LEADER_CONFIG,
  sales_manager: MANAGER_CONFIG,
  admin: ADMIN_CONFIG,
};

function emailEndpointForMode(mode) {
  if (mode === 'executive') return '/sales-executive/leads';
  return '/leads';
}

export default function QuotationBuilderWizard({ mode = 'executive' }) {
  const config = CONFIG_BY_MODE[mode] || EXECUTIVE_CONFIG;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialLeadId = searchParams.get('leadId');
  const [step, setStep] = useState(1);
  const [leads, setLeads] = useState([]);
  const [leadSearch, setLeadSearch] = useState('');
  const debouncedLeadSearch = useDebouncedValue(leadSearch, 500);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [packages, setPackages] = useState([]);
  const [flights, setFlights] = useState([]);
  const [activities, setActivities] = useState([]);
  const [selectedUnoCab, setSelectedUnoCab] = useState(null);
  const [state, setState] = useState({ ...defaultWizardState });
  const [customItinerary, setCustomItinerary] = useState([]);
  const [customInclusions, setCustomInclusions] = useState([]);
  const [customExclusions, setCustomExclusions] = useState([]);
  const [customizeTab, setCustomizeTab] = useState('itinerary');
  const [selectedPkgDetail, setSelectedPkgDetail] = useState(null);
  const [dayWiseHotels, setDayWiseHotels] = useState([]);
  const [loadingPackageDetail, setLoadingPackageDetail] = useState(false);
  const [openingPackageMeta, setOpeningPackageMeta] = useState({ name: '', destination: '' });
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packageSearch, setPackageSearch] = useState('');
  const debouncedPackageSearch = useDebouncedValue(packageSearch, 350);
  const [saving, setSaving] = useState(false);

  const isMongoPackageId = (id) => id && /^[a-fA-F0-9]{24}$/.test(String(id));

  useEffect(() => {
    let cancelled = false;

    const loadResources = async () => {
      const requests = [
        API.get('/flights', { skipErrorToast: true }),
        API.get('/activities', { skipErrorToast: true }),
      ];

      const results = await Promise.allSettled(requests);
      if (cancelled) return;

      const pick = (index) => (results[index].status === 'fulfilled' ? results[index].value.data : []);

      setFlights(unwrapList(pick(0)));
      setActivities(unwrapList(pick(1)));
    };

    loadResources().catch(() => {
      if (!cancelled) {
        setFlights([]);
        setActivities([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchLeads = useCallback(async (searchTerm) => {
    setLoadingLeads(true);
    try {
      const baseParams = config.leadsParams || { page: 1, limit: 50 };
      const params = buildListParams({
        page: 1,
        limit: 50,
        filters: {
          ...baseParams,
          filter: baseParams.filter,
          search: searchTerm?.trim() || undefined,
        },
      });
      const { data } = await API.get(config.leadsPath, { params, skipErrorToast: true });
      const rows = unwrapPagination(data).data || unwrapList(data);
      setLeads(rows);
      return rows;
    } catch {
      setLeads([]);
      return [];
    } finally {
      setLoadingLeads(false);
    }
  }, [config.leadsPath, config.leadsParams]);

  useEffect(() => {
    if (step !== 1) return;
    if (initialLeadId && !debouncedLeadSearch.trim()) {
      fetchLeads('');
      return;
    }
    if (debouncedLeadSearch.trim().length >= 2) {
      fetchLeads(debouncedLeadSearch);
    } else if (!initialLeadId) {
      setLeads([]);
    }
  }, [step, debouncedLeadSearch, initialLeadId, fetchLeads]);

  useEffect(() => {
    if (initialLeadId) {
      setState((s) => ({ ...s, leadId: initialLeadId }));
      setStep(2);
    }
  }, [initialLeadId]);

  useEffect(() => {
    if (!initialLeadId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const tryPaths = [
          config.leadsPath ? `${config.leadsPath.replace(/\/$/, '')}` : null,
          `/leads/${initialLeadId}`,
          `/sales-executive/leads/${initialLeadId}`,
        ].filter(Boolean);

        // Prefer dedicated lead fetch when list won't include the ID
        try {
          const { data } = await API.get(`/leads/${initialLeadId}`, { skipErrorToast: true });
          if (!cancelled && data?._id) {
            setLeads((prev) => (prev.some((l) => l._id === data._id) ? prev : [data, ...prev]));
            setState((s) => ({ ...s, leadId: data._id }));
            setStep(2);
            return;
          }
        } catch {
          /* fall through to list search */
        }

        const rows = await fetchLeads('');
        if (cancelled) return;
        const found = rows.find((l) => String(l._id) === String(initialLeadId));
        if (found) {
          setState((s) => ({ ...s, leadId: found._id }));
          setStep(2);
        }
        void tryPaths;
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialLeadId, fetchLeads, config.leadsPath]);

  const selectedLead = leads.find((l) => l._id === state.leadId);
  const selectedPkg = packages.find((p) => p._id === state.packageId);
  const activePkg = selectedPkgDetail || selectedPkg;
  const packageNights = parsePackageNights(activePkg);
  const hotelDestination = selectedLead?.destination || activePkg?.destination || '';
  const availableActivities = activities.filter((activity) =>
    matchesResourceDestination(activity, hotelDestination)
  );

  const skipActivities = () => {
    setState((s) => ({ ...s, selectedActivityIds: [], activitiesSkipped: true }));
    setStep(7);
  };

  const handleDayWiseHotelChange = (selections) => {
    setDayWiseHotels(selections);
    if (!selections.length || customItinerary.length === 0) return;

    setCustomItinerary((days) =>
      days.map((day, index) => {
        const dayNum = day.day || index + 1;
        const sel = selections.find((item) => item.day === dayNum);
        if (!sel?.hotel) return day;
        return {
          ...day,
          hotel: sel.hotel.name,
          meals: sel.mealPlan?.label || day.meals,
        };
      })
    );
  };

  useEffect(() => {
    if (step !== 2) return undefined;
    const destination = selectedLead?.destination?.trim();
    if (!destination) {
      setPackages([]);
      return undefined;
    }

    let cancelled = false;
    setLoadingPackages(true);
    Promise.all([
      fetchUnoPublicPackages({
        limit: 50,
        page: 1,
        search: debouncedPackageSearch || undefined,
        destination,
      }),
      API.get('/packages', { skipErrorToast: true }).catch(() => ({ data: [] })),
    ])
      .then(([unoResult, localRes]) => {
        if (cancelled) return;
        const uno = (unoResult.items || []).map((p) => ({
          ...p,
          _id: p._id || p.id,
          catalogSource: 'uno',
        }));
        const customs = unwrapList(localRes.data)
          .filter((p) => p.sourceType === 'uno_clone' && matchesResourceDestination(p, destination))
          .map((p) => ({ ...p, catalogSource: 'custom' }));
        setPackages([...customs, ...uno]);
      })
      .catch((err) => {
        console.error('Failed to load UNO packages for quotation:', err);
        if (!cancelled) setPackages([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPackages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, debouncedPackageSearch, selectedLead?.destination]);

  const buildPackageSnapshot = (pkg) => ({
    ...pkg,
    itinerary: customItinerary,
    inclusions: cleanInclusionExclusionLines(customInclusions),
    exclusions: cleanInclusionExclusionLines(customExclusions),
    cabCategory: selectedUnoCab?.cabCategory || selectedUnoCab?.vehicleType || pkg?.cabCategory || '',
  });

  const selectLead = (lead) => {
    setState({ ...defaultWizardState, leadId: lead._id });
    setSelectedPkgDetail(null);
    setCustomItinerary([]);
    setCustomInclusions([]);
    setCustomExclusions([]);
    setCustomizeTab('itinerary');
    setDayWiseHotels([]);
    setSelectedUnoCab(null);
    setStep(2);
  };

  const buildFallbackItinerary = (detail) => {
    const days = Math.max(1, Number(detail.duration) || 1);
    const destination = detail.destination || 'Destination';
    return Array.from({ length: days }, (_, index) =>
      defaultItineraryDay(index + 1, destination)
    );
  };

  const applyPackageDetail = (detail, meta = {}) => {
    const cloned = JSON.parse(JSON.stringify(detail));
    const rawItinerary = resolvePackageItinerary(cloned);
    const itinerarySource = rawItinerary.length > 0 ? rawItinerary : buildFallbackItinerary(cloned);
    const itinerary = itinerarySource.map((d, index) => ({
      ...d,
      id: d.id || `day-${d.day || index + 1}`,
      day: d.day || index + 1,
    }));
    const packageCabs = resolvePackageCabs(cloned);
    const normalized = {
      ...cloned,
      itinerary,
      packageCabs,
    };
    logSelectedPackageDebug(normalized, meta);
    setSelectedPkgDetail(normalized);
    setCustomItinerary(itinerary.map((d) => ({ ...d })));
    setCustomInclusions(normalized.inclusions?.length ? [...normalized.inclusions] : ['']);
    setCustomExclusions(normalized.exclusions?.length ? [...normalized.exclusions] : ['']);
    setCustomizeTab('itinerary');

    // Seed day-wise hotels from API hotel_options (same hotels shown in itinerary)
    const seededHotels = seedDayWiseHotelsFromItinerary(itinerary);
    setDayWiseHotels(seededHotels);

    // Auto-select default package cab from day-options
    const defaultCab = packageCabs.find((c) => c.isDefault) || packageCabs[0] || null;
    setSelectedUnoCab(defaultCab);

    setState((s) => ({
      ...s,
      pricing: {
        ...s.pricing,
        baseCost: normalized.startingPrice || 0,
        ...calculatePricing({ ...s.pricing, baseCost: normalized.startingPrice || 0 }),
      },
    }));
  };

  const selectPackage = async (pkg) => {
    const id = pkg._id || pkg.id;
    setState((s) => ({ ...s, packageId: id }));
    setCustomItinerary([]);
    setCustomInclusions([]);
    setCustomExclusions([]);
    setCustomizeTab('itinerary');
    setSelectedPkgDetail(null);
    setDayWiseHotels([]);
    setSelectedUnoCab(null);
    setOpeningPackageMeta({
      name: pkg.name || 'Your package',
      destination: pkg.destination || pkg.routing || selectedLead?.destination || '',
    });
    setLoadingPackageDetail(true);
    try {
      if (pkg.catalogSource === 'custom' || isMongoPackageId(id)) {
        const res = await API.get(`/packages/${id}`, { skipErrorToast: true });
        applyPackageDetail(res.data, { source: 'local_crm', listItem: pkg, apiPath: `/packages/${id}` });
      } else {
        const detail = await fetchUnoPublicPackageDetail(pkg.slug || id);
        applyPackageDetail(detail, {
          source: 'uno_hotels',
          listItem: pkg,
          apiPath: `/uno-packages/${pkg.slug || id}`,
        });
      }
    } catch {
      applyPackageDetail(pkg, { source: 'list_fallback', listItem: pkg });
    } finally {
      setLoadingPackageDetail(false);
      setStep(3);
    }
  };

  const toggleId = (key, id) => {
    setState((s) => {
      const arr = s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id];
      const next = { ...s, [key]: arr };
      if (key === 'selectedActivityIds') next.activitiesSkipped = false;
      return next;
    });
  };

  useEffect(() => {
    const hotelCost = sumDayWiseHotelCost(dayWiseHotels);
    const cabCost = Number(selectedUnoCab?.totalAmount || selectedUnoCab?.cost || 0);
    const flightCost = flights.filter((f) => state.selectedFlightIds.includes(f._id)).reduce((s, f) => s + (f.cost || 0), 0);
    const activityCost = activities.filter((a) => state.selectedActivityIds.includes(a._id)).reduce((s, a) => s + (a.price || 0), 0);
    const calc = calculatePricing({
      ...state.pricing,
      hotelCost,
      cabCost,
      flightCost,
      activityCost,
    });
    setState((s) => ({
      ...s,
      pricing: {
        ...s.pricing,
        hotelCost,
        cabCost,
        flightCost,
        activityCost,
        taxes: calc.taxes,
        markup: calc.markup,
        total: calc.total,
        profitMargin: calc.profitMargin,
      },
    }));
  }, [
    selectedUnoCab,
    state.selectedFlightIds,
    state.selectedActivityIds,
    flights,
    activities,
    state.pricing.baseCost,
    state.pricing.taxes,
    state.pricing.markup,
    state.pricing.discount,
    state.pricing.gstEnabled,
    state.pricing.markupPercent,
    dayWiseHotels,
  ]);

  const handleSave = async (saveAs) => {
    if (!state.leadId || !state.packageId) return;
    const status = saveAs === 'draft' ? config.draftStatus : config.submitStatus;
    setSaving(true);
    try {
      const payload = {
        quoteNumber: `Q-${Date.now().toString().slice(-6)}`,
        leadId: state.leadId,
        packageId: isMongoPackageId(state.packageId) ? state.packageId : null,
        status,
        pricing: state.pricing,
        selectedHotels: buildSelectedHotelsSnapshot(dayWiseHotels),
        selectedCabs: buildSelectedCabSnapshot(selectedUnoCab),
        selectedFlights: flights.filter((f) => state.selectedFlightIds.includes(f._id)),
        selectedActivities: activities.filter((a) => state.selectedActivityIds.includes(a._id)),
        package: buildPackageSnapshot(activePkg),
        customizations: state.customizations,
      };
      const res = await API.post(config.savePath, payload);
      const successUrl =
        mode === 'executive'
          ? config.successPath
          : `${config.successPath}?view=${res.data._id}`;
      const savedStatus = res.data?.status;
      navigate(successUrl, {
        state: {
          message:
            savedStatus === 'approved'
              ? 'First quotation created and approved. You can send it to the customer.'
              : savedStatus === 'pending_approval'
                ? 'Quotation submitted to Team Leader for approval.'
                : 'Quotation saved as draft.',
        },
      });
    } catch (err) {
      /* toast via axios */
    } finally {
      setSaving(false);
    }
  };

  const draftQuote = selectedLead && activePkg ? {
    quoteNumber: 'PREVIEW',
    createdAt: new Date().toISOString(),
    lead: selectedLead,
    package: buildPackageSnapshot(activePkg),
    pricing: state.pricing,
    selectedHotels: buildSelectedHotelsSnapshot(dayWiseHotels),
    selectedCabs: buildSelectedCabSnapshot(selectedUnoCab),
  } : null;

  const inBuilder = step >= 3 && Boolean(activePkg);

  return (
    <div className={cn('pb-12', inBuilder ? 'max-w-[1440px] mx-auto' : 'max-w-4xl mx-auto')}>
      {!inBuilder && (
        <>
          <div className="flex items-center gap-3 mb-6">
            <Link to={config.backPath} className="p-2 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-600"><ArrowLeft className="w-4 h-4" /></Link>
            <div>
              <h1 className="text-2xl font-bold text-content-primary">{config.title}</h1>
              <p className="text-sm text-content-muted">{config.subtitle}</p>
              {config.approvalNote && (
                <p className="text-xs text-amber-700 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 mt-2 max-w-xl">
                  {config.approvalNote}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-subtle bg-surface/80 p-4 mb-6">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {WIZARD_STEPS.filter((s) => s.id <= 3 || s.id === 8).map((s, idx, arr) => (
                <div key={s.id} className={cn('flex items-center shrink-0', idx < arr.length - 1 && 'flex-1')}>
                  <button type="button" onClick={() => s.id <= step && setStep(s.id === 8 ? 3 : s.id)} className={cn('flex flex-col items-center gap-1 px-2', s.id <= step || (s.id === 8 && step >= 3) ? 'cursor-pointer' : 'opacity-40')}>
                    <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold', step === s.id || (s.id === 3 && step >= 3) ? 'bg-violet-600 text-white ring-4 ring-violet-500/20' : s.id < step ? 'bg-emerald-500 text-white' : 'bg-surface-elevated text-content-muted')}>{idx + 1}</div>
                    <span className={cn('text-[9px] font-medium hidden sm:block', (step === s.id || (s.id === 3 && step >= 3)) && 'text-violet-600')}>{s.id === 3 ? 'Builder' : s.title}</span>
                  </button>
                  {idx < arr.length - 1 && <div className={cn('h-0.5 flex-1 mx-1 min-w-[12px]', s.id < step || step >= 3 ? 'bg-emerald-500' : 'bg-surface-elevated')} />}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {inBuilder ? (
        <PackageBuilderWorkspace
          lead={selectedLead}
          pkg={activePkg}
          itinerary={customItinerary}
          onItineraryChange={setCustomItinerary}
          inclusions={customInclusions}
          exclusions={customExclusions}
          onInclusionsChange={setCustomInclusions}
          onExclusionsChange={setCustomExclusions}
          dayWiseHotels={dayWiseHotels}
          onDayWiseHotelsChange={handleDayWiseHotelChange}
          selectedUnoCab={selectedUnoCab}
          onCabChange={setSelectedUnoCab}
          packageCabs={resolvePackageCabs(activePkg || {})}
          pricing={state.pricing}
          onPricingChange={(p) => setState((s) => ({ ...s, pricing: p }))}
          nights={packageNights}
          hotelDestination={hotelDestination}
          draftQuote={draftQuote}
          onBack={() => setStep(2)}
          onSaveDraft={() => handleSave('draft')}
          onSubmit={() => handleSave('submit')}
          saving={saving}
          draftLabel={config.draftLabel}
          submitLabel={config.submitLabel}
          emailEndpoint={emailEndpointForMode(mode)}
        />
      ) : (
      <div className="rounded-2xl border border-subtle bg-surface shadow-lg p-6 sm:p-8 min-h-[400px]">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {step === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Select Lead</h2>
                  {state.leadId && config.leadViewPath && (
                    <Link
                      to={config.leadViewPath(state.leadId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline"
                    >
                      View Lead <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
                {selectedLead && (
                  <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3 text-sm">
                    <p className="font-semibold text-content-primary">{selectedLead.name}</p>
                    <p className="text-xs text-content-muted mt-0.5">{selectedLead.destination} · {formatINR(selectedLead.budget)}</p>
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
                  <input
                    type="search"
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Search leads by name, phone, destination (min 2 chars)…"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-subtle bg-surface text-sm outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                </div>
                {loadingLeads ? (
                  <p className="text-sm text-content-muted py-8 text-center">Searching leads…</p>
                ) : leads.length === 0 ? (
                  <p className="text-sm text-content-muted py-8 text-center">
                    {debouncedLeadSearch.trim().length >= 2 || initialLeadId ? 'No leads found' : 'Type at least 2 characters to search leads'}
                  </p>
                ) : (
                <VirtualizedList
                  items={leads}
                  estimateSize={76}
                  maxHeight="400px"
                  className="grid gap-2"
                  renderItem={(l) => (
                    <button
                      type="button"
                      onClick={() => selectLead(l)}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-xl border text-left transition-all w-full',
                        state.leadId === l._id
                          ? 'border-violet-500/50 bg-violet-500/10 ring-2 ring-violet-500/20'
                          : 'border-subtle hover:bg-surface-elevated'
                      )}
                    >
                      <Avatar name={l.name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{l.name}</p>
                        <p className="text-xs text-content-muted">{l.destination} · {formatINR(l.budget)}</p>
                      </div>
                    </button>
                  )}
                />
                )}
              </div>
            )}
            {step === 2 && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold">Select Package</h2>
                <p className="text-xs text-content-muted">
                  Packages matching lead destination from Uno Hotels catalog
                  {selectedLead?.destination ? (
                    <> — lead destination: <span className="font-medium text-content-primary">{selectedLead.destination}</span></>
                  ) : null}
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
                  <input
                    type="search"
                    value={packageSearch}
                    onChange={(e) => setPackageSearch(e.target.value)}
                    placeholder="Search packages by name or destination..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-subtle bg-surface text-sm outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                {loadingPackages ? (
                  <p className="text-sm text-content-muted py-8 text-center">Loading packages...</p>
                ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                  {packages.length === 0 ? (
                    <p className="text-sm text-content-muted py-8 text-center">No packages found for this lead destination.</p>
                  ) : packages.map((p) => (
                    <button
                      key={`${p.catalogSource || 'pkg'}-${p._id}`}
                      type="button"
                      onClick={() => selectPackage(p)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                        state.packageId === p._id
                          ? 'border-amber-500/50 bg-amber-500/10 ring-2 ring-amber-500/20'
                          : 'border-subtle hover:bg-surface-elevated'
                      )}
                    >
                      {p.coverImage ? (
                        <img src={p.coverImage} alt="" className="h-12 w-12 rounded-lg object-cover border border-subtle shrink-0" loading="lazy" />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-surface-elevated border border-subtle shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm line-clamp-1">{p.name}</p>
                        <p className="text-xs text-content-muted mt-0.5">
                          {p.destination} · {p.durationLabel || `${p.duration}D`} · from {formatINR(p.startingPrice)}
                        </p>
                      </div>
                      {p.catalogSource === 'custom' && (
                        <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-violet-500/10 text-violet-700 border border-violet-400/30">
                          Your copy
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8 pt-6 border-t border-subtle">
          <Button type="button" variant="outline" className="rounded-xl gap-2" disabled={step === 1} onClick={() => setStep((s) => s - 1)}><ArrowLeft className="w-4 h-4" /> Back</Button>
          {step === 1 ? (
            <Button type="button" variant="sky" className="rounded-xl gap-2" onClick={() => setStep(2)} disabled={!state.leadId}>Continue <ArrowRight className="w-4 h-4" /></Button>
          ) : (
            <Button type="button" variant="sky" className="rounded-xl gap-2" disabled={!state.packageId || loadingPackageDetail} onClick={() => state.packageId && setStep(3)}>
              Open Builder <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      )}

      <PackageBuilderOpeningOverlay
        open={loadingPackageDetail}
        packageName={openingPackageMeta.name}
        destination={openingPackageMeta.destination}
      />
    </div>
  );
}
