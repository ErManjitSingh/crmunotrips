import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizardForm } from '../WizardFormContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, User, Phone, MapPin, Plane, Calendar, IndianRupee,
  Mail, Building2, Compass, Zap, Shield, TrendingUp, MessageCircle,
} from 'lucide-react';
import { checkLeadDuplicate } from '../../../services/leadEnterpriseApi';
import DuplicateLeadWarning from '../../leads/DuplicateLeadWarning';
import { useAuth } from '../../../context/AuthContext';
import { useSelector } from 'react-redux';
import WizardField, { WizardInput, IconInput, IconSelect, WizardTextarea } from '../WizardField';
import {
  INDIAN_STATES, DESTINATIONS, LEAD_TYPES, LEAD_SOURCES, PRIORITIES, BUDGET_RANGE_OPTIONS,
  HOTEL_CATEGORY_OPTIONS, CAB_TYPE_OPTIONS, filterPickupDropSuggestions, INTENT_LABEL,
  getLeadSourcesForRole, defaultLeadSourceForRole,
} from '../constants';
import { calcTourDays } from '../leadWizardUtils';
import API from '../../../api/axios';
import { cn } from '../../../lib/utils';

function normalizePhone(p) {
  return p?.replace(/\D/g, '').slice(-10) || '';
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
  const destination = watch('destination') || '';
  const leadType = watch('leadType') || 'fit';
  const budgetRange = watch('budgetRange') || '';
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

      {/* Customer Information — mockup match */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#5D5FEF]/10 text-[#5D5FEF] flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Customer Information</h3>
            <p className="text-sm text-slate-500 mt-0.5">Basic details about your customer</p>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                hint={lockIdentity ? 'Locked — add another below' : '10-digit mobile number'}
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

              <WizardField label="City" required error={errors.city?.message}>
                <IconInput icon={Building2} {...register('city')} placeholder="Mumbai" error={errors.city} />
              </WizardField>

              <WizardField label="Date of Birth" hint="Optional">
                <IconInput icon={Calendar} {...register('dateOfBirth')} type="date" />
              </WizardField>

              <WizardField label="State" error={errors.state?.message}>
                <IconSelect icon={MapPin} {...register('state')} error={errors.state}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </IconSelect>
              </WizardField>

              <WizardField
                label={lockIdentity ? 'Add another phone' : 'Alternate Phone'}
                hint={lockIdentity ? 'Primary phone cannot be changed' : 'Optional'}
              >
                <IconInput icon={Phone} {...register('alternatePhone')} placeholder="Extra mobile number" />
              </WizardField>

              <WizardField
                label={lockIdentity ? 'Add another email' : 'Alternate Email'}
                hint={lockIdentity ? 'Primary email cannot be changed' : 'Optional'}
              >
                <IconInput icon={Mail} {...register('alternateEmail')} type="email" placeholder="second@email.com" />
              </WizardField>

              <WizardField
                label="Source"
                required
                error={errors.leadSource?.message}
                hint="Where did you get this lead from?"
                className="sm:col-span-2"
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
            </div>

            <aside className="xl:col-span-4">
              <div className="h-full min-h-[220px] rounded-2xl border border-[#5D5FEF]/15 bg-gradient-to-br from-[#5D5FEF]/[0.08] via-white to-violet-50 p-5 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5D5FEF] to-[#7C3AED] text-white flex items-center justify-center shadow-lg shadow-[#5D5FEF]/30 mb-3">
                  <User className="w-8 h-8" />
                </div>
                <p className="text-sm font-bold text-slate-800">Add customer details</p>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-[200px]">
                  Add accurate details to get better travel recommendations.
                </p>
              </div>
            </aside>
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
        </div>
      </section>

      {/* Travel — keep required fields, styled to match */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
            <Plane className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Travel Information</h3>
            <p className="text-sm text-slate-500 mt-0.5">Destination, dates, rooms and budget</p>
          </div>
        </div>

        <div className="p-5 space-y-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <WizardField label="Destination" error={errors.destination?.message} className="sm:col-span-2">
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
                        onClick={() => { setValue('destination', d); setDestOpen(false); }}
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

            <WizardField label="Tour start" error={errors.travelDate?.message}>
              <IconInput icon={Calendar} {...register('travelDate')} type="date" error={errors.travelDate} />
            </WizardField>

            <WizardField label="Tour end" error={errors.returnDate?.message}>
              <IconInput icon={Calendar} {...register('returnDate')} type="date" error={errors.returnDate} />
            </WizardField>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <WizardField label="Tour days">
              <WizardInput {...register('tourDays')} type="number" min={1} className="text-center font-semibold" placeholder="Auto" />
            </WizardField>
            <WizardField label="No. of rooms">
              <WizardInput {...register('numberOfRooms')} type="number" min={1} className="text-center font-semibold" />
            </WizardField>
            <WizardField label="Rooms with mattress">
              <WizardInput {...register('roomsWithMattress')} type="number" min={0} className="text-center font-semibold" />
            </WizardField>
            <WizardField label="Hotel (1–5★)">
              <IconSelect {...register('hotelCategory')}>
                {HOTEL_CATEGORY_OPTIONS.map((h) => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </IconSelect>
            </WizardField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <WizardField label="Cab type">
              <IconSelect {...register('cabType')}>
                {CAB_TYPE_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </IconSelect>
            </WizardField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <WizardField label="Pickup city / point" hint="City, state, airport, or any location">
              <div className="relative">
                <IconInput
                  icon={MapPin}
                  {...register('pickupPoint')}
                  onFocus={() => setPickupOpen(true)}
                  onBlur={() => setTimeout(() => setPickupOpen(false), 150)}
                  placeholder="e.g. Chandigarh, Himachal Pradesh, Delhi Airport…"
                  autoComplete="off"
                />
                {pickupOpen && filteredPickup.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                    {filteredPickup.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => { setValue('pickupPoint', p); setPickupOpen(false); }}
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
                  {...register('dropPoint')}
                  onFocus={() => setDropOpen(true)}
                  onBlur={() => setTimeout(() => setDropOpen(false), 150)}
                  placeholder="e.g. Manali, Shimla, Same as pickup…"
                  autoComplete="off"
                />
                {dropOpen && filteredDrop.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                    {filteredDrop.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => { setValue('dropPoint', p); setDropOpen(false); }}
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
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
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

            <WizardField label="Budget range" className="col-span-2 sm:col-span-2">
              <IconSelect
                {...register('budgetRange')}
                onChange={(e) => {
                  const next = e.target.value;
                  setValue('budgetRange', next);
                  const picked = BUDGET_RANGE_OPTIONS.find((b) => b.value === next);
                  if (picked && next !== 'custom') {
                    setValue('budget', picked.amount);
                    setValue('customBudget', '');
                  }
                }}
              >
                <option value="">Select</option>
                {BUDGET_RANGE_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </IconSelect>
            </WizardField>

            <WizardField
              label={budgetRange === 'custom' ? 'Custom ₹' : 'Budget ₹'}
              error={errors.budget?.message}
              hint="Optional"
              className="col-span-2 sm:col-span-1"
            >
              <IconInput
                icon={IndianRupee}
                {...register(budgetRange === 'custom' ? 'customBudget' : 'budget')}
                type="number"
                min={0}
                error={errors.budget}
              />
            </WizardField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      </section>
    </motion.div>
  );
}
