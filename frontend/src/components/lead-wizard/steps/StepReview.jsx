import { User, Plane, Megaphone } from 'lucide-react';
import { LEAD_SOURCES, PRIORITIES, LEAD_TYPES, defaultWizardValues } from '../constants';

function ReviewSection({ icon: Icon, title, children, accent }) {
  return (
    <div className="relative rounded-xl border border-subtle bg-gradient-to-br from-surface via-surface to-surface-elevated/40 p-3.5 overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 flex items-center justify-center">
          <Icon className="w-3.5 h-3.5" />
        </div>
        <h4 className="text-sm font-semibold text-content-primary">{title}</h4>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {children}
      </dl>
    </div>
  );
}

function Row({ label, value }) {
  const display =
    value === undefined || value === null || value === ''
      ? '—'
      : String(value);
  return (
    <>
      <dt className="text-xs text-content-muted">{label}</dt>
      <dd className="text-xs font-semibold text-content-primary text-right sm:text-left">{display}</dd>
    </>
  );
}

export default function StepReview({ data }) {
  const v = { ...defaultWizardValues, ...(data || {}) };

  const sourceLabel = LEAD_SOURCES.find((s) => s.value === v.leadSource)?.label || v.leadSource;
  const priorityLabel = PRIORITIES.find((p) => p.value === v.priority)?.label || v.priority;
  const budgetValue = v.budgetRange === 'custom' ? v.customBudget : v.budget;
  const hotelLabel = String(v.hotelCategory || '').replace('_', ' ');

  return (
    <div className="space-y-3.5">
      <div className="relative overflow-hidden rounded-xl border border-brand-500/20 bg-gradient-to-r from-brand-600/12 via-teal-500/8 to-amber-500/10 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600/80">Almost done</p>
        <h2 className="text-lg font-bold text-content-primary tracking-tight mt-0.5">Review & confirm</h2>
        <p className="text-xs text-content-muted mt-0.5">Double-check details, then save the lead</p>
      </div>

      <ReviewSection icon={User} title="Customer" accent="bg-gradient-to-r from-brand-500 to-teal-400">
        <Row label="Name" value={v.name} />
        <Row label="Phone" value={v.phone} />
        <Row label="WhatsApp" value={v.whatsapp || v.phone} />
        <Row label="Email" value={v.email} />
        <Row label="City" value={v.city} />
        <Row label="State" value={v.state} />
      </ReviewSection>

      <ReviewSection icon={Plane} title="Travel" accent="bg-gradient-to-r from-violet-500 to-brand-400">
        <Row label="Lead Type" value={LEAD_TYPES.find((t) => t.value === v.leadType)?.label || v.leadType} />
        {v.leadType === 'corporate' && <Row label="Company" value={v.companyName} />}
        <Row label="Destination" value={v.destination} />
        <Row label="Travel Date" value={v.travelDate} />
        <Row label="Travelers" value={`${v.adults}A · ${v.children}C · ${v.infants}I`} />
        <Row label="Hotel" value={hotelLabel} />
        <Row label="Budget" value={budgetValue ? `₹${Number(budgetValue).toLocaleString('en-IN')}` : ''} />
        <Row label="Requirements" value={v.requirements} />
      </ReviewSection>

      <ReviewSection icon={Megaphone} title="Lead info" accent="bg-gradient-to-r from-amber-500 to-orange-400">
        <Row label="Source" value={sourceLabel} />
        <Row label="Priority" value={priorityLabel} />
        <Row label="Branch" value={v.branchId || 'Current selected branch'} />
      </ReviewSection>
    </div>
  );
}
