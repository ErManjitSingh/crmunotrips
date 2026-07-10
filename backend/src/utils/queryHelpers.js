const { getLeadSourceShortLabel } = require('./leadSourceLabels');

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const LEAD_POPULATE = [
  { path: 'assignedTo', select: 'name email' },
  { path: 'assignedManager', select: 'name email' },
  { path: 'assignedTeamLeader', select: 'name email' },
  { path: 'createdBy', select: 'name email' },
  { path: 'lastContactedBy', select: 'name email' },
  { path: 'teamId', select: 'name' },
  { path: 'reactivation.reactivatedBy', select: 'name email' },
  { path: 'reactivation.reassignedBy', select: 'name email' },
  { path: 'reactivation.reassignedTo', select: 'name email' },
  { path: 'reactivation.stageHistory.by', select: 'name email' },
];

/** Lightweight populate for paginated list — skips nested stageHistory */
const LEAD_LIST_POPULATE = [
  { path: 'assignedTo', select: 'name email' },
  { path: 'assignedTeamLeader', select: 'name email' },
  { path: 'createdBy', select: 'name email' },
];

const FOLLOWUP_POPULATE = [
  {
    path: 'lead',
    select: 'name phone email destination status budget travelDate assignedTo priority isHot isRepeatCustomer leadId',
    populate: { path: 'assignedTo', select: 'name email' },
  },
  { path: 'assignedTo', select: 'name email' },
  { path: 'createdBy', select: 'name email' },
];

const QUOTATION_POPULATE = [
  {
    path: 'lead',
    populate: [{ path: 'assignedTo', select: 'name email' }],
  },
  { path: 'package' },
  { path: 'createdBy', select: 'name email role' },
  { path: 'createdByExecutive', select: 'name email' },
  { path: 'teamLeader', select: 'name email' },
  { path: 'approvedBy', select: 'name email' },
];

const { computeExecutiveStallFlags } = require('../services/leadExecutiveStallService');

function enrichLead(lead) {
  const obj = lead?.toObject ? lead.toObject() : { ...lead };
  const travelMs = obj.travelDate ? new Date(obj.travelDate).getTime() - Date.now() : Infinity;
  const isUrgent = travelMs < 14 * 86400000;
  const isHighBudget = (obj.budget || 0) >= 200000;
  const isHot =
    obj.isHot ||
    obj.priority === 'high' ||
    obj.priority === 'urgent' ||
    isHighBudget ||
    isUrgent ||
    obj.isRepeatCustomer;

  const sourceShort = getLeadSourceShortLabel(obj.source, obj.sourceLabel || obj.leadSource);

  const temperatureEmoji = {
    hot: '🔥',
    warm: '🟡',
    cold: '⚪',
    vip: '💎',
  };

  const stallFlags = computeExecutiveStallFlags(obj);

  return {
    ...obj,
    isHot,
    isUrgent,
    isHighBudget,
    isUnassigned: !obj.assignedTo,
    sourceShort,
    sourceLabel: sourceShort,
    temperatureLabel: obj.temperature ? `${temperatureEmoji[obj.temperature] || ''} ${obj.temperature}`.trim() : null,
    ...stallFlags,
  };
}

function buildLeadSearchFilter(search) {
  if (!search?.trim()) return {};
  const q = search.trim();
  const digitsOnly = q.replace(/\D/g, '');

  if (digitsOnly.length >= 4 && /^[\d\s+\-()]+$/.test(q)) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return {
      $or: [
        { phone: { $regex: escaped, $options: 'i' } },
        { alternatePhone: { $regex: escaped, $options: 'i' } },
        { whatsapp: { $regex: escaped, $options: 'i' } },
      ],
    };
  }

  const textQuery = q.replace(/[^\w\s@.-]/g, ' ').trim();
  if (!textQuery) return {};
  return { $text: { $search: textQuery } };
}

function buildFollowUpTabFilter(tab) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  if (tab === 'today') {
    return { scheduledAt: { $gte: todayStart, $lte: todayEnd } };
  }
  if (tab === 'upcoming') {
    return { status: 'pending', scheduledAt: { $gt: todayEnd } };
  }
  if (tab === 'missed') {
    return {
      $or: [{ status: 'missed' }, { status: 'pending', scheduledAt: { $lt: todayStart } }],
    };
  }
  return {};
}

function isMissedFollowUp(followUp, now = new Date()) {
  if (followUp.status === 'missed') return true;
  return followUp.status === 'pending' && new Date(followUp.scheduledAt) < startOfDay(now);
}

function formatNotification(n) {
  const obj = n.toObject ? n.toObject() : n;
  const created = obj.createdAt ? new Date(obj.createdAt) : new Date();
  const diffMs = Date.now() - created.getTime();
  const mins = Math.floor(diffMs / 60000);
  let time = 'just now';
  if (mins >= 60) time = `${Math.floor(mins / 60)} hr${Math.floor(mins / 60) > 1 ? 's' : ''} ago`;
  else if (mins >= 1) time = `${mins} min ago`;

  return {
    _id: obj._id,
    userId: obj.user?._id || obj.user,
    type: obj.type,
    title: obj.title,
    message: obj.message,
    read: obj.read,
    isRead: !!obj.read,
    meta: obj.meta || {},
    time,
    createdAt: obj.createdAt,
  };
}

function generateQuoteNumber() {
  return `Q-${Date.now().toString().slice(-6)}`;
}

const { buildFollowUpCategoryFilter } = require('./followUpHelpers');

module.exports = {
  startOfDay,
  endOfDay,
  LEAD_POPULATE,
  LEAD_LIST_POPULATE,
  FOLLOWUP_POPULATE,
  QUOTATION_POPULATE,
  enrichLead,
  buildLeadSearchFilter,
  buildFollowUpTabFilter,
  buildFollowUpCategoryFilter,
  isMissedFollowUp,
  formatNotification,
  generateQuoteNumber,
};
