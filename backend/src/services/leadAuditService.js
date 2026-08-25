const AuditLog = require('../models/AuditLog');
const { clampLimit, DETAIL_MAX_LIMIT } = require('../utils/pagination');

const LEAD_TRACKED_FIELDS = [
  'name',
  'phone',
  'email',
  'alternatePhone',
  'alternateEmail',
  'status',
  'statusReason',
  'coldReason',
  'temperature',
  'isHot',
  'budget',
  'destination',
  'city',
  'travelDate',
  'returnDate',
  'travelers',
  'adults',
  'children',
  'infants',
  'mealPlan',
  'mealPreference',
  'preferredCallTime',
  'source',
  'sourceLabel',
  'assignedTo',
  'nextFollowUp',
  'lastFollowUp',
  'hotelPreference',
  'packageInterest',
  'requirements',
  'priority',
];

const FIELD_LABELS = {
  name: 'Name',
  phone: 'Phone',
  email: 'Email',
  alternatePhone: 'Alt phone',
  alternateEmail: 'Alt email',
  status: 'Status',
  statusReason: 'Status option',
  coldReason: 'Cold reason',
  temperature: 'Temperature',
  isHot: 'Hot flag',
  budget: 'Budget',
  destination: 'Destination',
  city: 'City',
  travelDate: 'Travel date',
  returnDate: 'Return date',
  travelers: 'Travelers',
  adults: 'Adults',
  children: 'Children',
  infants: 'Infants',
  mealPlan: 'Meal plan',
  mealPreference: 'Meal preference',
  preferredCallTime: 'Preferred call time',
  source: 'Source',
  sourceLabel: 'Source label',
  assignedTo: 'Assigned to',
  nextFollowUp: 'Next follow-up',
  lastFollowUp: 'Last follow-up',
  hotelPreference: 'Hotel preference',
  packageInterest: 'Package interest',
  requirements: 'Requirements',
  priority: 'Priority',
};

async function logAudit({
  entityType,
  entityId,
  branchId,
  action,
  actor,
  changes = [],
  ip,
  meta = {},
}) {
  return AuditLog.create({
    entityType,
    entityId,
    branchId: branchId || null,
    action,
    actorId: actor?._id || actor?.id || null,
    actorName: actor?.name || 'System',
    changes,
    ip,
    meta,
  });
}

function normalizeCompareValue(val) {
  if (val == null || val === '') return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'object' && val._id) return String(val._id);
  if (typeof val === 'boolean') return val ? 'yes' : 'no';
  if (typeof val === 'number') return String(val);
  return String(val).trim();
}

function displayValue(field, val) {
  if (val == null || val === '') return '—';
  if (field === 'budget' || field === 'smartScore') {
    const n = Number(val);
    if (Number.isFinite(n)) return `₹${n.toLocaleString('en-IN')}`;
  }
  if (field === 'status' || field === 'temperature' || field === 'statusReason' || field === 'coldReason') {
    return String(val).replace(/_/g, ' ');
  }
  if (field === 'travelDate' || field === 'returnDate' || field === 'nextFollowUp' || field === 'lastFollowUp') {
    const d = new Date(val);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    }
  }
  if (typeof val === 'boolean') return val ? 'yes' : 'no';
  if (typeof val === 'object' && val.name) return val.name;
  if (typeof val === 'object' && val._id) return String(val._id);
  return String(val);
}

function diffLeadChanges(before = {}, after = {}, fields = []) {
  const tracked = fields.length ? fields : LEAD_TRACKED_FIELDS;
  const changes = [];
  for (const field of tracked) {
    const oldVal = before[field];
    const newVal = after[field];
    const oldStr = normalizeCompareValue(oldVal);
    const newStr = normalizeCompareValue(newVal);
    if (oldStr !== newStr) {
      changes.push({
        field,
        label: FIELD_LABELS[field] || field,
        oldValue: oldVal ?? null,
        newValue: newVal ?? null,
        from: displayValue(field, oldVal),
        to: displayValue(field, newVal),
      });
    }
  }
  return changes;
}

function formatLeadChangeDescription(changes = [], { maxLines = 12 } = {}) {
  if (!changes.length) return 'Lead details updated';
  const lines = changes.slice(0, maxLines).map((c) => {
    const label = c.label || FIELD_LABELS[c.field] || c.field;
    const from = c.from ?? displayValue(c.field, c.oldValue);
    const to = c.to ?? displayValue(c.field, c.newValue);
    return `${label}: ${from} → ${to}`;
  });
  if (changes.length > maxLines) {
    lines.push(`+${changes.length - maxLines} more field(s)`);
  }
  return lines.join('\n');
}

function formatStatusChangeDescription({
  fromStatus,
  toStatus,
  fromTemperature,
  toTemperature,
  fromReason,
  toReason,
  fromColdToWarm = false,
} = {}) {
  const parts = [];
  if (fromStatus || toStatus) {
    parts.push(
      `Status: ${displayValue('status', fromStatus || '—')} → ${displayValue('status', toStatus || '—')}`
    );
  }
  if (fromTemperature || toTemperature) {
    if (String(fromTemperature || '') !== String(toTemperature || '')) {
      parts.push(
        `Temperature: ${displayValue('temperature', fromTemperature || '—')} → ${displayValue('temperature', toTemperature || '—')}`
      );
    }
  }
  if (toReason && String(toReason) !== String(fromReason || '')) {
    parts.push(`Option: ${displayValue('statusReason', fromReason || '—')} → ${displayValue('statusReason', toReason)}`);
  } else if (toReason) {
    parts.push(`Option: ${displayValue('statusReason', toReason)}`);
  }
  if (fromColdToWarm) parts.push('Cold to Warm');
  return parts.join('\n') || 'Status updated';
}

async function getEntityAuditLog(entityType, entityId, { page = 1, limit = 50 } = {}) {
  const lim = clampLimit(limit, { defaultLimit: 20, maxLimit: DETAIL_MAX_LIMIT });
  const skip = (Math.max(1, page) - 1) * lim;
  const filter = { entityType, entityId };
  const [data, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit: lim, total, totalPages: Math.ceil(total / lim) || 0 } };
}

async function listBranchAuditLogs(branchId, { page = 1, limit = 50, action, entityType = 'lead' } = {}) {
  const lim = clampLimit(limit, { defaultLimit: 30, maxLimit: DETAIL_MAX_LIMIT });
  const skip = (Math.max(1, page) - 1) * lim;
  const filter = { entityType, ...(branchId ? { branchId } : {}), ...(action ? { action } : {}) };
  const [data, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { data, pagination: { page, limit: lim, total, totalPages: Math.ceil(total / lim) || 0 } };
}

module.exports = {
  logAudit,
  diffLeadChanges,
  formatLeadChangeDescription,
  formatStatusChangeDescription,
  getEntityAuditLog,
  listBranchAuditLogs,
  LEAD_TRACKED_FIELDS,
  FIELD_LABELS,
};
