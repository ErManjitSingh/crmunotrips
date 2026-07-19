const Lead = require('../models/Lead');
const Branch = require('../models/Branch');
const ApiError = require('../utils/apiError');
const { normalizeLeadInput } = require('../utils/normalizeLeadInput');
const { detectLeadType } = require('../services/leadTypeDetectionService');
const { applyLeadMetrics } = require('../services/leadScoringService');
const { runLeadAutoAssignment } = require('../services/leadAutoAssignmentService');
const { LEAD_AUTO_ASSIGNMENT_ENABLED } = require('../config/assignment');
const { logLeadActivity } = require('./leadActivityService');
const { invalidate: invalidateDashboardCache } = require('./dashboardCacheService');

function digitsPhone(raw = '') {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

function formatTranscript(chat) {
  if (!chat) return '';
  let lines = chat;
  if (typeof chat === 'string') {
    try {
      lines = JSON.parse(chat);
    } catch {
      return chat.trim();
    }
  }
  if (!Array.isArray(lines)) return String(chat);
  return lines
    .map((row) => {
      const who = row?.who === 'bot' ? 'Bot' : 'User';
      const text = String(row?.text || '').trim();
      return text ? `${who}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

async function resolvePublicBranchId(explicitBranchId) {
  if (explicitBranchId) {
    const branch = await Branch.findById(explicitBranchId).select('_id status').lean();
    if (branch?.status === 'active') return branch._id;
  }
  const fromEnv = process.env.PUBLIC_LEAD_BRANCH_ID;
  if (fromEnv) {
    const branch = await Branch.findById(fromEnv).select('_id status').lean();
    if (branch?.status === 'active') return branch._id;
  }
  const first = await Branch.findOne({ status: 'active' }).select('_id').lean();
  return first?._id || null;
}

/**
 * Ingest a Meta landing / chatbot lead into CRM.
 * Budget is optional (defaults to 0). Phone + destination required.
 */
async function ingestPublicLead(raw = {}) {
  const phone = digitsPhone(raw.phone || raw.mobile || raw.phoney || '');
  if (phone.length < 10) {
    throw new ApiError(400, 'Valid phone number is required');
  }

  const destination =
    String(
      raw.destination ||
        raw.destinationy ||
        raw.city ||
        ''
    ).trim() || 'Not specified';

  const name =
    String(raw.name || raw.namey || raw.user_name || '').trim() ||
    `Meta Lead ${phone.slice(-4)}`;

  const email = String(raw.email || raw.emaily || raw.user_email || '').trim() || undefined;
  const packageTitle = String(raw.package || raw['package-title'] || raw.packageTitle || '').trim();
  const sourceLabel = String(
    raw.sourceLabel || raw.source || raw.landingPage || 'Meta Landing Page'
  ).trim();
  const channel = String(raw.channel || 'meta').trim() || 'meta';
  const captureType = String(raw.captureType || raw.type || 'form').trim().toLowerCase();

  const noteParts = [];
  if (packageTitle) noteParts.push(`Package: ${packageTitle}`);
  if (raw.message) noteParts.push(String(raw.message).trim());
  const transcript = formatTranscript(raw.chat || raw.transcript || raw.conversation);
  if (transcript) {
    noteParts.push(captureType === 'chatbot' ? 'Chatbot conversation:' : 'Conversation:');
    noteParts.push(transcript);
  }
  if (raw.notes) noteParts.push(String(raw.notes).trim());

  const body = {
    name,
    phone,
    whatsapp: phone,
    email,
    destination,
    city: String(raw.city || raw.cityy || '').trim() || undefined,
    travelDate: raw.travelDate || raw.travel_date || undefined,
    travelers: Number(raw.travelers || raw.travellers) || 1,
    adults: Number(raw.adults || raw.travelers || raw.travellers) || 1,
    budget: Number(raw.budget) || 0,
    source: 'facebook_ads',
    leadSource: 'facebook_ads',
    sourceLabel,
    channel,
    notes: noteParts.filter(Boolean).join('\n\n'),
    specialRequirements: packageTitle || undefined,
    priority: 'medium',
    status: 'new',
  };

  const data = normalizeLeadInput(body);
  data.name = name;
  data.phone = phone;
  data.whatsapp = phone;
  data.destination = destination;
  data.budget = Number(data.budget) || 0;
  data.budgetRange = data.budget > 0 ? data.budgetRange : 'custom';
  data.source = 'facebook_ads';
  data.leadSource = 'facebook_ads';
  data.sourceLabel = sourceLabel;
  data.channel = channel;
  data.status = 'new';
  data.notes = body.notes;

  const typeDetection = detectLeadType({ ...body, ...data });
  data.leadType = typeDetection.leadType;
  data.leadTypeSource = typeDetection.leadTypeSource;

  data.branchId = await resolvePublicBranchId(raw.branchId);

  await applyLeadMetrics(data);
  const lead = await Lead.create(data);

  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'lead_created',
    description: `Lead captured from ${sourceLabel}${captureType === 'chatbot' ? ' (chatbot)' : ''}`,
    actor: null,
    meta: {
      source: 'facebook_ads',
      channel,
      captureType,
      landingPage: sourceLabel,
      package: packageTitle || undefined,
    },
  });

  if (!data.assignedTo && data.branchId && LEAD_AUTO_ASSIGNMENT_ENABLED) {
    await runLeadAutoAssignment(lead, { triggeredBy: null });
  }

  invalidateDashboardCache('admin');
  if (data.branchId) invalidateDashboardCache(String(data.branchId));

  return lead;
}

module.exports = {
  ingestPublicLead,
  digitsPhone,
  formatTranscript,
};
