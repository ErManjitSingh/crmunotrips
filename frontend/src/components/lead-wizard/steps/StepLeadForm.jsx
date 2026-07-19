import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWizardForm } from '../WizardFormContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, User, Phone, MapPin, Plane, Megaphone, Calendar, IndianRupee,
} from 'lucide-react';
import { checkLeadDuplicate } from '../../../services/leadEnterpriseApi';
import DuplicateLeadWarning from '../../leads/DuplicateLeadWarning';
import { useAuth } from '../../../context/AuthContext';
import { useSelector } from 'react-redux';
import WizardField, { WizardInput, WizardSelect } from '../WizardField';
import {
  INDIAN_STATES, DESTINATIONS, LEAD_TYPES, LEAD_SOURCES, PRIORITIES, BUDGET_RANGE_OPTIONS,
  HOTEL_CATEGORY_OPTIONS, CAB_TYPE_OPTIONS,
} from '../constants';
import { calcTourDays } from '../leadWizardUtils';
import API from '../../../api/axios';
import { cn } from '../../../lib/utils';

function normalizePhone(p) {
  return p?.replace(/\D/g, '').slice(-10) || '';
}

function FormSection({ icon: Icon, title, accent, children }) {
  return (
    <section className="relative rounded-xl border border-subtle/80 bg-gradient-to-br from-surface via-surface to-surface-elevated/40 p-3.5 sm:p-4 overflow-hidden">
      <div className={cn('absolute inset-x-0 top-0 h-0.5 opacity-80', accent)} />
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-sm font-semibold text-content-primary tracking-tight">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Chip({ active, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all',
        active
          ? 'border-brand-500/50 bg-brand-500/12 text-brand-700 dark:text-brand-300 shadow-sm shadow-brand-600/10'
          : 'border-subtle bg-surface/80 text-content-muted hover:border-brand-500/25 hover:bg-brand-500/5',
        className
      )}
    >
      {children}
    </button>
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
  const isAdmin = user?.role === 'admin';

  const [searching, setSearching] = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const [forceCreate, setForceCreate] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [destinationOptions, setDestinationOptions] = useState(DESTINATIONS);
  const navigate = useNavigate();
  const canCreateAnyway = ['admin', 'sales_manager'].includes(user?.role);

  useEffect(() => {
    const days = calcTourDays(travelDate, returnDate);
    if (days) setValue('tourDays', days);
  }, [travelDate, returnDate, setValue]);

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
      className="space-y-3.5"
    >
      <div className="relative overflow-hidden rounded-xl border border-brand-500/20 bg-gradient-to-r from-brand-600/12 via-teal-500/8 to-amber-500/10 px-4 py-3">
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-brand-500/15 blur-2xl pointer-events-none" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600/80">New lead</p>
        <h2 className="text-lg sm:text-xl font-bold text-content-primary tracking-tight mt-0.5">
          Customer journey starts here
        </h2>
        <p className="text-xs text-content-muted mt-0.5">Fill once → review → save. Drafts autosave.</p>
      </div>

      <AnimatePresence>
        {duplicate && !isEdit && !forceCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <DuplicateLeadWarning
              match={duplicate}
              canCreateAnyway={canCreateAnyway}
              canMerge={canCreateAnyway}
              onCreateAnyway={() => setForceCreate(true)}
              onMerge={() => navigate(`/leads/${duplicate._id}`)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <FormSection icon={User} title="Customer" accent="bg-gradient-to-r from-brand-500 to-teal-400">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <WizardField label="Name" required error={errors.name?.message} className="col-span-2 sm:col-span-1">
            <WizardInput {...register('name')} placeholder="Full name" error={errors.name} className="h-9" />
          </WizardField>
          <WizardField label="Phone" required error={errors.phone?.message} hint="10-digit mobile">
            <WizardInput {...register('phone')} placeholder="98765 43210" error={errors.phone} className="h-9" />
          </WizardField>
          <WizardField label="WhatsApp" hint="Blank = phone">
            <WizardInput {...register('whatsapp')} placeholder="Same as phone" className="h-9" />
          </WizardField>
          <WizardField label="Email" error={errors.email?.message}>
            <WizardInput {...register('email')} type="email" placeholder="email@domain.com" error={errors.email} className="h-9" />
          </WizardField>
          <WizardField label="City" error={errors.city?.message}>
            <WizardInput {...register('city')} placeholder="Mumbai" error={errors.city} className="h-9" />
          </WizardField>
          <WizardField label="State" error={errors.state?.message}>
            <WizardSelect {...register('state')} error={errors.state} className="h-9">
              <option value="">Select</option>
              {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </WizardSelect>
          </WizardField>
        </div>

        {(nameMatches.length > 0 || searching) && (
          <div className="mt-2.5 rounded-lg border border-subtle bg-surface/70 p-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Search className="w-3.5 h-3.5 text-brand-600" />
              <p className="text-xs font-semibold text-content-primary">Existing match</p>
              {searching && <span className="text-[10px] text-content-muted">Searching…</span>}
            </div>
            <div className="space-y-1 max-h-28 overflow-y-auto scrollbar-thin">
              {nameMatches.map((m) => (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => applyCustomer(m)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border border-subtle hover:border-brand-500/30 hover:bg-brand-500/5 transition-all text-left"
                >
                  <User className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                  <span className="text-xs font-medium text-content-primary truncate flex-1">{m.name}</span>
                  <span className="text-[10px] text-content-muted flex items-center gap-1">
                    <Phone className="w-2.5 h-2.5" /> {m.phone}
                  </span>
                  <span className="text-[9px] font-bold uppercase text-brand-600 bg-brand-500/10 px-1.5 py-0.5 rounded">Use</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </FormSection>

      <FormSection icon={Plane} title="Travel" accent="bg-gradient-to-r from-violet-500 to-brand-400">
        <div className="mb-2.5">
          <p className="text-[11px] font-medium text-content-muted mb-1.5">Lead type</p>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_TYPES.map((type) => (
              <Chip
                key={type.value}
                active={leadType === type.value}
                onClick={() => setValue('leadType', type.value)}
                className="min-w-[4.5rem]"
              >
                {type.label}
              </Chip>
            ))}
          </div>
          <input type="hidden" {...register('leadType')} />
        </div>

        {leadType === 'corporate' && (
          <WizardField label="Company" className="mb-2.5">
            <WizardInput {...register('companyName')} placeholder="Company name" className="h-9" />
          </WizardField>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <WizardField label="Destination" error={errors.destination?.message} className="col-span-2">
            <div className="relative">
              <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted" />
              <WizardInput
                {...register('destination')}
                onFocus={() => setDestOpen(true)}
                onBlur={() => setTimeout(() => setDestOpen(false), 150)}
                placeholder="Search destination…"
                className="pl-8 h-9"
                error={errors.destination}
              />
              {destOpen && filteredDest.length > 0 && (
                <div className="absolute z-20 w-full mt-1 rounded-lg border border-subtle bg-surface shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                  {filteredDest.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => { setValue('destination', d); setDestOpen(false); }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-xs hover:bg-brand-500/5',
                        destination === d && 'bg-brand-500/10 text-brand-600 font-medium'
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
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted pointer-events-none" />
              <WizardInput {...register('travelDate')} type="date" className="pl-8 h-9" error={errors.travelDate} />
            </div>
          </WizardField>

          <WizardField label="Tour end" error={errors.returnDate?.message}>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted pointer-events-none" />
              <WizardInput {...register('returnDate')} type="date" className="pl-8 h-9" error={errors.returnDate} />
            </div>
          </WizardField>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2.5">
          <WizardField label="Tour days">
            <WizardInput
              {...register('tourDays')}
              type="number"
              min={1}
              className="h-9 text-center font-semibold metric-tabular"
              placeholder="Auto"
            />
          </WizardField>

          <WizardField label="No. of rooms">
            <WizardInput
              {...register('numberOfRooms')}
              type="number"
              min={1}
              className="h-9 text-center font-semibold metric-tabular"
            />
          </WizardField>

          <WizardField label="Hotel (1–5★)">
            <select {...register('hotelCategory')} className="input-premium h-9 w-full rounded-xl text-sm">
              {HOTEL_CATEGORY_OPTIONS.map((h) => (
                <option key={h.value} value={h.value}>{h.label}</option>
              ))}
            </select>
          </WizardField>

          <WizardField label="Cab type">
            <select {...register('cabType')} className="input-premium h-9 w-full rounded-xl text-sm">
              {CAB_TYPE_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </WizardField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5">
          <WizardField label="Pickup point">
            <WizardInput {...register('pickupPoint')} placeholder="Airport / Hotel / City" className="h-9" />
          </WizardField>
          <WizardField label="Drop point">
            <WizardInput {...register('dropPoint')} placeholder="Airport / Hotel / City" className="h-9" />
          </WizardField>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mt-2.5">
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
                className="h-9 text-center font-semibold metric-tabular"
                error={errors[key]}
              />
            </WizardField>
          ))}

          <WizardField label="Budget range" className="col-span-3 sm:col-span-2">
            <select
              {...register('budgetRange')}
              className="input-premium h-9 w-full rounded-xl text-sm"
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
            </select>
          </WizardField>

          <WizardField
            label={budgetRange === 'custom' ? 'Custom ₹' : 'Budget ₹'}
            error={errors.budget?.message}
            className="col-span-3 sm:col-span-1"
          >
            <div className="relative">
              <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-content-muted pointer-events-none" />
              <WizardInput
                {...register(budgetRange === 'custom' ? 'customBudget' : 'budget')}
                type="number"
                min={1000}
                className="pl-8 h-9"
                error={errors.budget}
              />
            </div>
          </WizardField>
        </div>

        <WizardField label="Requirements" className="mt-2.5">
          <textarea
            {...register('requirements')}
            className="input-premium min-h-[56px] w-full rounded-xl text-sm resize-none"
            placeholder="Special requests, preferences…"
          />
        </WizardField>
      </FormSection>

      <FormSection icon={Megaphone} title="Source & priority" accent="bg-gradient-to-r from-amber-500 to-orange-400">
        <div className="mb-2.5">
          <p className="text-[11px] font-medium text-content-muted mb-1.5">
            Source {errors.leadSource && <span className="text-red-500">— {errors.leadSource.message}</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_SOURCES.map((src) => (
              <Chip
                key={src.value}
                active={leadSource === src.value}
                onClick={() => setValue('leadSource', src.value)}
              >
                {src.label}
              </Chip>
            ))}
          </div>
          <input type="hidden" {...register('leadSource')} />
        </div>

        <div>
          <p className="text-[11px] font-medium text-content-muted mb-1.5">
            Priority {errors.priority && <span className="text-red-500">— {errors.priority.message}</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITIES.map((p) => (
              <Chip
                key={p.value}
                active={priority === p.value}
                onClick={() => setValue('priority', p.value)}
                className={cn(priority === p.value && p.color)}
              >
                {p.label}
              </Chip>
            ))}
          </div>
          <input type="hidden" {...register('priority')} />
        </div>

        {isAdmin && (
          <WizardField label="Branch" className="mt-2.5 max-w-xs">
            <select
              value={branchId || ''}
              onChange={(e) => setValue('branchId', e.target.value)}
              className="input-premium w-full h-9 rounded-xl text-sm"
            >
              <option value="">Current selected branch</option>
              {availableBranches.map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
            <input type="hidden" {...register('branchId')} />
          </WizardField>
        )}
      </FormSection>
    </motion.div>
  );
}
