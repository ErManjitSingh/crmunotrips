const Lead = require('../models/Lead');
const Branch = require('../models/Branch');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { normalizeLeadInput } = require('../utils/normalizeLeadInput');
const { detectLeadType } = require('../services/leadTypeDetectionService');
const { applyLeadMetrics } = require('../services/leadScoringService');
const { runLeadAutoAssignment } = require('../services/leadAutoAssignmentService');
const { isLeadAutoAssignmentEnabled } = require('../config/assignment');
const { logLeadActivity } = require('./leadActivityService');
const { invalidate: invalidateDashboardCache } = require('./dashboardCacheService');
const { findDuplicateLeads } = require('./duplicateDetectionService');

let cachedSystemUserId = null;

async function resolveSystemCreatorId() {
  if (cachedSystemUserId) return cachedSystemUserId;
  const fromEnv = process.env.PUBLIC_LEAD_CREATED_BY;
  if (fromEnv) {
    cachedSystemUserId = fromEnv;
    return cachedSystemUserId;
  }
  const admin = await User.findOne({ role: 'admin', status: { $ne: 'disabled' } })
    .select('_id')
    .sort({ createdAt: 1 })
    .lean();
  if (!admin?._id) {
    throw new ApiError(503, 'No admin user available to own public leads');
  }
  cachedSystemUserId = admin._id;
  return cachedSystemUserId;
}

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
 * DPW — Google / website form leads.
 * DPW WA — Google Ads WhatsApp or landing-page WhatsApp.
 * DPW2 — Facebook / Instagram Lead Ads forms.
 * DPW2 WA — Facebook/Instagram Click-to-WhatsApp ads.
 */
function resolvePublicLeadSource(raw = {}) {
  const hint = [
    raw.sourceKey,
    raw.leadSource,
    raw.source,
    raw.sourceLabel,
    raw.channel,
    raw.captureType,
    raw.waAdSource,
    raw.inboundAdSource,
  ]
    .map((v) => String(v || '').toLowerCase().trim())
    .join(' ');

  const isFacebookForm =
    (/\bfacebook\b/.test(hint) ||
      /\bfb[_ ]?lead\b/.test(hint) ||
      hint.includes('facebook_ads') ||
      hint.includes('dpw2') ||
      String(raw.channel || '').toLowerCase() === 'facebook' ||
      String(raw.externalLeadSource || '').toLowerCase() === 'facebook_leadgen') &&
    !/\bwhatsapp\b/.test(hint) &&
    !hint.includes('dpw2_wa') &&
    !hint.includes('ctwa');

  if (isFacebookForm) {
    return {
      source: 'dpw2',
      sourceLabel: 'DPW2',
      channel: 'facebook',
    };
  }

  const isWhatsApp =
    /\bwhatsapp\b/.test(hint) ||
    hint.includes('dpw_wa') ||
    hint.includes('dpw2_wa') ||
    hint.includes('ctwa') ||
    String(raw.channel || '').toLowerCase() === 'whatsapp';

  if (isWhatsApp) {
    const inbound = String(raw.waAdSource || raw.inboundAdSource || '').toLowerCase();
    const isGoogleWa =
      hint.includes('dpw_wa') ||
      hint.includes('google_whatsapp') ||
      hint.includes('landing_whatsapp') ||
      inbound === 'google' ||
      inbound === 'google_ad' ||
      (/\bgoogle\b|\bgads\b|\bgclid\b/.test(hint) &&
        /\bwhatsapp\b|\bwa\b/.test(hint));

    const isFbWa =
      hint.includes('dpw2_wa') ||
      hint.includes('ctwa') ||
      hint.includes('facebook_whatsapp') ||
      hint.includes('fb_wa') ||
      hint.includes('meta_whatsapp') ||
      inbound === 'facebook_ad' ||
      ((/\bfacebook\b|\bmeta\b|\binstagram\b|\bfb\b/.test(hint) &&
        /\bwhatsapp\b|\bwa\b|\bctwa\b/.test(hint)));

    // Explicit Google → DPW WA; Meta CTWA → DPW2 WA; bare WhatsApp defaults to Google Ads WA (DPW WA)
    if (isFbWa && !isGoogleWa) {
      return {
        source: 'dpw2_wa',
        sourceLabel: 'DPW2 WA',
        channel: 'whatsapp',
      };
    }

    if (isGoogleWa) {
      return {
        source: 'dpw_wa',
        sourceLabel: 'DPW WA',
        channel: 'whatsapp',
      };
    }

    const defaultWa =
      String(process.env.WHATSAPP_DEFAULT_LEAD_SOURCE || 'dpw_wa')
        .trim()
        .toLowerCase() === 'dpw2_wa'
        ? 'dpw2_wa'
        : 'dpw_wa';

    return {
      source: defaultWa,
      sourceLabel: defaultWa === 'dpw_wa' ? 'DPW WA' : 'DPW2 WA',
      channel: 'whatsapp',
    };
  }

  return {
    source: 'dpw',
    sourceLabel: 'DPW',
    channel: 'website',
  };
}

/**
 * Ingest a website / Meta / Facebook public lead into CRM.
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
    `Website Lead ${phone.slice(-4)}`;

  const email = String(raw.email || raw.emaily || raw.user_email || '').trim() || undefined;
  const packageTitle = String(raw.package || raw['package-title'] || raw.packageTitle || '').trim();
  const captureType = String(raw.captureType || raw.type || 'form').trim().toLowerCase();
  const { source, sourceLabel, channel } = resolvePublicLeadSource(raw);

  const rawSourceText = String(raw.landingPage || raw.page || raw.landing || raw.sourceLabel || raw.source || '').trim();
  const landingPage =
    rawSourceText &&
    !['dpw', 'dpw wa', 'dpw call', 'dpw2', 'dpw2 wa', 'dpw2 call', 'website', 'facebook', 'facebook lead', 'facebook_ads', 'fb lead', 'meta', 'whatsapp', 'dpw_wa', 'dpw_call', 'dpw2_wa', 'dpw2_call'].includes(
      rawSourceText.toLowerCase()
    )
      ? rawSourceText
      : String(raw.landingPage || raw.page || raw.landing || '').trim();

  const noteParts = [];
  if (landingPage && landingPage !== sourceLabel) {
    noteParts.push(`Landing: ${landingPage}`);
  }
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
    preferredCallTime: String(raw.preferredCallTime || raw.bestTimeToCall || '').trim() || undefined,
    budget: Number(raw.budget) || 0,
    source,
    leadSource: source,
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
  data.source = source;
  data.leadSource = source;
  data.sourceLabel = sourceLabel;
  data.channel = channel;
  data.status = 'new';
  data.notes = body.notes;
  if (body.preferredCallTime) data.preferredCallTime = body.preferredCallTime;
  if (raw.externalLeadId) {
    data.externalLeadId = String(raw.externalLeadId).trim();
    data.externalLeadSource = String(raw.externalLeadSource || 'facebook_leadgen').trim();
  }

  const typeDetection = detectLeadType({ ...body, ...data });
  data.leadType = typeDetection.leadType;
  data.leadTypeSource = typeDetection.leadTypeSource;

  data.branchId = await resolvePublicBranchId(raw.branchId);
  data.createdBy = await resolveSystemCreatorId();

  const prior = await findDuplicateLeads({
    phone,
    alternatePhone: data.alternatePhone,
    branchId: data.branchId,
  });
  if (prior.length) {
    data.isRepeatCustomer = true;
  }

  await applyLeadMetrics(data);
  const lead = await Lead.create(data);

  const originLabel = landingPage || sourceLabel;
  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'lead_created',
    description: lead.isRepeatCustomer
      ? `Repeated lead captured from ${originLabel}${captureType === 'chatbot' ? ' (chatbot)' : ''} (matching phone)`
      : `Lead captured from ${originLabel}${captureType === 'chatbot' ? ' (chatbot)' : ''}`,
    actor: { _id: data.createdBy, name: sourceLabel },
    meta: {
      source,
      sourceLabel,
      channel,
      captureType,
      landingPage: landingPage || undefined,
      package: packageTitle || undefined,
      externalLeadId: data.externalLeadId || undefined,
      isRepeatCustomer: Boolean(lead.isRepeatCustomer),
    },
  });

  if (!data.assignedTo && data.branchId && (await isLeadAutoAssignmentEnabled())) {
    await runLeadAutoAssignment(lead, { triggeredBy: null });
  }

  invalidateDashboardCache('admin');
  if (data.branchId) invalidateDashboardCache(String(data.branchId));

  return lead;
}

module.exports = {
  ingestPublicLead,
  resolvePublicLeadSource,
  digitsPhone,
  formatTranscript,
};
