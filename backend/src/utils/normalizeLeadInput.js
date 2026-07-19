const mongoose = require('mongoose');

const LEAD_SOURCES = ['website', 'referral', 'social', 'walk-in', 'phone', 'whatsapp', 'other', 'google_ads', 'facebook_ads', 'organic'];

/** Map wizard / marketing source labels to stored `source` field */
const SOURCE_ALIASES = {
  google_ads: 'google_ads',
  facebook_ads: 'facebook_ads',
  organic: 'organic',
  website: 'website',
  whatsapp: 'whatsapp',
  referral: 'referral',
  social: 'social',
  phone: 'phone',
  'walk-in': 'walk-in',
  other: 'other',
};

function toObjectId(value) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'object' && value._id) value = value._id;
  const str = String(value);
  if (!mongoose.Types.ObjectId.isValid(str)) return undefined;
  return str;
}

function normalizeSource(body) {
  const raw = body.leadSource || body.source || 'website';
  return SOURCE_ALIASES[raw] || (LEAD_SOURCES.includes(raw) ? raw : 'other');
}

function parseBudgetRange(body, budget) {
  const explicit = body.budgetRange;
  if (explicit) return explicit;
  if (budget <= 0) return 'custom';
  if (budget < 20000) return 'under_20000';
  if (budget <= 40000) return '20000_40000';
  if (budget <= 60000) return '40000_60000';
  if (budget <= 100000) return '60000_100000';
  return 'above_100000';
}

function computeLeadScoreByBudget(budget) {
  if (budget >= 100000) return 'hot';
  if (budget >= 60000) return 'high';
  if (budget >= 30000) return 'medium';
  return 'low';
}

/**
 * Sanitize lead create/update body from API / wizard payload.
 */
function normalizeLeadInput(body = {}, { isUpdate = false } = {}) {
  const source = normalizeSource(body);

  const budget = Number(body.budget) || 0;
  const normalized = {
    name: body.name?.trim(),
    email: body.email?.trim() || undefined,
    phone: body.phone?.trim(),
    whatsapp: body.whatsapp?.trim() || body.phone?.trim(),
    city: body.city?.trim(),
    state: body.state?.trim(),
    destination: body.destination?.trim(),
    travelDate: body.travelDate,
    returnDate: body.returnDate,
    tourDays: Number(body.tourDays) || 0,
    pickupPoint: body.pickupPoint?.trim() || '',
    dropPoint: body.dropPoint?.trim() || '',
    numberOfRooms: Math.max(1, Number(body.numberOfRooms) || 1),
    cabType: body.cabType?.trim() || body.transportRequirement?.trim() || '',
    budget,
    budgetRange: parseBudgetRange(body, budget),
    leadScore: body.leadScore || computeLeadScoreByBudget(budget),
    travelers: Number(body.travelers) || Number(body.adults) || 1,
    adults: Number(body.adults) || 1,
    children: Number(body.children) || 0,
    infants: Number(body.infants) || 0,
    source,
    sourceLabel: body.sourceLabel || body.leadSource || source,
    leadSource: body.leadSource || source,
    priority: body.priority || 'medium',
    notes: body.notes || body.specialRequirements || '',
    hotelCategory: body.hotelCategory,
    mealPreference: body.mealPreference,
    transportRequirement: body.cabType?.trim() || body.transportRequirement,
    specialRequirements: body.specialRequirements,
    followUpRemarks: body.followUpRemarks,
    nextFollowUp: body.nextFollowUp,
    isHot: Boolean(body.isHot),
    channel: body.channel || 'crm',
    companyName: body.companyName?.trim() || '',
    leadType: body.leadType,
    leadTypeSource: body.leadTypeSource,
  };

  const assignedTo = toObjectId(body.assignedTo) || toObjectId(body.assignedExecutive);
  const assignedManager = toObjectId(body.assignedManager);
  const assignedTeamLeader = toObjectId(body.assignedTeamLeader);

  if (assignedTo) normalized.assignedTo = assignedTo;
  if (assignedManager) normalized.assignedManager = assignedManager;
  if (assignedTeamLeader) normalized.assignedTeamLeader = assignedTeamLeader;

  if (!isUpdate && body.status) normalized.status = body.status;
  if (isUpdate && body.status) normalized.status = body.status;

  return normalized;
}

module.exports = {
  normalizeLeadInput,
  normalizeSource,
  LEAD_SOURCES,
  computeLeadScoreByBudget,
};
