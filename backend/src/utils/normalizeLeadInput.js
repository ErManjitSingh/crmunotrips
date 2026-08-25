const mongoose = require('mongoose');
const { resolveLeadSourceKey, leadSourceLabel, LEAD_SOURCE_KEYS } = require('../constants/leadSources');

const LEAD_SOURCES = LEAD_SOURCE_KEYS;

function toObjectId(value) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'object' && value._id) value = value._id;
  const str = String(value);
  if (!mongoose.Types.ObjectId.isValid(str)) return undefined;
  return str;
}

function normalizeSource(body) {
  const raw = body.leadSource || body.source || 'dpw';
  return resolveLeadSourceKey(raw, 'dpw');
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

const MEAL_PLAN_KEYS = new Set(['ep', 'cp', 'map', 'ap']);

function normalizeMealPlan(raw, fallback = 'map') {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (MEAL_PLAN_KEYS.has(s)) return s;
  if (s.includes('room only') || /\bep\b/.test(s)) return 'ep';
  if (/\bcp\b/.test(s)) return 'cp';
  if (/\bmap\b/.test(s)) return 'map';
  if (/\bap\b/.test(s)) return 'ap';
  return fallback;
}

function hasOwn(body, key) {
  return Object.prototype.hasOwnProperty.call(body || {}, key);
}

/**
 * Sanitize lead create/update body from API / wizard payload.
 * On update: only include fields that were actually sent (avoids wiping / fake diffs).
 */
function normalizeLeadInput(body = {}, { isUpdate = false } = {}) {
  if (isUpdate) {
    return normalizeLeadUpdateInput(body);
  }

  const source = normalizeSource(body);
  const budget = Number(body.budget) || 0;
  const mealPlan = normalizeMealPlan(body.mealPlan || body.mealPreference, 'map');
  const normalized = {
    name: body.name?.trim(),
    email: body.email?.trim() || undefined,
    alternateEmail: body.alternateEmail?.trim() || '',
    phone: body.phone?.trim(),
    alternatePhone: body.alternatePhone?.trim() || '',
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
    roomsWithMattress: Math.max(0, Number(body.roomsWithMattress) || 0),
    cabType: body.cabType?.trim() || body.transportRequirement?.trim() || '',
    budget,
    budgetRange: parseBudgetRange(body, budget),
    leadScore: body.leadScore || computeLeadScoreByBudget(budget),
    travelers: Number(body.travelers) || Number(body.adults) || 1,
    adults: Number(body.adults) || 1,
    children: Number(body.children) || 0,
    infants: Number(body.infants) || 0,
    preferredCallTime: body.preferredCallTime?.trim?.() || body.preferredCallTime || undefined,
    source,
    sourceLabel: body.sourceLabel ? String(body.sourceLabel).trim() : leadSourceLabel(source),
    leadSource: body.leadSource || source,
    priority: body.priority || 'medium',
    notes: body.notes || body.specialRequirements || '',
    hotelCategory: body.hotelCategory,
    mealPlan,
    mealPreference: body.mealPreference || mealPlan.toUpperCase(),
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

  if (body.dateOfBirth !== undefined) {
    if (body.dateOfBirth === '' || body.dateOfBirth == null) {
      normalized.dateOfBirth = null;
    } else {
      const dob = new Date(body.dateOfBirth);
      if (!Number.isNaN(dob.getTime())) normalized.dateOfBirth = dob;
    }
  }

  if (body.temperature && ['hot', 'warm', 'cold', 'vip'].includes(body.temperature)) {
    normalized.temperature = body.temperature;
    if (body.temperature === 'hot') normalized.isHot = true;
    if (body.temperature !== 'hot') normalized.isHot = false;
  }

  if (body.coldReason !== undefined) {
    normalized.coldReason = String(body.coldReason || '').trim();
  }

  if (body.coldCallDone === true || body.coldCallDone === 'true') {
    normalized.coldCallPending = false;
    normalized.coldCallReminderAt = undefined;
  }

  const assignedTo = toObjectId(body.assignedTo) || toObjectId(body.assignedExecutive);
  const assignedManager = toObjectId(body.assignedManager);
  const assignedTeamLeader = toObjectId(body.assignedTeamLeader);

  if (assignedTo) normalized.assignedTo = assignedTo;
  if (assignedManager) normalized.assignedManager = assignedManager;
  if (assignedTeamLeader) normalized.assignedTeamLeader = assignedTeamLeader;

  if (body.status) normalized.status = body.status;

  return normalized;
}

function normalizeLeadUpdateInput(body = {}) {
  const normalized = {};

  const setTrim = (key, aliases = []) => {
    if (!hasOwn(body, key) && !aliases.some((a) => hasOwn(body, a))) return;
    const raw = hasOwn(body, key) ? body[key] : body[aliases.find((a) => hasOwn(body, a))];
    normalized[key] = raw == null ? '' : String(raw).trim();
  };

  const setNumber = (key, { min } = {}) => {
    if (!hasOwn(body, key)) return;
    let n = Number(body[key]);
    if (!Number.isFinite(n)) n = 0;
    if (min != null) n = Math.max(min, n);
    normalized[key] = n;
  };

  setTrim('name');
  setTrim('email');
  setTrim('alternateEmail');
  setTrim('phone');
  setTrim('alternatePhone');
  setTrim('whatsapp');
  setTrim('city');
  setTrim('state');
  setTrim('destination');
  setTrim('pickupPoint');
  setTrim('dropPoint');
  setTrim('cabType', ['transportRequirement']);
  setTrim('companyName');
  setTrim('preferredCallTime');
  setTrim('sourceLabel');
  setTrim('hotelCategory');
  setTrim('specialRequirements');
  setTrim('followUpRemarks');
  setTrim('requirements');
  setTrim('hotelPreference');
  setTrim('packageInterest');
  setTrim('priority');
  setTrim('channel');
  setTrim('leadType');
  setTrim('leadTypeSource');
  setTrim('statusReason');
  setTrim('coldReason');

  if (hasOwn(body, 'notes') || hasOwn(body, 'specialRequirements')) {
    normalized.notes = String(body.notes || body.specialRequirements || '');
  }

  if (hasOwn(body, 'travelDate')) normalized.travelDate = body.travelDate || null;
  if (hasOwn(body, 'returnDate')) normalized.returnDate = body.returnDate || null;
  if (hasOwn(body, 'nextFollowUp')) normalized.nextFollowUp = body.nextFollowUp || null;
  if (hasOwn(body, 'dateOfBirth')) {
    if (body.dateOfBirth === '' || body.dateOfBirth == null) normalized.dateOfBirth = null;
    else {
      const dob = new Date(body.dateOfBirth);
      if (!Number.isNaN(dob.getTime())) normalized.dateOfBirth = dob;
    }
  }

  setNumber('tourDays');
  setNumber('numberOfRooms', { min: 1 });
  setNumber('roomsWithMattress', { min: 0 });
  setNumber('travelers', { min: 1 });
  setNumber('adults', { min: 1 });
  setNumber('children', { min: 0 });
  setNumber('infants', { min: 0 });

  if (hasOwn(body, 'budget')) {
    const budget = Number(body.budget) || 0;
    normalized.budget = budget;
    if (hasOwn(body, 'budgetRange') || budget > 0) {
      normalized.budgetRange = parseBudgetRange(body, budget);
    }
    if (!hasOwn(body, 'leadScore')) {
      normalized.leadScore = computeLeadScoreByBudget(budget);
    }
  }
  if (hasOwn(body, 'budgetRange')) normalized.budgetRange = body.budgetRange;
  if (hasOwn(body, 'leadScore')) normalized.leadScore = body.leadScore;

  if (hasOwn(body, 'mealPlan') || hasOwn(body, 'mealPreference')) {
    const mealPlan = normalizeMealPlan(body.mealPlan || body.mealPreference, 'map');
    normalized.mealPlan = mealPlan;
    normalized.mealPreference = body.mealPreference || mealPlan.toUpperCase();
  }

  if (hasOwn(body, 'transportRequirement') || hasOwn(body, 'cabType')) {
    normalized.transportRequirement = String(body.cabType || body.transportRequirement || '').trim();
  }

  if (hasOwn(body, 'source') || hasOwn(body, 'leadSource')) {
    const source = normalizeSource(body);
    normalized.source = source;
    normalized.leadSource = body.leadSource || source;
    if (!hasOwn(body, 'sourceLabel')) {
      normalized.sourceLabel = leadSourceLabel(source);
    }
  }

  if (hasOwn(body, 'isHot')) normalized.isHot = Boolean(body.isHot);

  if (hasOwn(body, 'temperature') && ['hot', 'warm', 'cold', 'vip'].includes(body.temperature)) {
    normalized.temperature = body.temperature;
    normalized.isHot = body.temperature === 'hot';
  }

  if (body.coldCallDone === true || body.coldCallDone === 'true') {
    normalized.coldCallPending = false;
    normalized.coldCallReminderAt = undefined;
  }

  if (hasOwn(body, 'status')) normalized.status = body.status;

  const assignedTo = toObjectId(body.assignedTo) || toObjectId(body.assignedExecutive);
  const assignedManager = toObjectId(body.assignedManager);
  const assignedTeamLeader = toObjectId(body.assignedTeamLeader);
  if (assignedTo) normalized.assignedTo = assignedTo;
  if (assignedManager) normalized.assignedManager = assignedManager;
  if (assignedTeamLeader) normalized.assignedTeamLeader = assignedTeamLeader;

  return normalized;
}

module.exports = {
  normalizeLeadInput,
  normalizeSource,
  normalizeMealPlan,
  LEAD_SOURCES,
  computeLeadScoreByBudget,
};
