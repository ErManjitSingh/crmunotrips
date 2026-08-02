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

/**
 * Sanitize lead create/update body from API / wizard payload.
 */
function normalizeLeadInput(body = {}, { isUpdate = false } = {}) {
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
      if (isUpdate) normalized.dateOfBirth = null;
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

  if (!isUpdate && body.status) normalized.status = body.status;
  if (isUpdate && body.status) normalized.status = body.status;

  return normalized;
}

module.exports = {
  normalizeLeadInput,
  normalizeSource,
  normalizeMealPlan,
  LEAD_SOURCES,
  computeLeadScoreByBudget,
};
