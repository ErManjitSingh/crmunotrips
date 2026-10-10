import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizardForm } from '../WizardFormContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, User, Phone, MapPin, Plane, Calendar, UtensilsCrossed,
  Mail, Building2, Compass, Zap, Shield, TrendingUp, MessageCircle,
  Users, History, X, UserCheck, Briefcase,
} from 'lucide-react';
import { checkLeadDuplicate } from '../../../services/leadEnterpriseApi';
import DuplicateLeadWarning from '../../leads/DuplicateLeadWarning';
import { useAuth } from '../../../context/AuthContext';
import { useSelector } from 'react-redux';
import WizardField, { WizardInput, IconInput, IconSelect, WizardTextarea } from '../WizardField';
import {
  INDIAN_STATES, DESTINATIONS, LEAD_TYPES, LEAD_SOURCES, PRIORITIES,
  HOTEL_CATEGORY_OPTIONS, CAB_TYPE_OPTIONS, MEAL_PLAN_OPTIONS, FOOD_PREFERENCE_OPTIONS, filterPickupDropSuggestions, INTENT_LABEL,
  getLeadSourcesForRole, defaultLeadSourceForRole, REFERRAL_RELATIONSHIPS,
} from '../constants';
import { calcTourDays } from '../leadWizardUtils';
import { calculateLeadScore, LEAD_SCORE_CATEGORY_META } from '../leadScoreCalculator';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { buildListParams, unwrapPagination } from '../../../utils/apiHelpers';
import API from '../../../api/axios';
import { cn } from '../../../lib/utils';

function normalizePhone(p) {
  return p?.replace(/\D/g, '').slice(-10) || '';
}

/** One outer card (Customer Information / Travel Information) that its numbered steps live inside. */
function InfoCard({ icon: Icon, iconWrap, title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', iconWrap)}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 leading-tight">{title}</h3>
          <p className="text-xs text-slate-500 leading-tight">{subtitle}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/**
 * One numbered sub-section of the Customer Information card — not its own card. `first` drops the
 * top divider/padding so Step 1 sits flush under the card header.
 */
function StepSection({ id, number, title, subtitle, children, first }) {
  return (
    <div id={id} className={cn('scroll-mt-24', !first && 'mt-3 pt-3 border-t border-slate-100')}>
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#5D5FEF] text-white flex items-center justify-center shrink-0 text-xs font-bold">
          {number}
        </div>
        <div className="leading-tight">
          <h4 className="text-sm font-bold text-slate-900 leading-tight">Step {number} · {title}</h4>
          {subtitle && <p className="text-[11px] text-slate-500 leading-tight">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Step 6 · Lead Score — automatically calculated from Customer + Travel Information above.
 * Never manually entered; recalculates live as the executive fills the form (see
 * leadScoreCalculator.js). The backend recalculates the authoritative value on save.
 */
function LeadScoreCard({ values }) {
  const { score, category, breakdown } = calculateLeadScore(values);
  const meta = LEAD_SCORE_CATEGORY_META[category];
  const remaining = 100 - score;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#5D5FEF] text-white flex items-center justify-center shrink-0 text-xs font-bold">
          6
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 leading-tight">Step 6 · Lead Score</h3>
          <p className="text-xs text-slate-500 leading-tight">Automatically calculated from customer &amp; travel details</p>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center gap-3">
          <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none">
            {score}<span className="text-sm font-semibold text-slate-400">/100</span>
          </p>
          <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', meta.badgeClass)}>
            {meta.label}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
          {Object.values(breakdown).map((cat) => (
            <div key={cat.label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{cat.label}</span>
                <span className="text-[11px] font-bold tabular-nums text-slate-600">{cat.score}/{cat.max}</span>
              </div>
              <div className="space-y-0.5">
                {cat.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2 text-[11px] leading-tight">
                    <span className={cn('flex min-w-0 items-center gap-1.5 truncate', item.earned ? 'text-emerald-700' : 'text-rose-500')}>
                      <span className={cn('shrink-0', item.earned ? 'text-emerald-500' : 'text-rose-400')}>
                        {item.earned ? '✓' : '○'}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className={cn('shrink-0 tabular-nums font-semibold', item.earned ? 'text-emerald-600' : 'text-rose-500')}>
                      +{item.points}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] font-semibold text-slate-600">
            {remaining > 0 ? `${remaining} points remaining` : 'Maximum score reached'}
          </p>
          {remaining > 0 && (
            <p className="mt-0.5 text-[10px] text-slate-400">Complete the missing details to increase Lead Score.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Chip({ active, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-all',
        active
          ? 'border-[#5D5FEF]/45 bg-[#5D5FEF]/10 text-[#5D5FEF] shadow-sm'
          : 'border-slate-200 bg-white text-slate-500 hover:border-[#5D5FEF]/25 hover:bg-[#5D5FEF]/5',
        className
      )}
    >
      {children}
    </button>
  );
}

/** Same role → leads-endpoint mapping LeadWizard.jsx uses for load/save — reused here so the
 *  referrer search can never see more than this user could already see on the All Leads page. */
function referrerSearchEndpoint(role) {
  return role === 'sales_executive' ? '/sales-executive/leads' : '/leads';
}

async function searchReferrerCandidates(endpoint, search) {
  const { data } = await API.get(endpoint, {
    params: buildListParams({ page: 1, limit: 8, filters: { search, filter: 'all' } }),
    skipSuccessToast: true,
    skipErrorToast: true,
  });
  return unwrapPagination(data).data || [];
}

/**
 * Step 5's Referral Details subsection — only rendered when Source = Referral.
 * Search reuses the same lead-search capability the All Leads page uses (GET /leads?search=),
 * scoped by the same role → endpoint mapping as the rest of this wizard. No new API/model.
 */
function ReferralDetailsSection({ role, leadId }) {
  const { register, watch, setValue, formState: { errors } } = useWizardForm();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 350);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  const referrerLeadId = watch('referrerLeadId');
  const referrerName = watch('referrerName');
  const previousTripWithUs = Boolean(watch('previousTripWithUs'));

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchReferrerCandidates(referrerSearchEndpoint(role), q)
      .then((rows) => setResults(rows.filter((r) => r._id !== leadId)))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [debouncedQuery, role, leadId]);

  const applyReferrer = (candidate) => {
    setValue('referrerLeadId', candidate._id);
    setValue('referrerName', candidate.name || '');
    setValue('referrerPhone', candidate.phone || '');
    if (candidate.city) setValue('referrerCity', candidate.city);
    if (candidate.state) setValue('referrerState', candidate.state);
    // Only ever pulls this customer's OWN real destination/date — never fabricated, and
    // only offered as a starting point (executive can still edit or clear it).
    if (candidate.status === 'converted') {
      setValue('previousTripWithUs', true);
      if (candidate.destination) setValue('previousDestination', candidate.destination);
      if (candidate.travelDate) setValue('previousTravelDate', String(candidate.travelDate).split('T')[0]);
    }
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const clearReferrerLink = () => {
    setValue('referrerLeadId', '');
  };

  return (
    <div className="mt-3 rounded-xl border border-[#5D5FEF]/20 bg-[#5D5FEF]/[0.03] p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#5D5FEF] mb-2.5">Referral Details</p>

      <WizardField label="Search Existing Customer / Referrer" hint="Optional — prefills the fields below">
        <div className="relative">
          <IconInput
            icon={Search}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            placeholder="Search by name or mobile number"
            autoComplete="off"
          />
          {open && query.trim().length >= 2 && (
            <div className="absolute z-20 w-full mt-1 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-52 overflow-y-auto">
              {searching ? (
                <p className="px-3 py-2.5 text-xs text-slate-400">Searching…</p>
              ) : results.length ? (
                results.map((r) => (
                  <button
                    key={r._id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); applyReferrer(r); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#5D5FEF]/5 text-left"
                  >
                    <User className="w-3.5 h-3.5 text-[#5D5FEF] shrink-0" />
                    <span className="text-xs font-medium text-slate-800 truncate flex-1">{r.name}</span>
                    <span className="text-[10px] text-slate-500 shrink-0">{r.phone}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2.5 text-xs text-slate-400">No match found</p>
              )}
            </div>
          )}
        </div>
      </WizardField>

      {referrerLeadId && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5">
          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="text-[11px] font-medium text-emerald-700 truncate flex-1">
            Linked to existing customer{referrerName ? `: ${referrerName}` : ''}
          </span>
          <button type="button" onClick={clearReferrerLink} className="text-emerald-600 hover:text-emerald-800 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <p className="mt-3 mb-2 text-[11px] font-semibold text-slate-600">Manual Referrer Details</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <WizardField label="Referrer Name" required error={errors.referrerName?.message}>
          <IconInput icon={User} {...register('referrerName')} placeholder="Who referred this customer?" error={errors.referrerName} />
        </WizardField>
        <WizardField label="Referrer Mobile Number" required error={errors.referrerPhone?.message}>
          <IconInput icon={Phone} {...register('referrerPhone')} placeholder="98765 43210" error={errors.referrerPhone} />
        </WizardField>
        <WizardField label="Referrer City">
          <IconInput icon={Building2} {...register('referrerCity')} placeholder="City" />
        </WizardField>
        <WizardField label="Referrer State">
          <IconSelect icon={MapPin} {...register('referrerState')}>
            <option value="">Select state</option>
            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </IconSelect>
        </WizardField>
        <WizardField label="Relationship with Referrer">
          <IconSelect icon={Users} {...register('referrerRelationship')}>
            <option value="">Select relationship</option>
            {REFERRAL_RELATIONSHIPS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </IconSelect>
        </WizardField>
        <WizardField label="Previous Trip With Us?">
          <div className="flex items-center h-10 gap-2">
            <Chip active={previousTripWithUs} onClick={() => setValue('previousTripWithUs', true)}>Yes</Chip>
            <Chip active={!previousTripWithUs} onClick={() => setValue('previousTripWithUs', false)}>No</Chip>
          </div>
        </WizardField>
      </div>

      {previousTripWithUs && (
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <WizardField label="Previous Destination">
            <IconInput icon={Compass} {...register('previousDestination')} placeholder="Where did they travel?" />
          </WizardField>
          <WizardField label="Approximate Travel Date">
            <IconInput icon={History} {...register('previousTravelDate')} type="date" />
          </WizardField>
        </div>
      )}

      <div className="mt-2.5">
        <WizardField label="Referral Notes">
          <WizardTextarea {...register('referralNotes')} placeholder="Anything useful about this referral…" />
        </WizardField>
      </div>
    </div>
  );
}

function HeroBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-[#5D5FEF]/[0.06] p-4 sm:p-5">
      <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-[#5D5FEF]/10 blur-2xl pointer-events-none" />
      <div className="relative flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="hidden sm:flex w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5D5FEF] to-[#7C3AED] items-center justify-center shadow-lg shadow-[#5D5FEF]/30 shrink-0">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5D5FEF]">Today&apos;s Lead</p>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight mt-0.5">
              Customer journey starts here
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Fill once, review twice, and we&apos;ll handle the rest.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 shrink-0 w-full lg:w-auto">
          {[
            { icon: Zap, label: 'Quick & Easy' },
            { icon: Shield, label: 'Secure Data' },
            { icon: TrendingUp, label: 'Better Conversion' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="rounded-xl border border-white/80 bg-white/90 shadow-sm px-2.5 py-2.5 text-center min-w-[96px]"
            >
              <div className="mx-auto mb-1.5 w-8 h-8 rounded-lg bg-[#5D5FEF]/10 text-[#5D5FEF] flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-[10px] sm:text-[11px] font-semibold text-slate-700 leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StepLeadForm({ isEdit, leadId }) {
  const { user } = useAuth();
  const { availableBranches } = useSelector((s) => s.branch);
  const { register, watch, setValue, formState: { errors } } = useWizardForm();
  const phone = watch('phone');
  const alternatePhone = watch('alternatePhone');
  const name = watch('name');
  const occupationCategory = watch('occupationCategory') || '';
  const foodPreference = watch('foodPreference') || '';
  const destination = watch('destination') || '';
  const leadType = watch('leadType') || 'fit';
  const priority = watch('priority');
  const leadSource = watch('leadSource');
  const branchId = watch('branchId');
  const travelDate = watch('travelDate');
  const returnDate = watch('returnDate');
  const whatsapp = watch('whatsapp');
  const isAdmin = user?.role === 'admin';
  const isSalesExecutive = user?.role === 'sales_executive';
  const lockIdentity = isEdit && isSalesExecutive;
  const sourceOptions = useMemo(() => {
    const base = getLeadSourcesForRole(user?.role);
    if (isEdit && leadSource && !base.some((s) => s.value === leadSource)) {
      const current = LEAD_SOURCES.find((s) => s.value === leadSource);
      return current ? [current, ...base] : base;
    }
    return base;
  }, [user?.role, isEdit, leadSource]);

  const [searching, setSearching] = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const [forceCreate, setForceCreate] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [destinationOptions, setDestinationOptions] = useState(DESTINATIONS);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const navigate = useNavigate();
  const canCreateAnyway = ['admin', 'sales_manager'].includes(user?.role);
  const sameAsPhone = !whatsapp || normalizePhone(whatsapp) === normalizePhone(phone);
  const pickupPoint = watch('pickupPoint') || '';
  const dropPoint = watch('dropPoint') || '';

  const filteredPickup = useMemo(
    () => filterPickupDropSuggestions(pickupPoint, 12),
    [pickupPoint]
  );

  const filteredDrop = useMemo(
    () => filterPickupDropSuggestions(dropPoint, 12),
    [dropPoint]
  );

  useEffect(() => {
    const days = calcTourDays(travelDate, returnDate);
    if (days) setValue('tourDays', days);
  }, [travelDate, returnDate, setValue]);

  useEffect(() => {
    if (isEdit || !isSalesExecutive) return;
    if (!sourceOptions.some((s) => s.value === leadSource)) {
      setValue('leadSource', defaultLeadSourceForRole('sales_executive'));
    }
  }, [isEdit, isSalesExecutive, leadSource, sourceOptions, setValue]);

  useEffect(() => {
    if (forceCreate) return;
    const normalized = normalizePhone(phone);
    if (normalized.length === 10) {
      setSearching(true);
      const t = setTimeout(() => {
        checkLeadDuplicate({ phone, alternatePhone, excludeId: leadId })
          .then((res) => {
            setDuplicate(res.originalLead || res.matches?.[0] || null);
          })
          .catch(() => setDuplicate(null))
          .finally(() => setSearching(false));
      }, 400);
      return () => clearTimeout(t);
    }
    setDuplicate(null);
  }, [phone, alternatePhone, leadId, forceCreate]);

  useEffect(() => {
    API.get('/destination-assignment/destinations', { skipSuccessToast: true, skipErrorToast: true })
      .then((r) => {
        const names = (r.data || [])
          .filter((d) => d.status === 'active')
          .map((d) => d.name)
          .filter(Boolean);
        if (names.length) setDestinationOptions(names);
      })
      .catch(() => {});
  }, []);

  const nameMatches = useMemo(() => {
    if (!name || name.length < 2 || !duplicate) return [];
    const q = name.toLowerCase();
    return duplicate.name?.toLowerCase().includes(q) ? [duplicate] : [];
  }, [name, duplicate]);

  const filteredDest = destinationOptions
    .filter((d) => d.toLowerCase().includes(destination.toLowerCase()))
    .slice(0, 8);

  const applyCustomer = (lead) => {
    setValue('name', lead.name);
    setValue('phone', lead.phone);
    setValue('email', lead.email || '');
    setValue('city', lead.city || 'Mumbai');
    setValue('whatsapp', lead.phone?.replace(/\D/g, '').slice(-10) || '');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <HeroBanner />

      <AnimatePresence>
        {duplicate && !isEdit && !forceCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <DuplicateLeadWarning
              match={duplicate}
              canCreateAnyway={canCreateAnyway}
              canMerge={canCreateAnyway}
              onCreateAnyway={() => setForceCreate(true)}
              onMerge={() => navigate(
                user?.role === 'sales_executive'
                  ? `/sales-executive/leads/${duplicate._id}/view`
                  : `/leads/${duplicate._id}`
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* One Customer Information card, containing all 5 steps of a natural sales conversation as
          numbered sub-sections — single scrollable page, the numbering/anchors are a visual guide only. */}
      <InfoCard icon={User} iconWrap="bg-[#5D5FEF]/10 text-[#5D5FEF]" title="Customer Information" subtitle="Basic details about your customer">
      <StepSection id="step-identity" number={1} first title="Customer Identity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <WizardField label="Full Name" required error={errors.name?.message}>
            <IconInput
              icon={User}
              {...register('name')}
              placeholder="Enter full name"
              error={errors.name}
              readOnly={lockIdentity}
              disabled={lockIdentity}
            />
          </WizardField>

          <WizardField
            label="Phone Number"
            required
            error={errors.phone?.message}
            hint={lockIdentity ? 'Locked — add another below' : undefined}
          >
            <IconInput
              {...register('phone')}
              placeholder="98765 43210"
              error={errors.phone}
              readOnly={lockIdentity}
              disabled={lockIdentity}
              prefix={(
                <span className="pl-3 pr-2 flex items-center gap-1.5 text-sm font-semibold text-slate-600 border-r border-slate-200 shrink-0">
                  <span className="text-base leading-none">🇮🇳</span>
                  +91
                </span>
              )}
            />
          </WizardField>

          <WizardField label="Occupation">
            <div className="flex items-center h-10 gap-2">
              <Chip
                active={occupationCategory === 'government'}
                onClick={() => setValue('occupationCategory', 'government')}
              >
                Government
              </Chip>
              <Chip
                active={occupationCategory === 'private'}
                onClick={() => setValue('occupationCategory', 'private')}
              >
                Private
              </Chip>
            </div>
          </WizardField>

          {occupationCategory && (
            <WizardField label="Occupation">
              <IconInput
                icon={Briefcase}
                {...register('occupation')}
                placeholder={
                  occupationCategory === 'government'
                    ? 'Enter government occupation...'
                    : 'Enter private occupation...'
                }
              />
            </WizardField>
          )}
        </div>
      </StepSection>

      <StepSection id="step-communication" number={2} title="Communication Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <WizardField label="WhatsApp Number" hint="Leave blank to use phone">
            <IconInput
              icon={MessageCircle}
              {...register('whatsapp')}
              placeholder="WhatsApp number"
              suffix={(
                <button
                  type="button"
                  onClick={() => setValue('whatsapp', normalizePhone(phone) || '')}
                  className={cn(
                    'mr-2 shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg transition-colors',
                    sameAsPhone
                      ? 'bg-emerald-500/15 text-emerald-700'
                      : 'bg-slate-100 text-slate-500 hover:bg-[#5D5FEF]/10 hover:text-[#5D5FEF]'
                  )}
                >
                  Same as phone
                </button>
              )}
            />
          </WizardField>

          <WizardField
            label="Email Address"
            error={errors.email?.message}
            hint={lockIdentity ? 'Locked — add another below' : undefined}
          >
            <IconInput
              icon={Mail}
              {...register('email')}
              type="email"
              placeholder="email@domain.com"
              error={errors.email}
              readOnly={lockIdentity}
              disabled={lockIdentity}
            />
          </WizardField>
        </div>
      </StepSection>

      <StepSection id="step-location" number={3} title="Location">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <WizardField label="City" required error={errors.city?.message}>
            <IconInput icon={Building2} {...register('city')} placeholder="Mumbai" error={errors.city} />
          </WizardField>

          <WizardField label="Sub City" required error={errors.subCity?.message}>
            <IconInput icon={MapPin} {...register('subCity')} placeholder="e.g. Andheri West" error={errors.subCity} />
          </WizardField>

          <WizardField label="State" error={errors.state?.message}>
            <IconSelect icon={MapPin} {...register('state')} error={errors.state}>
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </IconSelect>
          </WizardField>
        </div>
      </StepSection>

      <StepSection id="step-details" number={4} title="Additional Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <WizardField
            label={lockIdentity ? 'Add another phone' : 'Alternate Phone'}
            hint={lockIdentity ? 'Primary phone cannot be changed' : undefined}
          >
            <IconInput icon={Phone} {...register('alternatePhone')} placeholder="Extra mobile number" />
          </WizardField>

          <WizardField
            label={lockIdentity ? 'Add another email' : 'Alternate Email'}
            hint={lockIdentity ? 'Primary email cannot be changed' : undefined}
          >
            <IconInput icon={Mail} {...register('alternateEmail')} type="email" placeholder="second@email.com" />
          </WizardField>

          <WizardField label="Date of Birth">
            <IconInput icon={Calendar} {...register('dateOfBirth')} type="date" />
          </WizardField>
        </div>

        {lockIdentity && (
          <p className="mt-4 text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            Name, primary phone and primary email are locked. You can still add another phone / email and update travel details.
          </p>
        )}

        {(nameMatches.length > 0 || searching) && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Search className="w-3.5 h-3.5 text-[#5D5FEF]" />
              <p className="text-xs font-semibold text-slate-800">Existing match</p>
              {searching && <span className="text-[10px] text-slate-400">Searching…</span>}
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto">
              {nameMatches.map((m) => (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => applyCustomer(m)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:border-[#5D5FEF]/30 hover:bg-[#5D5FEF]/5 transition-all text-left"
                >
                  <User className="w-3.5 h-3.5 text-[#5D5FEF] shrink-0" />
                  <span className="text-xs font-medium text-slate-800 truncate flex-1">{m.name}</span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5" /> {m.phone}
                  </span>
                  <span className="text-[9px] font-bold uppercase text-[#5D5FEF] bg-[#5D5FEF]/10 px-1.5 py-0.5 rounded">Use</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </StepSection>

      <StepSection id="step-source" number={5} title="Lead Source">
        <WizardField
          label="Source"
          required
          error={errors.leadSource?.message}
          hint="Where did you get this lead from?"
        >
          <IconSelect
            icon={Compass}
            value={leadSource || ''}
            onChange={(e) => setValue('leadSource', e.target.value)}
            error={errors.leadSource}
          >
            <option value="">Select source</option>
            {sourceOptions.map((src) => (
              <option key={src.value} value={src.value}>{src.label}</option>
            ))}
          </IconSelect>
          <input type="hidden" {...register('leadSource')} />
        </WizardField>

        {leadSource === 'referral' && (
          <ReferralDetailsSection role={user?.role} leadId={leadId} />
        )}
      </StepSection>
      </InfoCard>

      {/* One Travel Information card, containing all 5 steps of the trip conversation as numbered
          sub-sections — single scrollable page, same pattern as Customer Information above. */}
      <InfoCard icon={Plane} iconWrap="bg-violet-500/10 text-violet-600" title="Travel Information" subtitle="Destination, dates, rooms and meal plan">
      <StepSection number={1} first title="Trip Basics">
        <div className="space-y-2.5">
          <div>
            <p className="text-[12px] font-semibold text-slate-700 mb-2">Lead type</p>
            <div className="flex flex-wrap gap-2">
              {LEAD_TYPES.map((type) => (
                <Chip
                  key={type.value}
                  active={leadType === type.value}
                  onClick={() => setValue('leadType', type.value)}
                >
                  {type.label}
                </Chip>
              ))}
            </div>
            <input type="hidden" {...register('leadType')} />
          </div>

          {leadType === 'corporate' && (
            <WizardField label="Company">
              <IconInput icon={Building2} {...register('companyName')} placeholder="Company name" />
            </WizardField>
          )}

          <WizardField label="Destination" error={errors.destination?.message}>
            <div className="relative">
              <IconInput
                icon={MapPin}
                {...register('destination')}
                onFocus={() => setDestOpen(true)}
                onBlur={() => setTimeout(() => setDestOpen(false), 150)}
                placeholder="Search destination…"
                error={errors.destination}
              />
              {destOpen && filteredDest.length > 0 && (
                <div className="absolute z-20 w-full mt-1 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                  {filteredDest.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setValue('destination', d);
                        setDestOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-[#5D5FEF]/5',
                        destination === d && 'bg-[#5D5FEF]/10 text-[#5D5FEF] font-medium'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </WizardField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <WizardField label="Tour start" error={errors.travelDate?.message}>
              <IconInput icon={Calendar} {...register('travelDate')} type="date" error={errors.travelDate} />
            </WizardField>

            <WizardField label="Tour end" error={errors.returnDate?.message}>
              <IconInput icon={Calendar} {...register('returnDate')} type="date" error={errors.returnDate} />
            </WizardField>

            <WizardField label="Tour days" hint="Auto-calculated from tour start/end">
              <WizardInput {...register('tourDays')} type="number" min={1} className="text-center font-semibold" placeholder="Auto" readOnly disabled />
            </WizardField>
          </div>
        </div>
      </StepSection>

      <StepSection number={2} title="Travellers & Package Cost">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { key: 'adults', label: 'Adults', min: 1 },
            { key: 'children', label: 'Kids', min: 0 },
            { key: 'infants', label: 'Infants', min: 0 },
          ].map(({ key, label, min }) => (
            <WizardField key={key} label={label} error={errors[key]?.message}>
              <WizardInput
                {...register(key)}
                type="number"
                min={min}
                className="text-center font-semibold"
                error={errors[key]}
              />
            </WizardField>
          ))}

          <WizardField label="Package Cost (₹)" error={errors.budget?.message} labelClassName="text-emerald-700">
            <IconInput
              icon={TrendingUp}
              {...register('budget')}
              type="number"
              min={0}
              step={1000}
              placeholder="e.g. 75000"
              error={errors.budget}
              className="font-bold text-emerald-700 placeholder:font-bold placeholder:text-emerald-600/70"
              containerClassName="border-emerald-200 bg-emerald-50/40 focus-within:ring-emerald-200 focus-within:border-emerald-400"
              iconClassName="text-emerald-600"
            />
          </WizardField>
        </div>
      </StepSection>

      <StepSection number={3} title="Stay & Hotel">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <WizardField label="No. of rooms">
              <WizardInput {...register('numberOfRooms')} type="number" min={1} className="text-center font-semibold" />
            </WizardField>
            <WizardField label="Rooms with mattress">
              <WizardInput {...register('roomsWithMattress')} type="number" min={0} className="text-center font-semibold" />
            </WizardField>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <WizardField label="Hotel (1–5★)">
              <IconSelect {...register('hotelCategory')}>
                {HOTEL_CATEGORY_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </IconSelect>
            </WizardField>
            <WizardField label="Meal plan">
              <IconSelect icon={UtensilsCrossed} {...register('mealPlan')}>
                {MEAL_PLAN_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </IconSelect>
            </WizardField>
          </div>
          <WizardField
            label="Food preference"
            required
            error={errors.foodPreference?.message}
            className="sm:col-span-2"
          >
            <div className="flex items-center h-10 gap-2">
              {FOOD_PREFERENCE_OPTIONS.map((f) => (
                <Chip
                  key={f.value}
                  active={foodPreference === f.value}
                  onClick={() => setValue('foodPreference', f.value)}
                >
                  {f.label}
                </Chip>
              ))}
            </div>
          </WizardField>
          <p className="sm:col-span-2 text-[10px] text-slate-500">
            Default MAP — hotel prices follow this plan in quotations
          </p>
        </div>
      </StepSection>

      <StepSection number={4} title="Transport">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <WizardField label="Pickup city / point" hint="City, state, airport, or any location">
            <div className="relative">
              <IconInput
                icon={MapPin}
                name="pickupPoint"
                value={pickupPoint}
                onChange={(e) => setValue('pickupPoint', e.target.value)}
                onFocus={() => setPickupOpen(true)}
                onBlur={() => setTimeout(() => setPickupOpen(false), 200)}
                placeholder="e.g. Chandigarh, Himachal Pradesh, Delhi Airport…"
                autoComplete="off"
              />
              {pickupOpen && filteredPickup.length > 0 && (
                <div className="absolute z-20 w-full mt-1 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                  {filteredPickup.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setValue('pickupPoint', p);
                        setPickupOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-[#5D5FEF]/5',
                        pickupPoint === p && 'bg-[#5D5FEF]/10 text-[#5D5FEF] font-medium'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </WizardField>
          <WizardField label="Drop city / point" hint="City, state, airport, or any location">
            <div className="relative">
              <IconInput
                icon={MapPin}
                name="dropPoint"
                value={dropPoint}
                onChange={(e) => setValue('dropPoint', e.target.value)}
                onFocus={() => setDropOpen(true)}
                onBlur={() => setTimeout(() => setDropOpen(false), 200)}
                placeholder="e.g. Manali, Shimla, Same as pickup…"
                autoComplete="off"
              />
              {dropOpen && filteredDrop.length > 0 && (
                <div className="absolute z-20 w-full mt-1 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                  {filteredDrop.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setValue('dropPoint', p);
                        setDropOpen(false);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm hover:bg-[#5D5FEF]/5',
                        dropPoint === p && 'bg-[#5D5FEF]/10 text-[#5D5FEF] font-medium'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </WizardField>
          <WizardField label="Cab type">
            <IconSelect {...register('cabType')}>
              {CAB_TYPE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </IconSelect>
          </WizardField>
        </div>
      </StepSection>

      <StepSection number={5} title="Intent & Requirements">
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <p className="text-[12px] font-semibold text-slate-700 mb-2">
                {INTENT_LABEL} {errors.priority && <span className="text-rose-500">— {errors.priority.message}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <Chip
                    key={p.value}
                    active={priority === p.value}
                    onClick={() => setValue('priority', p.value)}
                  >
                    {p.label}
                  </Chip>
                ))}
              </div>
              <input type="hidden" {...register('priority')} />
            </div>

            {isAdmin && (
              <WizardField label="Branch">
                <IconSelect
                  value={branchId || ''}
                  onChange={(e) => setValue('branchId', e.target.value)}
                >
                  <option value="">Current selected branch</option>
                  {availableBranches.map((b) => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </IconSelect>
                <input type="hidden" {...register('branchId')} />
              </WizardField>
            )}
          </div>

          <WizardField label="Requirements">
            <WizardTextarea
              {...register('requirements')}
              placeholder="Special requests, preferences…"
            />
          </WizardField>
        </div>
      </StepSection>
      </InfoCard>

      <LeadScoreCard values={watch()} />
    </motion.div>
  );
}
