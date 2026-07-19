import { LEAD_SOURCES, defaultWizardValues } from './constants';

const sourceLabel = (value) => LEAD_SOURCES.find((s) => s.value === value)?.label || value;
const BUDGET_RANGES = {
  under_20000: { label: 'Under 20,000', min: 0, max: 20000 },
  '20000_40000': { label: '20,000 - 40,000', min: 20000, max: 40000 },
  '40000_60000': { label: '40,000 - 60,000', min: 40000, max: 60000 },
  '60000_100000': { label: '60,000 - 100,000', min: 60000, max: 100000 },
  above_100000: { label: 'Above 100,000', min: 100001, max: 150000 },
  custom: { label: 'Custom Budget', min: null, max: null },
};

function inferBudgetRange(budget) {
  const n = Number(budget) || 0;
  if (n < 20000) return 'under_20000';
  if (n <= 40000) return '20000_40000';
  if (n <= 60000) return '40000_60000';
  if (n <= 100000) return '60000_100000';
  return 'above_100000';
}

/** Inclusive tour days from start → end dates. */
export function calcTourDays(start, end) {
  if (!start || !end) return '';
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return '';
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

export function leadToWizardValues(lead) {
  const adults = lead.adults ?? Math.max(1, (lead.travelers || 2) - (lead.children || 0));
  const children = lead.children ?? 0;
  const infants = lead.infants ?? 0;
  const travelDate = lead.travelDate ? String(lead.travelDate).split('T')[0] : '';
  const returnDate = lead.returnDate ? String(lead.returnDate).split('T')[0] : '';

  return {
    ...defaultWizardValues,
    name: lead.name || '',
    phone: lead.phone || '',
    whatsapp: lead.whatsapp || lead.phone?.replace(/\D/g, '').slice(-10) || '',
    email: lead.email || '',
    alternateEmail: lead.alternateEmail || '',
    city: lead.city || '',
    state: lead.state || '',
    destination: lead.destination || '',
    travelDate,
    returnDate,
    tourDays: lead.tourDays || calcTourDays(travelDate, returnDate) || '',
    pickupPoint: lead.pickupPoint || '',
    dropPoint: lead.dropPoint || '',
    numberOfRooms: lead.numberOfRooms || 1,
    cabType: lead.cabType || lead.transportRequirement || 'sedan',
    adults,
    children,
    infants,
    leadSource: lead.leadSource || lead.source || 'website',
    priority: lead.priority || 'medium',
    branchId: lead.branchId || '',
    leadType: lead.leadType || 'fit',
    companyName: lead.companyName || '',
    hotelCategory: lead.hotelCategory || '3_star',
    requirements: lead.specialRequirements || '',
    budget: lead.budget || '',
    budgetRange: lead.budgetRange || inferBudgetRange(lead.budget || 0),
    customBudget: lead.budgetRange === 'custom' ? String(lead.budget || '') : '',
    alternatePhone: lead.alternatePhone || '',
  };
}

export function wizardValuesToPayload(values) {
  const travelers =
    Number(values.adults || 0) + Number(values.children || 0) + Number(values.infants || 0);

  const numericBudget =
    values.budgetRange === 'custom'
      ? Number(values.customBudget) || 0
      : Number(values.budget) || 0;

  const tourDays =
    Number(values.tourDays) || calcTourDays(values.travelDate, values.returnDate) || 0;

  return {
    name: values.name,
    phone: values.phone,
    alternatePhone: values.alternatePhone || undefined,
    whatsapp: values.whatsapp || values.phone,
    email: values.email || undefined,
    alternateEmail: values.alternateEmail || undefined,
    city: values.city,
    state: values.state,
    destination: values.destination,
    leadType: values.leadType || 'fit',
    companyName: values.companyName || undefined,
    travelDate: values.travelDate ? new Date(values.travelDate).toISOString() : undefined,
    returnDate: values.returnDate ? new Date(values.returnDate).toISOString() : undefined,
    tourDays,
    pickupPoint: values.pickupPoint || undefined,
    dropPoint: values.dropPoint || undefined,
    numberOfRooms: Math.max(1, Number(values.numberOfRooms) || 1),
    cabType: values.cabType || undefined,
    transportRequirement: values.cabType || undefined,
    adults: Number(values.adults) || 2,
    children: Number(values.children) || 0,
    infants: Number(values.infants) || 0,
    travelers: travelers || 2,
    leadSource: values.leadSource,
    source: values.leadSource,
    sourceLabel: sourceLabel(values.leadSource),
    priority: values.priority,
    budget: numericBudget,
    budgetRange: values.budgetRange || inferBudgetRange(numericBudget),
    hotelCategory: values.hotelCategory || undefined,
    specialRequirements: values.requirements || undefined,
    status: 'new',
    ...(values.branchId ? { branchId: values.branchId } : {}),
  };
}

export function formatDraftTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
