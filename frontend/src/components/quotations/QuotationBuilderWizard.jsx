import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Search } from 'lucide-react';
import API from '../../api/axios';
import { Button } from '../ui/button';
import Avatar from '../ui/Avatar';
import VirtualizedList from '../ui/VirtualizedList';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { buildListParams, unwrapPagination } from '../../utils/apiHelpers';
import { fetchUnoPublicPackages, fetchUnoPublicPackageDetail, matchesPackageNameSearch } from '../../lib/unoPublicPackages';
import { logSelectedPackageDebug } from '../../lib/logPackageDebug';
import { resolvePackageItinerary, seedDayWiseHotelsFromItinerary } from '../../lib/packageItineraryMapper';
import { resolvePackageCabs, resolvePackageCabPricing } from '../../lib/packageCabMapper';
import InclusionExclusionEditor, { cleanInclusionExclusionLines } from './InclusionExclusionEditor';
import { resolvePackageHotelPricing } from './DayWiseHotelSelector';
import { buildSelectedCabSnapshot } from './UnoCabSelector';
import { parsePackageNights } from './UnoHotelSelector';
import { WIZARD_STEPS } from './constants';
import { calculatePricing, defaultItineraryDay, defaultWizardState, bakeCompanyMarginIntoLineCosts, formatINR, matchesResourceDestination } from './quotationUtils';
import { applyPartyCosting } from './partyCosting';
import { buildSelectedHotelsSnapshot } from './quotePdfHelpers';
import { hydrateWizardFromQuote } from './quotationHydrate';
import { unwrapList } from '../../utils/apiHelpers';
import PackageBuilderWorkspace from './PackageBuilderWorkspace';
import PackageBuilderOpeningOverlay from './PackageBuilderOpeningOverlay';
import { cn } from '../../lib/utils';
import {
  invalidateLeadDetail,
  invalidateLeadLists,
  invalidateNavCounts,
} from '../../lib/queryInvalidation';
import { PACKAGES_PAGE_SIZE } from '../ui/TablePagination';

const ADMIN_CONFIG = {
  leadsPath: '/leads',
  leadViewPath: (id) => `/leads/${id}`,
  savePath: '/quotations',
  getPath: (id) => `/quotations/${id}`,
  editPath: (id) => `/quotations/${id}`,
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
  getPath: (id) => `/sales-executive/quotations/${id}`,
  editPath: (id) => `/sales-executive/quotations/${id}`,
  backPath: '/sales-executive/quotations',
  successPath: '/sales-executive/quotations',
  title: 'Package Builder',
  subtitle: 'Lead auto-loads into a GTrip-style tour package builder with live hotels, cabs & pricing',
  draftStatus: 'draft',
  submitStatus: 'pending_approval',
  draftLabel: 'Save Draft',
  submitLabel: 'Submit Quotation',
  approvalNote: 'The first quotation for a lead is approved automatically. From the second quote onward, Team Leader approval is required — you must share a reason before you can submit.',
};

const TEAM_LEADER_CONFIG = {
  leadsPath: '/team-leader/leads',
  leadViewPath: (id) => `/team-leader/leads/${id}/view`,
  leadsParams: { filter: 'all', page: 1, limit: 50 },
  savePath: '/team-leader/quotations',
  getPath: (id) => `/team-leader/quotations/${id}`,
  editPath: (id) => `/team-leader/quotations/${id}`,
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
  getPath: (id) => `/sales-manager/quotations/${id}`,
  editPath: (id) => `/sales-manager/quotations/${id}`,
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
  const queryClient = useQueryClient();
  const { id: routeQuoteId } = useParams();
  const [searchParams] = useSearchParams();
  const initialLeadId = searchParams.get('leadId');
  const editQuoteId = routeQuoteId || searchParams.get('edit') || null;
  const isEditMode = Boolean(editQuoteId);
  const [step, setStep] = useState(1);
  const [leads, setLeads] = useState([]);
  const [leadSearch, setLeadSearch] = useState('');
  const debouncedLeadSearch = useDebouncedValue(leadSearch, 500);
  const [loadingLeads, setLoadingLeads] = useState(false);
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
  const [packageSearch, setPackageSearch] = useState('');
  const [packagePage, setPackagePage] = useState(0);
  const debouncedPackageSearch = useDebouncedValue(packageSearch, 350);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEditMode);
  const [editMeta, setEditMeta] = useState({ quoteNumber: '', status: '' });
  const [resubmissionReason, setResubmissionReason] = useState('');
  const [needsResubmissionReason, setNeedsResubmissionReason] = useState(false);
  const hydratedEditRef = useRef(false);

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

  const fetchLeads = useCallback(async (searchTerm, { packageShared = false } = {}) => {
    setLoadingLeads(true);
    try {
      const baseParams = config.leadsParams || { page: 1, limit: 50 };
      const params = buildListParams({
        page: 1,
        limit: 50,
        filters: {
          ...baseParams,
          filter: packageShared ? 'package-shared' : baseParams.filter,
          packageShared: packageShared ? '1' : undefined,
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
      // Default: leads that already had packages/quotations shared
      fetchLeads('', { packageShared: true });
    }
  }, [step, debouncedLeadSearch, initialLeadId, fetchLeads]);

  useEffect(() => {
    if (initialLeadId && !isEditMode) {
      setState((s) => ({ ...s, leadId: initialLeadId }));
      setStep(2);
    }
  }, [initialLeadId, isEditMode]);

  useEffect(() => {
    if (!editQuoteId || !config.getPath || hydratedEditRef.current) return undefined;
    let cancelled = false;
    setLoadingEdit(true);
    (async () => {
      try {
        const { data: quote } = await API.get(config.getPath(editQuoteId), { skipErrorToast: true });
        if (cancelled || !quote) return;
        const hydrated = hydrateWizardFromQuote(quote);
        if (!hydrated) return;

        hydratedEditRef.current = true;
        setEditMeta({ quoteNumber: hydrated.quoteNumber, status: hydrated.status });
        if (hydrated.lead) {
          setLeads((prev) => {
            const id = String(hydrated.lead._id);
            if (prev.some((l) => String(l._id) === id)) return prev;
            return [hydrated.lead, ...prev];
          });
        }
        setState((s) => ({
          ...s,
          leadId: hydrated.leadId,
          packageId: hydrated.packageId,
          customizations: hydrated.customizations,
          selectedFlightIds: hydrated.selectedFlightIds,
          selectedActivityIds: hydrated.selectedActivityIds,
          pricing: {
            ...s.pricing,
            ...hydrated.pricing,
            ...calculatePricing({ ...s.pricing, ...hydrated.pricing }),
          },
        }));
        setSelectedPkgDetail(hydrated.packageDetail);
        setCustomItinerary(hydrated.customItinerary);
        setCustomInclusions(hydrated.customInclusions);
        setCustomExclusions(hydrated.customExclusions);
        setDayWiseHotels(hydrated.dayWiseHotels);
        setSelectedUnoCab(hydrated.selectedUnoCab);
        setOpeningPackageMeta({
          name: hydrated.packageDetail?.name || 'Package',
          destination: hydrated.packageDetail?.destination || hydrated.lead?.destination || '',
        });
        setStep(3);
      } catch {
        if (!cancelled) navigate(config.backPath, { replace: true });
      } finally {
        if (!cancelled) setLoadingEdit(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editQuoteId, config, navigate, isEditMode]);

  useEffect(() => {
    if (!initialLeadId || isEditMode) return undefined;
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

  const selectedLead = leads.find((l) => String(l._id) === String(state.leadId));

  useEffect(() => {
    if (mode !== 'executive' || !state.leadId) {
      setNeedsResubmissionReason(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await API.get(`/sales-executive/leads/${state.leadId}/quotations`, {
          skipErrorToast: true,
          skipSuccessToast: true,
        });
        const rows = Array.isArray(data)
          ? data
          : data?.quotations || data?.data || [];
        const prior = rows.filter((q) => {
          if (!q || q.status === 'draft') return false;
          if (editQuoteId && String(q._id) === String(editQuoteId)) return false;
          return true;
        });
        if (!cancelled) {
          setNeedsResubmissionReason(prior.length > 0);
          if (prior.length === 0) setResubmissionReason('');
        }
      } catch {
        if (!cancelled) setNeedsResubmissionReason(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, state.leadId, editQuoteId]);

  const packageDestination = selectedLead?.destination?.trim() || '';
  const packagesQuery = useQuery({
    queryKey: ['quotation-packages', packageDestination],
    enabled: step === 2 && Boolean(packageDestination),
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    queryFn: async () => {
      const destination = packageDestination;
      const [unoResult, localRes] = await Promise.all([
        fetchUnoPublicPackages({
          limit: 50,
          page: 1,
          destination,
        }),
        API.get('/packages', {
          params: { sourceType: 'uno_clone' },
          skipErrorToast: true,
        }).catch(() => ({ data: [] })),
      ]);
      const matchDest = (p) => {
        const hasDest = String(p.destination || p.destinationName || '').trim();
        return Boolean(hasDest) && matchesResourceDestination(p, destination);
      };
      const uno = (unoResult.items || [])
        .filter(matchDest)
        .map((p) => ({
          ...p,
          _id: p._id || p.id,
          catalogSource: 'uno',
        }));
      const customs = unwrapList(localRes.data)
        .filter((p) => matchDest(p))
        .map((p) => ({ ...p, catalogSource: 'custom' }));
      return [...customs, ...uno];
    },
  });

  const packages = packagesQuery.data || [];
  const loadingPackages = packagesQuery.isFetching && !packagesQuery.data;

  useEffect(() => {
    if (step === 2) setPackagePage(0);
  }, [step, packageDestination]);

  const filteredPackages = useMemo(() => {
    const q = debouncedPackageSearch.trim();
    if (!q) return packages;
    return packages.filter((p) => matchesPackageNameSearch(p, q));
  }, [packages, debouncedPackageSearch]);

  const selectedPkg = packages.find((p) => String(p._id) === String(state.packageId));
  const activePkg = selectedPkgDetail || selectedPkg;
  const packageNights = parsePackageNights(activePkg);
  const hotelDestination = selectedLead?.destination || activePkg?.destination || '';
  const availableActivities = activities.filter((activity) =>
    matchesResourceDestination(activity, hotelDestination)
  );

  const packagePageCount = Math.max(1, Math.ceil(filteredPackages.length / PACKAGES_PAGE_SIZE));
  const safePackagePage = Math.min(packagePage, packagePageCount - 1);
  const pagedPackages = useMemo(() => {
    const start = safePackagePage * PACKAGES_PAGE_SIZE;
    return filteredPackages.slice(start, start + PACKAGES_PAGE_SIZE);
  }, [filteredPackages, safePackagePage]);
  const packageShowingFrom = filteredPackages.length === 0 ? 0 : safePackagePage * PACKAGES_PAGE_SIZE + 1;
  const packageShowingTo = Math.min((safePackagePage + 1) * PACKAGES_PAGE_SIZE, filteredPackages.length);

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

    setState((s) => {
      // Raw package base; company margin is baked into hotel/cab line costs (hidden from SE)
      const packageStart = Number(
        normalized.baseStartingPrice ?? normalized.startingPrice ?? 0
      );
      const adminMarginPct = Number(normalized.destinationMarginPercent || 0) || 0;
      // Peel cab first from full package so Cab Cost stays visible; then hotels from remainder.
      const transport = resolvePackageCabPricing(packageStart, defaultCab, packageCabs);
      const unit = resolvePackageHotelPricing(transport.baseCost, seededHotels);
      const party = applyPartyCosting({
        unitBaseCost: unit.baseCost,
        unitHotelCost: unit.hotelCost,
        unitCabCost: transport.cabCost,
        lead: selectedLead,
        pkg: {
          ...normalized,
          startingPrice: packageStart,
          baseStartingPrice: packageStart,
        },
        cabSeats: defaultCab?.seatingCapacity || 4,
        dayWiseHotels: seededHotels,
      });
      // Hotel cost stays hotel-only (+ admin margin later); residual stays in baseCost.
      const rawPricing = {
        ...s.pricing,
        baseCost: 0,
        hotelCost: party.hotelCost,
        cabCost: party.cabCost,
        flightCost: 0,
        activityCost: 0,
        markupPercent: Number(s.pricing.markupPercent || 0) || 0,
        party: {
          adults: party.adults,
          children: party.children,
          travelers: party.travelers,
          rooms: party.rooms,
          mattresses: party.mattresses,
          cabCount: party.cabCount,
          cabSeats: party.cabSeats,
          perPersonRate: party.perPersonRate,
        },
      };
      const nextPricing = bakeCompanyMarginIntoLineCosts(rawPricing, adminMarginPct);
      return {
        ...s,
        pricing: {
          ...nextPricing,
          ...calculatePricing(nextPricing),
        },
      };
    });
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
    // Unmargined package base; company margin baked into hotel/cab lines (hidden from SE)
    const packageAnchor = Number(
      selectedPkgDetail?.baseStartingPrice ?? selectedPkgDetail?.startingPrice ?? 0
    );
    const packageCabs = resolvePackageCabs(selectedPkgDetail || {});
    // Peel cab first from full package so Cab Cost stays visible; then hotels from remainder.
    const transport = resolvePackageCabPricing(packageAnchor, selectedUnoCab, packageCabs);
    const unit = resolvePackageHotelPricing(transport.baseCost, dayWiseHotels);
    const flightCost = flights
      .filter((f) => state.selectedFlightIds.includes(f._id))
      .reduce((s, f) => s + (f.cost || 0), 0);
    const activityCost = activities
      .filter((a) => state.selectedActivityIds.includes(a._id))
      .reduce((s, a) => s + (a.price || 0), 0);
    const adminMarginPct =
      Number(
        selectedPkgDetail?.destinationMarginPercent ??
          state.pricing.companyMarginBakedPercent ??
          0
      ) || 0;
    const party = applyPartyCosting({
      unitBaseCost: unit.baseCost,
      unitHotelCost: unit.hotelCost,
      unitCabCost: transport.cabCost,
      flightCost,
      activityCost,
      lead: selectedLead,
      pkg: {
        ...(selectedPkgDetail || {}),
        startingPrice: packageAnchor,
        baseStartingPrice: packageAnchor,
      },
      cabSeats: selectedUnoCab?.seatingCapacity || 4,
      dayWiseHotels,
    });
    // Hotel cost = hotel (+ mattress) only; package residual / flights stay separate.
    const rawPricing = {
      baseCost: 0,
      hotelCost: party.hotelCost,
      cabCost: party.cabCost,
      flightCost: party.flightCost,
      activityCost: party.activityCost,
      markupPercent: Number(state.pricing.markupPercent || 0) || 0,
      discount: Number(state.pricing.discount || 0) || 0,
      gstEnabled: Boolean(state.pricing.gstEnabled),
      markup: 0,
    };
    const baked = bakeCompanyMarginIntoLineCosts(rawPricing, adminMarginPct);
    const calc = calculatePricing(baked);

    setState((s) => {
      const nextPricing = {
        ...s.pricing,
        baseCost: baked.baseCost,
        hotelCost: baked.hotelCost,
        cabCost: baked.cabCost,
        flightCost: baked.flightCost,
        activityCost: baked.activityCost,
        adminMarginPercent: 0,
        companyMarginBaked: baked.companyMarginBaked,
        companyMarginBakedPercent: baked.companyMarginBakedPercent,
        taxes: calc.taxes,
        markup: calc.markup,
        total: calc.total,
        profitMargin: calc.profitMargin,
        party: {
          adults: party.adults,
          children: party.children,
          travelers: party.travelers,
          rooms: party.rooms,
          mattresses: party.mattresses,
          cabCount: party.cabCount,
          cabSeats: party.cabSeats,
          perPersonRate: party.perPersonRate,
        },
      };

      const prev = s.pricing || {};
      const same =
        Number(prev.baseCost || 0) === Number(nextPricing.baseCost || 0) &&
        Number(prev.hotelCost || 0) === Number(nextPricing.hotelCost || 0) &&
        Number(prev.cabCost || 0) === Number(nextPricing.cabCost || 0) &&
        Number(prev.flightCost || 0) === Number(nextPricing.flightCost || 0) &&
        Number(prev.activityCost || 0) === Number(nextPricing.activityCost || 0) &&
        Number(prev.companyMarginBakedPercent || 0) ===
          Number(nextPricing.companyMarginBakedPercent || 0) &&
        Number(prev.taxes || 0) === Number(nextPricing.taxes || 0) &&
        Number(prev.markup || 0) === Number(nextPricing.markup || 0) &&
        Number(prev.total || 0) === Number(nextPricing.total || 0) &&
        Number(prev.party?.rooms || 0) === Number(nextPricing.party?.rooms || 0) &&
        Number(prev.party?.cabCount || 0) === Number(nextPricing.party?.cabCount || 0) &&
        Number(prev.party?.adults || 0) === Number(nextPricing.party?.adults || 0);

      if (same) return s;
      return { ...s, pricing: nextPricing };
    });
    // Intentionally omit taxes/markup/total — those are outputs of this effect
  }, [
    selectedUnoCab,
    selectedPkgDetail,
    selectedLead,
    state.selectedFlightIds,
    state.selectedActivityIds,
    flights,
    activities,
    state.pricing.discount,
    state.pricing.gstEnabled,
    state.pricing.markupPercent,
    dayWiseHotels,
  ]);

  const handleSave = async (saveAs) => {
    if (!state.leadId || !state.packageId) return;
    const status = saveAs === 'draft' ? config.draftStatus : config.submitStatus;
    if (
      mode === 'executive' &&
      saveAs === 'submit' &&
      needsResubmissionReason &&
      !resubmissionReason.trim()
    ) {
      return;
    }
    setSaving(true);
    try {
      const payload = {
        quoteNumber: isEditMode && editMeta.quoteNumber
          ? editMeta.quoteNumber
          : `Q-${Date.now().toString().slice(-6)}`,
        leadId: state.leadId,
        packageId: isMongoPackageId(state.packageId) ? state.packageId : null,
        status,
        pricing: state.pricing,
        selectedHotels: buildSelectedHotelsSnapshot(dayWiseHotels, {
          rooms: state.pricing?.party?.rooms || 1,
          mattresses: state.pricing?.party?.mattresses || 0,
        }),
        selectedCabs: buildSelectedCabSnapshot(selectedUnoCab, {
          vehicleCount: state.pricing?.party?.cabCount || selectedUnoCab?._vehicleCount || 1,
          travelers: state.pricing?.party?.travelers,
        }),
        selectedFlights: flights.filter((f) => state.selectedFlightIds.includes(f._id)),
        selectedActivities: activities.filter((a) => state.selectedActivityIds.includes(a._id)),
        package: buildPackageSnapshot(activePkg),
        customizations: state.customizations,
        ...(mode === 'executive' && saveAs === 'submit' && needsResubmissionReason
          ? { resubmissionReason: resubmissionReason.trim() }
          : {}),
      };

      let res;
      if (isEditMode && editQuoteId && config.editPath) {
        if (mode === 'executive') {
          res = await API.put(config.editPath(editQuoteId), {
            action: 'edit',
            data: payload,
          });
        } else {
          res = await API.put(config.editPath(editQuoteId), payload);
        }
      } else {
        res = await API.post(config.savePath, payload);
      }

      const savedStatus = res.data?.status;
      const leadId = state.leadId || res.data?.lead?._id || res.data?.lead;
      const message = isEditMode
        ? savedStatus === 'draft'
          ? 'Quotation updated and saved as draft.'
          : savedStatus === 'pending_approval'
            ? 'Quotation updated and submitted for approval.'
            : savedStatus === 'approved'
              ? 'Quotation updated and approved.'
              : savedStatus === 'sent'
                ? 'Quotation updated and sent.'
                : 'Quotation updated.'
        : savedStatus === 'approved'
          ? 'First quotation created and approved. You can send it to the customer.'
          : savedStatus === 'pending_approval'
            ? 'Quotation submitted for approval. It is now on the lead activity timeline.'
            : savedStatus === 'sent'
              ? 'Quotation saved and sent. Check the lead activity timeline.'
              : 'Quotation saved as draft.';

      if (leadId) {
        await Promise.all([
          invalidateLeadDetail(queryClient, leadId),
          invalidateLeadLists(queryClient),
          invalidateNavCounts(queryClient),
          queryClient.invalidateQueries({ queryKey: ['lead-quotations'] }),
        ]);
      }

      const successUrl = leadId
        ? config.leadViewPath(String(leadId))
        : mode === 'executive'
          ? config.successPath
          : `${config.successPath}?view=${res.data._id}`;

      navigate(successUrl, {
        replace: true,
        state: {
          message,
          focusTimeline: Boolean(leadId),
          quotationId: res.data?._id || editQuoteId,
        },
      });
    } catch (err) {
      /* toast via axios */
    } finally {
      setSaving(false);
    }
  };

  const draftQuote = selectedLead && activePkg ? {
    quoteNumber: isEditMode && editMeta.quoteNumber ? editMeta.quoteNumber : 'PREVIEW',
    createdAt: new Date().toISOString(),
    lead: selectedLead,
    package: buildPackageSnapshot(activePkg),
    pricing: state.pricing,
    selectedHotels: buildSelectedHotelsSnapshot(dayWiseHotels, {
      rooms: state.pricing?.party?.rooms || 1,
      mattresses: state.pricing?.party?.mattresses || 0,
    }),
    selectedCabs: buildSelectedCabSnapshot(selectedUnoCab, {
      vehicleCount: state.pricing?.party?.cabCount || 1,
      travelers: state.pricing?.party?.travelers,
    }),
  } : null;

  const inBuilder = step >= 3 && Boolean(activePkg);

  if (loadingEdit) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        <p className="text-sm text-content-muted">Loading quotation for edit…</p>
      </div>
    );
  }

  return (
    <div className={cn(
      inBuilder
        ? 'mx-auto max-w-[1440px] pb-0'
        : 'mx-auto max-w-4xl px-3 pt-3 pb-28 sm:px-0 sm:pt-0 xl:pb-12',
    )}
    >
      {!inBuilder && (
        <>
          <div className="mb-4 flex items-start gap-3 sm:mb-6">
            <Link
              to={config.backPath}
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-600"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-content-primary sm:text-2xl">
                {isEditMode ? 'Edit Quotation' : config.title}
              </h1>
              <p className="mt-0.5 text-xs text-content-muted sm:text-sm line-clamp-2">
                {isEditMode && editMeta.quoteNumber
                  ? `Updating ${editMeta.quoteNumber} — change package, hotels, pricing and resave`
                  : config.subtitle}
              </p>
              {config.approvalNote && !isEditMode && (
                <p className="mt-2 max-w-xl rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 sm:text-xs">
                  {config.approvalNote}
                </p>
              )}
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-subtle bg-surface/80 p-3 sm:mb-6 sm:p-4">
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {WIZARD_STEPS.filter((s) => s.id <= 3 || s.id === 8).map((s, idx, arr) => (
                <div key={s.id} className={cn('flex items-center shrink-0', idx < arr.length - 1 && 'flex-1')}>
                  <button
                    type="button"
                    onClick={() => s.id <= step && setStep(s.id === 8 ? 3 : s.id)}
                    className={cn(
                      'flex flex-col items-center gap-1 px-1.5 sm:px-2',
                      s.id <= step || (s.id === 8 && step >= 3) ? 'cursor-pointer' : 'opacity-40',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                        step === s.id || (s.id === 3 && step >= 3)
                          ? 'bg-violet-600 text-white ring-4 ring-violet-500/20'
                          : s.id < step
                            ? 'bg-emerald-500 text-white'
                            : 'bg-surface-elevated text-content-muted',
                      )}
                    >
                      {idx + 1}
                    </div>
                    <span
                      className={cn(
                        'text-[9px] font-medium',
                        (step === s.id || (s.id === 3 && step >= 3)) && 'text-violet-600',
                      )}
                    >
                      {s.id === 3 ? 'Builder' : s.id === 1 ? 'Lead' : s.id === 2 ? 'Package' : s.title}
                    </span>
                  </button>
                  {idx < arr.length - 1 && (
                    <div
                      className={cn(
                        'mx-1 h-0.5 min-w-[12px] flex-1',
                        s.id < step || step >= 3 ? 'bg-emerald-500' : 'bg-surface-elevated',
                      )}
                    />
                  )}
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
          draftLabel={isEditMode ? 'Update Draft' : config.draftLabel}
          submitLabel={isEditMode ? 'Update & Submit' : config.submitLabel}
          emailEndpoint={emailEndpointForMode(mode)}
          needsResubmissionReason={mode === 'executive' && needsResubmissionReason}
          resubmissionReason={resubmissionReason}
          onResubmissionReasonChange={setResubmissionReason}
          disableSubmit={
            mode === 'executive' && needsResubmissionReason && !resubmissionReason.trim()
          }
        />
      ) : (
      <div className="min-h-[360px] rounded-2xl border border-subtle bg-surface p-4 shadow-lg sm:min-h-[400px] sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            {step === 1 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold sm:text-lg">Select Lead</h2>
                  {state.leadId && config.leadViewPath && (
                    <Link
                      to={config.leadViewPath(state.leadId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 hover:underline"
                    >
                      View Lead <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
                <p className="text-xs text-content-muted">
                  {debouncedLeadSearch.trim().length >= 2
                    ? 'Search results'
                    : 'Leads that already received a package / quotation — search to find others'}
                </p>
                {selectedLead && (
                  <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 px-3.5 py-3 text-sm sm:px-4">
                    <p className="font-semibold text-content-primary">{selectedLead.name}</p>
                    <p className="mt-0.5 text-xs text-content-muted">{selectedLead.destination} · {formatINR(selectedLead.budget)}</p>
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                  <input
                    type="search"
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    placeholder="Search name, phone, destination…"
                    className="w-full rounded-xl border border-subtle bg-surface py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                </div>
                {loadingLeads ? (
                  <p className="py-8 text-center text-sm text-content-muted">Searching leads…</p>
                ) : leads.length === 0 ? (
                  <p className="py-8 text-center text-sm text-content-muted">
                    {debouncedLeadSearch.trim().length >= 2
                      ? 'No leads found'
                      : 'No package-shared leads yet — type at least 2 characters to search all leads'}
                  </p>
                ) : (
                <VirtualizedList
                  items={leads}
                  estimateSize={76}
                  maxHeight="min(50dvh, 400px)"
                  className="grid gap-2"
                  renderItem={(l) => (
                    <button
                      type="button"
                      onClick={() => selectLead(l)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all sm:p-4',
                        state.leadId === l._id
                          ? 'border-violet-500/50 bg-violet-500/10 ring-2 ring-violet-500/20'
                          : 'border-subtle hover:bg-surface-elevated',
                      )}
                    >
                      <Avatar name={l.name} size="sm" />
                      <div className="min-w-0 flex-1">
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
                <h2 className="text-base font-bold sm:text-lg">Select Package</h2>
                <p className="text-xs text-content-muted">
                  Packages related to lead destination (state and its cities)
                  {selectedLead?.destination ? (
                    <> — <span className="font-medium text-content-primary">{selectedLead.destination}</span></>
                  ) : null}
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
                  <input
                    type="search"
                    value={packageSearch}
                    onChange={(e) => {
                      setPackageSearch(e.target.value);
                      setPackagePage(0);
                    }}
                    placeholder="Search by name or days (e.g. Goa, 3 days, 3D)…"
                    className="w-full rounded-xl border border-subtle bg-surface py-3 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>
                {loadingPackages ? (
                  <p className="py-8 text-center text-sm text-content-muted">Loading packages...</p>
                ) : (
                <>
                <div className="max-h-[min(50dvh,420px)] space-y-2 overflow-y-auto">
                  {filteredPackages.length === 0 ? (
                    <p className="py-8 text-center text-sm text-content-muted">
                      {packages.length === 0
                        ? 'No packages found for this lead destination.'
                        : 'No packages match your search. Try another keyword from the package name.'}
                    </p>
                  ) : pagedPackages.map((p) => (
                    <button
                      key={`${p.catalogSource || 'pkg'}-${p._id}`}
                      type="button"
                      onClick={() => selectPackage(p)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all',
                        state.packageId === p._id
                          ? 'border-amber-500/50 bg-amber-500/10 ring-2 ring-amber-500/20'
                          : 'border-subtle hover:bg-surface-elevated',
                      )}
                    >
                      {p.coverImage ? (
                        <img src={p.coverImage} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-subtle object-cover" loading="lazy" />
                      ) : (
                        <div className="h-14 w-14 shrink-0 rounded-lg border border-subtle bg-surface-elevated" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-semibold">{p.name}</p>
                        <p className="mt-0.5 text-xs text-content-muted">
                          {p.destination} · {p.durationLabel || `${p.duration}D`} · from {formatINR(p.startingPrice)}
                        </p>
                      </div>
                      {p.catalogSource === 'custom' && (
                        <span className="shrink-0 rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] font-bold uppercase text-violet-700">
                          Your copy
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {filteredPackages.length > PACKAGES_PAGE_SIZE && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <p className="text-xs text-content-muted">
                      Showing {packageShowingFrom}–{packageShowingTo} of {filteredPackages.length}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={safePackagePage <= 0}
                        onClick={() => setPackagePage((p) => Math.max(0, p - 1))}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-subtle bg-white px-2.5 text-xs font-medium disabled:opacity-40 dark:bg-slate-950"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Prev
                      </button>
                      <span className="px-2 text-xs font-semibold tabular-nums text-content-secondary">
                        {safePackagePage + 1}/{packagePageCount}
                      </span>
                      <button
                        type="button"
                        disabled={safePackagePage >= packagePageCount - 1}
                        onClick={() => setPackagePage((p) => Math.min(packagePageCount - 1, p + 1))}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-subtle bg-white px-2.5 text-xs font-medium disabled:opacity-40 dark:bg-slate-950"
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
                </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Desktop footer */}
        <div className="mt-8 hidden justify-between border-t border-subtle pt-6 xl:flex">
          <Button type="button" variant="outline" className="gap-2 rounded-xl" disabled={step === 1} onClick={() => setStep((s) => s - 1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
          {step === 1 ? (
            <Button type="button" variant="sky" className="gap-2 rounded-xl" onClick={() => setStep(2)} disabled={!state.leadId}>Continue <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <Button type="button" variant="sky" className="gap-2 rounded-xl" disabled={!state.packageId || loadingPackageDetail} onClick={() => state.packageId && setStep(3)}>
              Open Builder <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      )}

      {!inBuilder ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-100/80 bg-white/95 px-3 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))] shadow-[0_-10px_32px_rgba(15,23,42,0.14)] backdrop-blur-md xl:hidden">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0 gap-1.5 rounded-xl px-3"
              disabled={step === 1}
              onClick={() => setStep((s) => s - 1)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {step === 1 ? (
              <Button
                type="button"
                variant="sky"
                className="h-11 flex-1 gap-2 rounded-xl"
                onClick={() => setStep(2)}
                disabled={!state.leadId}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="sky"
                className="h-11 flex-1 gap-2 rounded-xl"
                disabled={!state.packageId || loadingPackageDetail}
                onClick={() => state.packageId && setStep(3)}
              >
                Open Builder <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <PackageBuilderOpeningOverlay
        open={loadingPackageDetail}
        packageName={openingPackageMeta.name}
        destination={openingPackageMeta.destination}
      />
    </div>
  );
}
