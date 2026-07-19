const crypto = require('crypto');
const Lead = require('../models/Lead');
const ApiError = require('../utils/apiError');
const { ingestPublicLead } = require('./publicLeadIngestService');

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || 'v21.0';

function getConfig() {
  return {
    verifyToken: process.env.FACEBOOK_VERIFY_TOKEN || '',
    pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    defaultDestination: process.env.FACEBOOK_DEFAULT_DESTINATION || 'Not specified',
  };
}

function isConfigured() {
  const { verifyToken, pageAccessToken } = getConfig();
  return Boolean(verifyToken && pageAccessToken);
}

function verifyWebhookChallenge(query = {}) {
  const { verifyToken } = getConfig();
  const mode = String(query['hub.mode'] || '');
  const token = String(query['hub.verify_token'] || '');
  const challenge = String(query['hub.challenge'] || '');

  if (!verifyToken) {
    throw new ApiError(503, 'FACEBOOK_VERIFY_TOKEN is not configured');
  }
  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return challenge;
  }
  throw new ApiError(403, 'Facebook webhook verification failed');
}

function verifyRequestSignature(rawBody, signatureHeader) {
  const { appSecret } = getConfig();
  if (!appSecret) return true; // optional until secret is set
  if (!signatureHeader || !rawBody) return false;

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signatureHeader)));
  } catch {
    return false;
  }
}

function normalizeFieldName(name = '') {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function fieldDataToMap(fieldData = []) {
  const map = {};
  for (const row of fieldData) {
    const key = normalizeFieldName(row?.name);
    const values = Array.isArray(row?.values) ? row.values : [];
    const value = String(values[0] ?? '').trim();
    if (key) map[key] = value;
  }
  return map;
}

function pickFirst(map, keys) {
  for (const key of keys) {
    if (map[key]) return map[key];
  }
  return '';
}

function mapLeadFields(graphLead = {}, meta = {}) {
  const fields = fieldDataToMap(graphLead.field_data || []);
  const name = pickFirst(fields, [
    'full_name',
    'full name',
    'name',
    'first_name',
    'your_name',
    'customer_name',
  ]);
  const first = pickFirst(fields, ['first_name', 'firstname']);
  const last = pickFirst(fields, ['last_name', 'lastname']);
  const combinedName = [first, last].filter(Boolean).join(' ').trim();

  const phone = pickFirst(fields, [
    'phone_number',
    'phone',
    'mobile',
    'mobile_number',
    'contact_number',
    'whatsapp',
    'whatsapp_number',
  ]);
  const email = pickFirst(fields, ['email', 'email_address', 'work_email']);
  const destination = pickFirst(fields, [
    'destination',
    'preferred_destination',
    'travel_destination',
    'where_do_you_want_to_go',
    'city',
    'trip_destination',
  ]);
  const city = pickFirst(fields, ['city', 'your_city', 'current_city']);
  const travelDate = pickFirst(fields, [
    'travel_date',
    'travel_dates',
    'preferred_travel_date',
    'when_do_you_want_to_travel',
  ]);
  const travelers = pickFirst(fields, [
    'travelers',
    'travellers',
    'number_of_travelers',
    'no_of_travellers',
    'guests',
  ]);
  const message = pickFirst(fields, [
    'message',
    'comments',
    'remark',
    'remarks',
    'additional_details',
    'query',
  ]);

  const { defaultDestination } = getConfig();
  const noteLines = [
    `FB Leadgen: ${graphLead.id || meta.leadgenId || ''}`,
    meta.formId ? `FB Form: ${meta.formId}` : '',
    meta.adId ? `FB Ad: ${meta.adId}` : '',
    meta.pageId ? `FB Page: ${meta.pageId}` : '',
    ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`),
  ].filter(Boolean);

  return {
    name: name || combinedName || `Facebook Lead ${(phone || '').slice(-4)}`,
    phone,
    email,
    destination: destination || defaultDestination,
    city: city || undefined,
    travelDate: travelDate || undefined,
    travelers: travelers || undefined,
    message: message || undefined,
    notes: noteLines.join('\n'),
    channel: 'facebook',
    source: 'Facebook Lead',
    sourceLabel: 'Facebook Lead',
    sourceKey: 'facebook_ads',
    captureType: 'facebook_lead_ads',
    externalLeadId: String(graphLead.id || meta.leadgenId || ''),
    externalLeadSource: 'facebook_leadgen',
  };
}

async function fetchLeadFromGraph(leadgenId) {
  const { pageAccessToken } = getConfig();
  if (!pageAccessToken) {
    throw new ApiError(503, 'FACEBOOK_PAGE_ACCESS_TOKEN is not configured');
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}`);
  url.searchParams.set('access_token', pageAccessToken);
  url.searchParams.set('fields', 'id,created_time,ad_id,form_id,field_data');

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Graph API error ${res.status}`;
    throw new ApiError(502, `Facebook lead fetch failed: ${msg}`);
  }
  return data;
}

async function findExistingByExternalId(externalLeadId) {
  if (!externalLeadId) return null;
  return Lead.findOne({
    externalLeadId: String(externalLeadId),
    isDeleted: { $ne: true },
  })
    .select('_id leadId name phone sourceLabel')
    .lean();
}

async function ingestFacebookLeadgen({ leadgenId, pageId, formId, adId, adgroupId, createdTime }) {
  const existing = await findExistingByExternalId(leadgenId);
  if (existing) {
    return { duplicate: true, lead: existing };
  }

  const graphLead = await fetchLeadFromGraph(leadgenId);
  const payload = mapLeadFields(graphLead, {
    leadgenId,
    pageId,
    formId,
    adId,
    adgroupId,
    createdTime,
  });

  if (!payload.phone) {
    throw new ApiError(400, `Facebook lead ${leadgenId} has no phone number`);
  }

  const again = await findExistingByExternalId(payload.externalLeadId);
  if (again) {
    return { duplicate: true, lead: again };
  }

  const lead = await ingestPublicLead(payload);
  return { duplicate: false, lead };
}

function extractLeadgenEvents(body = {}) {
  const events = [];
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field !== 'leadgen') continue;
      const value = change.value || {};
      if (!value.leadgen_id) continue;
      events.push({
        leadgenId: String(value.leadgen_id),
        pageId: String(value.page_id || entry.id || ''),
        formId: value.form_id ? String(value.form_id) : '',
        adId: value.ad_id ? String(value.ad_id) : '',
        adgroupId: value.adgroup_id ? String(value.adgroup_id) : '',
        createdTime: value.created_time || null,
      });
    }
  }
  return events;
}

/**
 * Process webhook payload. Always acknowledge Meta quickly; errors are logged per lead.
 */
async function processFacebookWebhook(body = {}) {
  const events = extractLeadgenEvents(body);
  const results = [];

  for (const event of events) {
    try {
      const result = await ingestFacebookLeadgen(event);
      results.push({
        leadgenId: event.leadgenId,
        ok: true,
        duplicate: Boolean(result.duplicate),
        leadId: result.lead?.leadId || result.lead?._id,
      });
    } catch (err) {
      console.error('[facebookWebhook] lead ingest failed', event.leadgenId, err.message);
      results.push({
        leadgenId: event.leadgenId,
        ok: false,
        message: err.message,
      });
    }
  }

  return { received: events.length, results };
}

module.exports = {
  getConfig,
  isConfigured,
  verifyWebhookChallenge,
  verifyRequestSignature,
  processFacebookWebhook,
  ingestFacebookLeadgen,
  mapLeadFields,
  extractLeadgenEvents,
};
