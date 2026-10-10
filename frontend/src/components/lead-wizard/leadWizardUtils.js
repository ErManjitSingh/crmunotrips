import { LEAD_SOURCES, MEAL_PLAN_LABELS, defaultWizardValues } from './constants';
import { normalizeMealPlanKey } from '../../lib/mealPlanDefaults';

const sourceLabel = (value) => LEAD_SOURCES.find((s) => s.value === value)?.label || value;

export function formatLeadMealPlan(leadOrKey) {
  if (leadOrKey && typeof leadOrKey === 'object') {
    const key = normalizeMealPlanKey(leadOrKey.mealPlan || leadOrKey.mealPreference) || 'map';
    return MEAL_PLAN_LABELS[key] || key.toUpperCase();
  }
  const key = normalizeMealPlanKey(leadOrKey) || 'map';
  return MEAL_PLAN_LABELS[key] || key.toUpperCase();
}

export function shortLeadMealPlan(leadOrKey) {
  if (leadOrKey && typeof leadOrKey === 'object') {
    return (normalizeMealPlanKey(leadOrKey.mealPlan || leadOrKey.mealPreference) || 'map').toUpperCase();
  }
  return (normalizeMealPlanKey(leadOrKey) || 'map').toUpperCase();
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
  const mealPlan = normalizeMealPlanKey(lead.mealPlan || lead.mealPreference) || 'map';

  return {
    ...defaultWizardValues,
    name: lead.name || '',
    phone: lead.phone || '',
    whatsapp: lead.whatsapp || lead.phone?.replace(/\D/g, '').slice(-10) || '',
    email: lead.email || '',
    alternateEmail: lead.alternateEmail || '',
    city: lead.city || '',
    subCity: lead.subCity || '',
    state: lead.state || '',
    destination: lead.destination || '',
    travelDate,
    returnDate,
    // Dates are authoritative whenever both are present — a stored tourDays can be stale if the
    // lead's dates were edited since it was last saved. Only fall back to the stored value (or
    // blank) when dates are missing.
    tourDays: calcTourDays(travelDate, returnDate) || lead.tourDays || '',
    pickupPoint: lead.pickupPoint || '',
    dropPoint: lead.dropPoint || '',
    numberOfRooms: lead.numberOfRooms || 1,
    roomsWithMattress: lead.roomsWithMattress ?? 0,
    dateOfBirth: lead.dateOfBirth ? String(lead.dateOfBirth).split('T')[0] : '',
    occupationCategory: lead.occupationCategory || '',
    occupation: lead.occupation || '',
    cabType: lead.cabType || lead.transportRequirement || 'sedan',
    adults,
    children,
    infants,
    leadSource: lead.leadSource || lead.source || 'dpw',
    referrerLeadId: lead.referral?.referrerLeadId
      ? String(lead.referral.referrerLeadId._id || lead.referral.referrerLeadId)
      : '',
    referrerName: lead.referral?.referrerName || '',
    referrerPhone: lead.referral?.referrerPhone || '',
    referrerCity: lead.referral?.referrerCity || '',
    referrerState: lead.referral?.referrerState || '',
    referrerRelationship: lead.referral?.relationship || '',
    previousTripWithUs: Boolean(lead.referral?.previousTripWithUs),
    previousDestination: lead.referral?.previousDestination || '',
    previousTravelDate: lead.referral?.previousTravelDate
      ? String(lead.referral.previousTravelDate).split('T')[0]
      : '',
    referralNotes: lead.referral?.notes || '',
    priority: lead.priority || 'medium',
    branchId: lead.branchId || '',
    leadType: lead.leadType || 'fit',
    companyName: lead.companyName || '',
    hotelCategory: lead.hotelCategory || '3_star',
    mealPlan,
    foodPreference: lead.foodPreference || '',
    requirements: lead.specialRequirements || '',
    alternatePhone: lead.alternatePhone || '',
  };
}

export function wizardValuesToPayload(values) {
  const travelers =
    Number(values.adults || 0) + Number(values.children || 0) + Number(values.infants || 0);

  // Dates are authoritative whenever both are present, so the field the executive sees can
  // never diverge from what actually gets saved (see leadToWizardValues for the load-side fix).
  const tourDays =
    calcTourDays(values.travelDate, values.returnDate) || Number(values.tourDays) || 0;

  const mealPlan = normalizeMealPlanKey(values.mealPlan) || 'map';

  return {
    name: values.name,
    phone: values.phone,
    alternatePhone: values.alternatePhone || undefined,
    whatsapp: values.whatsapp || values.phone,
    email: values.email || undefined,
    alternateEmail: values.alternateEmail || undefined,
    city: values.city,
    subCity: String(values.subCity || '').trim(),
    state: values.state,
    destination: values.destination,
    leadType: values.leadType || 'fit',
    companyName: values.companyName || undefined,
    travelDate: values.travelDate ? new Date(values.travelDate).toISOString() : undefined,
    returnDate: values.returnDate ? new Date(values.returnDate).toISOString() : undefined,
    tourDays,
    pickupPoint: String(values.pickupPoint || '').trim(),
    dropPoint: String(values.dropPoint || '').trim(),
    numberOfRooms: Math.max(1, Number(values.numberOfRooms) || 1),
    roomsWithMattress: Math.max(0, Number(values.roomsWithMattress) || 0),
    dateOfBirth: values.dateOfBirth
      ? new Date(values.dateOfBirth).toISOString()
      : undefined,
    occupationCategory: values.occupationCategory || undefined,
    occupation: values.occupation || undefined,
    cabType: values.cabType || undefined,
    transportRequirement: values.cabType || undefined,
    adults: Number(values.adults) || 2,
    children: Number(values.children) || 0,
    infants: Number(values.infants) || 0,
    travelers: travelers || 2,
    leadSource: values.leadSource,
    source: values.leadSource,
    sourceLabel: sourceLabel(values.leadSource),
    // Explicit `null` when source isn't Referral so a value typed earlier (then the source
    // switched away) can never be saved as stale referral data — see normalizeLeadInput.js.
    referral: values.leadSource === 'referral'
      ? {
          referrerLeadId: values.referrerLeadId || undefined,
          referrerName: String(values.referrerName || '').trim(),
          referrerPhone: String(values.referrerPhone || '').trim(),
          referrerCity: String(values.referrerCity || '').trim(),
          referrerState: String(values.referrerState || '').trim(),
          relationship: values.referrerRelationship || '',
          previousTripWithUs: Boolean(values.previousTripWithUs),
          previousDestination: values.previousTripWithUs ? String(values.previousDestination || '').trim() : '',
          previousTravelDate: values.previousTripWithUs && values.previousTravelDate
            ? new Date(values.previousTravelDate).toISOString()
            : undefined,
          notes: String(values.referralNotes || '').trim(),
        }
      : null,
    priority: values.priority,
    budget: Number(values.budget) > 0 ? Number(values.budget) : 0,
    budgetRange: 'custom',
    mealPlan,
    mealPreference: mealPlan.toUpperCase(),
    foodPreference: values.foodPreference || '',
    hotelCategory: values.hotelCategory || undefined,
    specialRequirements: values.requirements || undefined,
    status: 'new',
    ...(values.branchId ? { branchId: values.branchId } : {}),
  };
}

export function formatDraftTime() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}
