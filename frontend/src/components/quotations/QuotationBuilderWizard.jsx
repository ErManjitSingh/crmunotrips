import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Save, FileText, ExternalLink, SkipForward, Sparkles, Map, CheckCircle2, CircleOff, Search } from 'lucide-react';
import API from '../../api/axios';
import { Button } from '../ui/button';
import Avatar from '../ui/Avatar';
import VirtualizedList from '../ui/VirtualizedList';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { buildListParams, unwrapPagination } from '../../utils/apiHelpers';
import { fetchUnoPublicPackages, fetchUnoPublicPackageDetail } from '../../lib/unoPublicPackages';
import InclusionExclusionEditor, { cleanInclusionExclusionLines } from './InclusionExclusionEditor';
import QuotePricingPanel from './QuotePricingPanel';
import QuotePdfPreview from './QuotePdfPreview';
import DayWiseHotelSelector, { isDayWiseHotelsComplete, sumDayWiseHotelCost } from './DayWiseHotelSelector';
import { parsePackageNights } from './UnoHotelSelector';
import { WIZARD_STEPS } from './constants';
import { calculatePricing, defaultItineraryDay, defaultWizardState, formatINR, matchesResourceDestination } from './quotationUtils';
import { buildSelectedHotelsSnapshot } from './quotePdfHelpers';
import { unwrapList } from '../../utils/apiHelpers';
import ItineraryBuilder from '../packages/ItineraryBuilder';
import { cn } from '../../lib/utils';

const ADMIN_CONFIG = {
  leadsPath: '/leads',
  leadViewPath: (id) => `/leads/${id}`,
  savePath: '/quotations',
  backPath: '/quotations',
  successPath: '/quotations',
  title: 'Quotation Builder',
  subtitle: 'Salesforce CPQ-style quote wizard',
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
  title: 'Create Quotation',
  subtitle: 'First quote is auto-approved; revised quotes go to Team Leader for approval',
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
  title: 'Create Quotation',
  subtitle: 'Create a quote for your team — approved immediately',
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
  title: 'Create Quotation',
  subtitle: 'Create a quote for any team lead in your branch',
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
  const [cabs, setCabs] = useState([]);
  const [flights, setFlights] = useState([]);
  const [activities, setActivities] = useState([]);
  const [state, setState] = useState({ ...defaultWizardState });
  const [customItinerary, setCustomItinerary] = useState([]);
  const [customInclusions, setCustomInclusions] = useState([]);
  const [customExclusions, setCustomExclusions] = useState([]);
  const [customizeTab, setCustomizeTab] = useState('itinerary');
  const [selectedPkgDetail, setSelectedPkgDetail] = useState(null);
  const [dayWiseHotels, setDayWiseHotels] = useState([]);
  const [loadingPackageDetail, setLoadingPackageDetail] = useState(false);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [packageSearch, setPackageSearch] = useState('');
  const debouncedPackageSearch = useDebouncedValue(packageSearch, 350);
  const [saving, setSaving] = useState(false);

  const isMongoPackageId = (id) => id && /^[a-fA-F0-9]{24}$/.test(String(id));

  useEffect(() => {
    let cancelled = false;

    const loadResources = async () => {
      const requests = [
        API.get('/cabs', { skipErrorToast: true }),
        API.get('/flights', { skipErrorToast: true }),
        API.get('/activities', { skipErrorToast: true }),
      ];

      const results = await Promise.allSettled(requests);
      if (cancelled) return;

      const pick = (index) => (results[index].status === 'fulfilled' ? results[index].value.data : []);

      setCabs(unwrapList(pick(0)));
      setFlights(unwrapList(pick(1)));
      setActivities(unwrapList(pick(2)));
    };

    loadResources().catch(() => {
      if (!cancelled) {
        setCabs([]);
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
    }
  }, [initialLeadId]);

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
        limit: 100,
        page: 1,
        search: debouncedPackageSearch || undefined,
        destination,
      }),
      API.get('/packages', { skipErrorToast: true }),
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
      .catch(() => {
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
  });

  const selectLead = (lead) => {
    setState({ ...defaultWizardState, leadId: lead._id });
    setSelectedPkgDetail(null);
    setCustomItinerary([]);
    setCustomInclusions([]);
    setCustomExclusions([]);
    setCustomizeTab('itinerary');
    setDayWiseHotels([]);
  };

  const buildFallbackItinerary = (detail) => {
    const days = Math.max(1, Number(detail.duration) || 1);
    const destination = detail.destination || 'Destination';
    return Array.from({ length: days }, (_, index) =>
      defaultItineraryDay(index + 1, destination)
    );
  };

  const applyPackageDetail = (detail) => {
    const cloned = JSON.parse(JSON.stringify(detail));
    const itinerary =
      cloned.itinerary?.length > 0 ? cloned.itinerary : buildFallbackItinerary(cloned);
    const normalized = { ...cloned, itinerary };
    setSelectedPkgDetail(normalized);
    setCustomItinerary(itinerary.map((d) => ({ ...d })));
    setCustomInclusions(normalized.inclusions?.length ? [...normalized.inclusions] : ['']);
    setCustomExclusions(normalized.exclusions?.length ? [...normalized.exclusions] : ['']);
    setCustomizeTab('itinerary');
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
    setLoadingPackageDetail(true);
    try {
      let detail;
      if (pkg.catalogSource === 'custom' || isMongoPackageId(id)) {
        const res = await API.get(`/packages/${id}`, { skipErrorToast: true });
        detail = res.data;
      } else {
        detail = await fetchUnoPublicPackageDetail(pkg.slug || id);
      }
      applyPackageDetail(detail);
    } catch {
      applyPackageDetail(pkg);
    } finally {
      setLoadingPackageDetail(false);
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
    const cabCost = cabs.filter((c) => state.selectedCabIds.includes(c._id)).reduce((s, c) => s + (c.cost || 0), 0);
    const flightCost = flights.filter((f) => state.selectedFlightIds.includes(f._id)).reduce((s, f) => s + (f.cost || 0), 0);
    const activityCost = activities.filter((a) => state.selectedActivityIds.includes(a._id)).reduce((s, a) => s + (a.price || 0), 0);
    const calc = calculatePricing({ ...state.pricing, hotelCost, cabCost, flightCost, activityCost });
    setState((s) => ({ ...s, pricing: { ...s.pricing, hotelCost, cabCost, flightCost, activityCost, total: calc.total, profitMargin: calc.profitMargin } }));
  }, [state.selectedCabIds, state.selectedFlightIds, state.selectedActivityIds, cabs, flights, activities, state.pricing.baseCost, state.pricing.taxes, state.pricing.markup, state.pricing.discount, dayWiseHotels]);

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
        selectedCabs: cabs.filter((c) => state.selectedCabIds.includes(c._id)),
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
  } : null;

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-6">
        <Link to={config.backPath} className="p-2 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-600"><ArrowLeft className="w-4 h-4" /></Link>
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
          {WIZARD_STEPS.map((s) => (
            <div key={s.id} className={cn('flex items-center shrink-0', s.id < WIZARD_STEPS.length && 'flex-1')}>
              <button type="button" onClick={() => s.id <= step && setStep(s.id)} className={cn('flex flex-col items-center gap-1 px-2', s.id <= step ? 'cursor-pointer' : 'opacity-40')}>
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold', step === s.id ? 'bg-sky-600 text-white ring-4 ring-sky-500/20' : s.id < step ? 'bg-emerald-500 text-white' : 'bg-surface-elevated text-content-muted')}>{s.id}</div>
                <span className={cn('text-[9px] font-medium hidden sm:block', step === s.id && 'text-sky-600')}>{s.title}</span>
              </button>
              {s.id < WIZARD_STEPS.length && <div className={cn('h-0.5 flex-1 mx-1 min-w-[12px]', s.id < step ? 'bg-emerald-500' : 'bg-surface-elevated')} />}
            </div>
          ))}
        </div>
      </div>

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
                  <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm">
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-subtle bg-surface text-sm outline-none focus:ring-2 focus:ring-sky-500/30"
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
                          ? 'border-sky-500/50 bg-sky-500/10 ring-2 ring-sky-500/20'
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
                {loadingPackageDetail && (
                  <p className="text-xs text-amber-700">Loading package itinerary & details...</p>
                )}
              </div>
            )}
            {step === 3 && activePkg && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold">Customize Package</h2>
                  <p className="text-sm text-content-muted mt-1">Edit itinerary, inclusions & exclusions for this quote</p>
                </div>

                <div className="flex gap-1 p-1 rounded-2xl bg-surface-elevated/80 border border-subtle overflow-x-auto">
                  {[
                    { key: 'itinerary', label: 'Itinerary', icon: Map },
                    { key: 'inclusions', label: 'Inclusions', icon: CheckCircle2 },
                    { key: 'exclusions', label: 'Exclusions', icon: CircleOff },
                  ].map(({ key, label, icon: Icon }) => {
                    const active = customizeTab === key;
                    const count = key === 'itinerary'
                      ? customItinerary.length
                      : cleanInclusionExclusionLines(key === 'inclusions' ? customInclusions : customExclusions).length;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setCustomizeTab(key)}
                        className={cn(
                          'flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap min-w-[120px] flex-1 transition-all',
                          active && key === 'itinerary' && 'bg-sky-600 text-white shadow-sm',
                          active && key === 'inclusions' && 'bg-emerald-500 text-white shadow-sm',
                          active && key === 'exclusions' && 'bg-rose-500 text-white shadow-sm',
                          !active && 'text-content-muted hover:bg-surface-base'
                        )}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {label}
                        {count > 0 && (
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                            active ? 'bg-white/20 text-white' : 'bg-surface-elevated text-content-muted'
                          )}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {customizeTab === 'itinerary' && (
                  <div className="space-y-4">
                    <textarea
                      value={state.customizations}
                      onChange={(e) => setState({ ...state, customizations: e.target.value })}
                      rows={3}
                      placeholder="Special requests or notes for this quotation..."
                      className="input-premium w-full rounded-xl resize-none"
                    />
                    <ItineraryBuilder itinerary={customItinerary} onChange={setCustomItinerary} destination={activePkg.destination} />
                  </div>
                )}

                {customizeTab === 'inclusions' && (
                  <div className="rounded-2xl border border-subtle bg-surface-base p-4 sm:p-5">
                    <InclusionExclusionEditor
                      mode="inclusions"
                      inclusions={customInclusions}
                      exclusions={customExclusions}
                      onChangeInclusions={setCustomInclusions}
                      onChangeExclusions={setCustomExclusions}
                    />
                  </div>
                )}

                {customizeTab === 'exclusions' && (
                  <div className="rounded-2xl border border-subtle bg-surface-base p-4 sm:p-5">
                    <InclusionExclusionEditor
                      mode="exclusions"
                      inclusions={customInclusions}
                      exclusions={customExclusions}
                      onChangeInclusions={setCustomInclusions}
                      onChangeExclusions={setCustomExclusions}
                    />
                  </div>
                )}
              </div>
            )}
            {step === 4 && (
              <DayWiseHotelSelector
                destination={hotelDestination}
                value={dayWiseHotels}
                onChange={handleDayWiseHotelChange}
                nights={packageNights}
              />
            )}
            {step === 5 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold">Add Transport</h2>
                <p className="text-sm font-medium text-content-muted">Cabs</p>
                {cabs.map((c) => (
                  <button key={c._id} type="button" onClick={() => toggleId('selectedCabIds', c._id)} className={cn('w-full flex justify-between p-3 rounded-xl border text-left', state.selectedCabIds.includes(c._id) ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-subtle')}>
                    <span className="text-sm">{c.vehicleType} · {c.pickupLocation} → {c.dropLocation}</span>
                    <span className="font-bold text-sm">{formatINR(c.cost)}</span>
                  </button>
                ))}
                <p className="text-sm font-medium text-content-muted pt-2">Flights</p>
                {flights.map((f) => (
                  <button key={f._id} type="button" onClick={() => toggleId('selectedFlightIds', f._id)} className={cn('w-full flex justify-between p-3 rounded-xl border text-left', state.selectedFlightIds.includes(f._id) ? 'border-sky-500/50 bg-sky-500/10' : 'border-subtle')}>
                    <span className="text-sm">{f.airline} {f.flightNumber}</span>
                    <span className="font-bold text-sm">{formatINR(f.cost)}</span>
                  </button>
                ))}
              </div>
            )}
            {step === 6 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">Add Activities</h2>
                    <p className="text-sm text-content-muted mt-1">
                      {hotelDestination
                        ? `Optional extras for ${hotelDestination} — skip if none needed`
                        : 'Optional — skip if no activities apply to this quote'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl gap-1.5 shrink-0 self-start"
                    onClick={skipActivities}
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    Skip activities
                  </Button>
                </div>

                {state.activitiesSkipped && state.selectedActivityIds.length === 0 && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800">
                    Activities skipped for this quotation.
                  </div>
                )}

                {availableActivities.length === 0 ? (
                  <div className="text-center py-14 rounded-2xl border border-dashed border-subtle bg-surface-elevated/30">
                    <Sparkles className="w-10 h-10 mx-auto text-content-muted/40 mb-3" />
                    <p className="text-sm font-medium">No activities for this destination</p>
                    <p className="text-xs text-content-muted mt-1 max-w-sm mx-auto">
                      {hotelDestination
                        ? `Nothing is listed for ${hotelDestination} right now. You can skip and continue.`
                        : 'No activities available. Skip this step to continue.'}
                    </p>
                    <Button
                      type="button"
                      variant="sky"
                      className="rounded-xl gap-2 mt-5"
                      onClick={skipActivities}
                    >
                      <SkipForward className="w-4 h-4" />
                      Skip & Continue
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-[360px] overflow-y-auto">
                      {availableActivities.map((a) => (
                        <button
                          key={a._id}
                          type="button"
                          onClick={() => toggleId('selectedActivityIds', a._id)}
                          className={cn(
                            'w-full flex justify-between p-3 rounded-xl border text-left transition-colors',
                            state.selectedActivityIds.includes(a._id)
                              ? 'border-indigo-500/50 bg-indigo-500/10 ring-2 ring-indigo-500/20'
                              : 'border-subtle hover:bg-surface-elevated'
                          )}
                        >
                          <span className="text-sm">
                            {a.name}
                            {a.destination ? ` · ${a.destination}` : ''}
                            {a.duration ? ` · ${a.duration}` : ''}
                          </span>
                          <span className="font-bold text-sm shrink-0 ml-3">{formatINR(a.price)}</span>
                        </button>
                      ))}
                    </div>
                    <div className="pt-2 border-t border-subtle">
                      <button
                        type="button"
                        onClick={skipActivities}
                        className="text-sm text-content-muted hover:text-content-primary underline-offset-2 hover:underline"
                      >
                        Continue without adding activities
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {step === 7 && <div><h2 className="text-lg font-bold mb-4">Pricing</h2><QuotePricingPanel pricing={state.pricing} onChange={(p) => setState({ ...state, pricing: p })} /></div>}
            {step === 8 && draftQuote && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold">Generate Quote</h2>
                <div className="rounded-xl border border-subtle overflow-hidden max-h-[500px] overflow-y-auto bg-white">
                  <QuotePdfPreview quote={draftQuote} />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex justify-between mt-8 pt-6 border-t border-subtle">
          <Button type="button" variant="outline" className="rounded-xl gap-2" disabled={step === 1} onClick={() => setStep((s) => s - 1)}><ArrowLeft className="w-4 h-4" /> Back</Button>
          {step < 8 ? (
            <Button type="button" variant="sky" className="rounded-xl gap-2" onClick={() => setStep((s) => s + 1)} disabled={(step === 1 && !state.leadId) || (step === 2 && (!state.packageId || loadingPackageDetail)) || (step === 4 && !isDayWiseHotelsComplete(dayWiseHotels, packageNights))}>Continue <ArrowRight className="w-4 h-4" /></Button>
          ) : (
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="rounded-xl gap-2" disabled={saving} onClick={() => handleSave('draft')}><Save className="w-4 h-4" /> {config.draftLabel}</Button>
              <Button type="button" variant="emerald" className="rounded-xl gap-2" disabled={saving} onClick={() => handleSave('submit')}><FileText className="w-4 h-4" /> {config.submitLabel}</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
