const crypto = require('crypto');
const Lead = require('../models/Lead');
const ApiError = require('../utils/apiError');
const { ingestPublicLead } = require('./publicLeadIngestService');
const { getDbStatus } = require('../config/db');

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || 'v21.0';

/** Ring buffer of recent webhook/debug events for ops diagnosis */
const RECENT_MAX = 50;
const recentEvents = [];

function isDebugEnabled() {
  return (
    String(process.env.FACEBOOK_WEBHOOK_DEBUG || '').toLowerCase() === 'true' ||
    process.env.NODE_ENV !== 'production'
  );
}

function pushRecent(entry) {
  recentEvents.unshift({
    at: new Date().toISOString(),
    ...entry,
  });
  if (recentEvents.length > RECENT_MAX) recentEvents.length = RECENT_MAX;
}

function debugLog(step, detail) {
  const line = {
    step,
    ...(detail && typeof detail === 'object' ? detail : { detail }),
  };
  if (isDebugEnabled()) {
    console.log('[facebookWebhook:debug]', JSON.stringify(line));
  }
  return line;
}

function getConfig() {
  return {
    verifyToken: process.env.FACEBOOK_VERIFY_TOKEN || '',
    pageAccessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    defaultDestination: process.env.FACEBOOK_DEFAULT_DESTINATION || 'Not specified',
    graphVersion: GRAPH_VERSION,
    debug: isDebugEnabled(),
  };
}

function isConfigured() {
  const { verifyToken, pageAccessToken } = getConfig();
  return Boolean(verifyToken && pageAccessToken);
}

function validateEnvOnBoot() {
  const cfg = getConfig();
  const issues = [];
  if (!cfg.verifyToken) issues.push('FACEBOOK_VERIFY_TOKEN missing');
  if (!cfg.pageAccessToken) issues.push('FACEBOOK_PAGE_ACCESS_TOKEN missing');
  if (!cfg.appSecret) {
    issues.push('FACEBOOK_APP_SECRET missing (signature verification disabled)');
  }
  if (issues.length) {
    console.warn('[facebookWebhook] env check:', issues.join('; '));
  } else {
    console.log('[facebookWebhook] env check: OK (verify + page token + app secret)');
  }
  return issues;
}

function verifyWebhookChallenge(query = {}) {
  const { verifyToken } = getConfig();
  const mode = String(query['hub.mode'] || '');
  const token = String(query['hub.verify_token'] || '');
  const challenge = String(query['hub.challenge'] || '');

  debugLog('verify_challenge', {
    mode,
    tokenPresent: Boolean(token),
    tokenMatches: Boolean(verifyToken && token === verifyToken),
    challengePresent: Boolean(challenge),
    query,
  });
  pushRecent({
    type: 'verify',
    mode,
    tokenMatches: Boolean(verifyToken && token === verifyToken),
    challengePresent: Boolean(challenge),
  });

  if (!verifyToken) {
    throw new ApiError(503, 'FACEBOOK_VERIFY_TOKEN is not configured');
  }
  if (mode === 'subscribe' && token === verifyToken && challenge) {
    debugLog('verify_challenge_ok', { challenge });
    return challenge;
  }
  throw new ApiError(403, 'Facebook webhook verification failed');
}

function verifyRequestSignature(rawBody, signatureHeader) {
  const { appSecret } = getConfig();
  if (!appSecret) {
    debugLog('signature_skip', { reason: 'FACEBOOK_APP_SECRET not set' });
    return true; // optional until secret is set
  }
  if (!signatureHeader || !rawBody) {
    debugLog('signature_fail', {
      reason: 'missing signature or rawBody',
      hasSignature: Boolean(signatureHeader),
      hasRawBody: Boolean(rawBody),
      rawBodyLength: rawBody ? Buffer.byteLength(rawBody) : 0,
    });
    return false;
  }

  const expected =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(String(signatureHeader));
  if (a.length !== b.length) {
    debugLog('signature_fail', { reason: 'length_mismatch', expectedLen: a.length, gotLen: b.length });
    return false;
  }
  try {
    const ok = crypto.timingSafeEqual(a, b);
    debugLog('signature_check', { ok });
    return ok;
  } catch (err) {
    debugLog('signature_error', { message: err.message, stack: err.stack });
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

/** Extract last 10 digits from any phone-like string. */
function extractPhoneDigits(raw = '') {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

/**
 * Find a usable phone in known keys, then scan all Instant Form field values.
 */
function resolvePhoneFromFields(fields = {}) {
  const named = pickFirst(fields, [
    'phone_number',
    'phone',
    'mobile',
    'mobile_number',
    'contact_number',
    'contact_no',
    'whatsapp',
    'whatsapp_number',
    'cell_phone',
    'cellphone',
    'telephone',
    'tel',
    'ph_number',
    'phone_no',
  ]);
  const fromNamed = extractPhoneDigits(named);
  if (fromNamed.length >= 10) return fromNamed;

  for (const [key, value] of Object.entries(fields)) {
    if (/email|name|city|date|destination|message|remark|comment/i.test(key)) continue;
    const digits = extractPhoneDigits(value);
    if (digits.length >= 10) return digits;
  }

  // Last resort: any value in the form with 10+ digits
  for (const value of Object.values(fields)) {
    const digits = extractPhoneDigits(value);
    if (digits.length >= 10) return digits;
  }

  return fromNamed || '';
}

/** Stable placeholder so CRM can still store the Facebook lead. */
function fallbackPhoneFromLeadgenId(leadgenId = '') {
  const digits = String(leadgenId).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return (`9${digits}0000000000`).slice(0, 10);
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

  let phone = resolvePhoneFromFields(fields);
  let phoneFallback = false;
  if (phone.length < 10) {
    phone = fallbackPhoneFromLeadgenId(graphLead.id || meta.leadgenId);
    phoneFallback = true;
  }

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
    phoneFallback
      ? 'WARNING: No valid phone in Instant Form — used placeholder from leadgen id. Add a Phone question to the form.'
      : '',
    ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`),
  ].filter(Boolean);

  return {
    name: name || combinedName || `Facebook Lead ${phone.slice(-4)}`,
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
    _mappedFields: fields,
    _phoneFallback: phoneFallback,
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

  debugLog('graph_fetch_start', { leadgenId, graphVersion: GRAPH_VERSION });
  const started = Date.now();
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({}));
  debugLog('graph_fetch_result', {
    leadgenId,
    httpStatus: res.status,
    ms: Date.now() - started,
    error: data?.error || null,
    fieldCount: Array.isArray(data?.field_data) ? data.field_data.length : 0,
    hasId: Boolean(data?.id),
  });

  if (!res.ok) {
    const msg = data?.error?.message || `Graph API error ${res.status}`;
    // Never echo the access token if Graph includes it in the error text.
    const safeMsg = String(msg).replace(/EAAG\w+|EAAf\w+/g, '[TOKEN_REDACTED]');
    const err = new ApiError(502, `Facebook lead fetch failed: ${safeMsg}`);
    err.graphError = data?.error
      ? {
          message: safeMsg,
          type: data.error.type,
          code: data.error.code,
          fbtrace_id: data.error.fbtrace_id,
        }
      : undefined;
    throw err;
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
  debugLog('ingest_start', { leadgenId, pageId, formId, adId, adgroupId, createdTime });

  const existing = await findExistingByExternalId(leadgenId);
  if (existing) {
    debugLog('ingest_duplicate', { leadgenId, leadId: existing.leadId || existing._id });
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

  debugLog('ingest_mapped', {
    leadgenId,
    name: payload.name,
    hasPhone: Boolean(payload.phone),
    phoneFallback: Boolean(payload._phoneFallback),
    hasEmail: Boolean(payload.email),
    destination: payload.destination,
    fields: payload._mappedFields,
  });

  if (!payload.phone || String(payload.phone).replace(/\D/g, '').length < 10) {
    throw new ApiError(
      400,
      `Facebook lead ${leadgenId} has no usable phone. Form fields: ${Object.keys(payload._mappedFields || {}).join(', ') || '(none)'}`
    );
  }

  const again = await findExistingByExternalId(payload.externalLeadId);
  if (again) {
    return { duplicate: true, lead: again };
  }

  const { _mappedFields, _phoneFallback, ...persistPayload } = payload;
  const lead = await ingestPublicLead(persistPayload);
  debugLog('ingest_mongo_ok', {
    leadgenId,
    mongoId: lead?._id,
    leadId: lead?.leadId,
    phone: lead?.phone,
    phoneFallback: Boolean(_phoneFallback),
  });
  return { duplicate: false, lead, phoneFallback: Boolean(_phoneFallback) };
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
 * Process webhook payload (Graph fetch + Mongo). Safe to run after HTTP 200 ACK.
 */
async function processFacebookWebhook(body = {}) {
  const events = extractLeadgenEvents(body);
  debugLog('process_start', {
    object: body?.object,
    entryCount: Array.isArray(body?.entry) ? body.entry.length : 0,
    leadgenCount: events.length,
  });

  const results = [];

  for (const event of events) {
    try {
      const result = await ingestFacebookLeadgen(event);
      const row = {
        leadgenId: event.leadgenId,
        ok: true,
        duplicate: Boolean(result.duplicate),
        leadId: result.lead?.leadId || result.lead?._id,
      };
      results.push(row);
      pushRecent({ type: 'ingest', ...row, pageId: event.pageId });
    } catch (err) {
      console.error(
        '[facebookWebhook] lead ingest failed',
        event.leadgenId,
        err.message,
        err.stack || ''
      );
      const row = {
        leadgenId: event.leadgenId,
        ok: false,
        message: err.message,
        graphError: err.graphError || undefined,
      };
      results.push(row);
      pushRecent({
        type: 'ingest_error',
        leadgenId: event.leadgenId,
        message: err.message,
        stack: err.stack,
        graphError: err.graphError,
      });
    }
  }

  debugLog('process_done', { received: events.length, results });
  return { received: events.length, results };
}

/**
 * Fire-and-forget processing so Meta always gets a fast HTTP 200.
 */
function processFacebookWebhookAsync(body = {}) {
  setImmediate(() => {
    processFacebookWebhook(body).catch((err) => {
      console.error('[facebookWebhook] async process crashed', err.message, err.stack || '');
      pushRecent({
        type: 'async_crash',
        message: err.message,
        stack: err.stack,
      });
    });
  });
}

async function probePageTokenHealth() {
  const { pageAccessToken, graphVersion } = getConfig();
  if (!pageAccessToken) {
    return { ok: false, error: 'FACEBOOK_PAGE_ACCESS_TOKEN missing' };
  }
  try {
    const url = new URL(`https://graph.facebook.com/${graphVersion}/me`);
    url.searchParams.set('access_token', pageAccessToken);
    url.searchParams.set('fields', 'id,name');
    const res = await fetch(url.toString());
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = String(data?.error?.message || `HTTP ${res.status}`).replace(
        /EAAG\w+|EAAf\w+/g,
        '[TOKEN_REDACTED]'
      );
      return {
        ok: false,
        error: msg,
        code: data?.error?.code,
        hint: 'Regenerate a long-lived Page Access Token in Graph API Explorer (User or Page → select the Page), then set FACEBOOK_PAGE_ACCESS_TOKEN on the VPS.',
      };
    }
    return { ok: true, id: data.id, name: data.name };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function getDiagnostics() {
  const cfg = getConfig();
  const db = getDbStatus();
  const primaryCallback = 'https://app.unotrips.com/api/facebook/webhook';
  const altCallback = 'https://app.unotrips.com/api/webhooks/facebook';
  const envIssues = [];
  if (!cfg.verifyToken) envIssues.push('FACEBOOK_VERIFY_TOKEN missing');
  if (!cfg.pageAccessToken) envIssues.push('FACEBOOK_PAGE_ACCESS_TOKEN missing');
  if (!cfg.appSecret) envIssues.push('FACEBOOK_APP_SECRET missing');

  return {
    ok: true,
    configured: isConfigured(),
    debug: cfg.debug,
    hasVerifyToken: Boolean(cfg.verifyToken),
    hasPageAccessToken: Boolean(cfg.pageAccessToken),
    hasAppSecret: Boolean(cfg.appSecret),
    graphVersion: cfg.graphVersion,
    defaultDestination: cfg.defaultDestination,
    database: db,
    envIssues,
    callbackUrl: primaryCallback,
    alternateCallbackUrl: altCallback,
    recentEvents: recentEvents.slice(0, 25),
    likelyFailureReasons: [
      !cfg.verifyToken || !cfg.pageAccessToken
        ? 'Backend env incomplete — Meta POSTs may be rejected or Graph fetch fails'
        : null,
      !cfg.appSecret
        ? 'FACEBOOK_APP_SECRET not set — signature not verified (OK for now, set for production)'
        : null,
      'Meta App → Webhooks → Page must show Callback URL verified + leadgen subscribed (subscribed_apps alone is not enough)',
      'App in Development mode: only admins/developers/testers generate deliverable test leads',
      'Lead form must include a phone field or CRM ingest will fail after webhook ACK',
      'Page Access Token must be long-lived and include leads_retrieval',
    ].filter(Boolean),
    instructions: [
      '1. Meta App → Webhooks → Page → Callback URL must be verified',
      `2. Callback URL: ${primaryCallback}`,
      '3. Verify token must match FACEBOOK_VERIFY_TOKEN in backend .env',
      '4. Subscribe field: leadgen',
      '5. POST /{page-id}/subscribed_apps?subscribed_fields=leadgen',
      '6. Set FACEBOOK_PAGE_ACCESS_TOKEN (long-lived) + FACEBOOK_APP_SECRET',
      '7. Check GET /api/facebook/webhook/debug?token=VERIFY_TOKEN after a test lead',
    ],
  };
}

function recordIncomingWebhook({ method, path, query, headers, body, rawBodyLength }) {
  const safeHeaders = {
    'content-type': headers['content-type'],
    'user-agent': headers['user-agent'],
    'x-hub-signature-256': headers['x-hub-signature-256'] ? '[present]' : '[missing]',
    'x-forwarded-for': headers['x-forwarded-for'],
    'x-forwarded-proto': headers['x-forwarded-proto'],
  };
  debugLog('incoming_request', {
    method,
    path,
    query,
    headers: safeHeaders,
    rawBodyLength,
    bodyPreview: body,
  });
  pushRecent({
    type: 'incoming',
    method,
    path,
    query,
    headers: safeHeaders,
    rawBodyLength,
    object: body?.object,
    leadgenIds: extractLeadgenEvents(body || {}).map((e) => e.leadgenId),
  });
}

module.exports = {
  getConfig,
  isConfigured,
  validateEnvOnBoot,
  verifyWebhookChallenge,
  verifyRequestSignature,
  processFacebookWebhook,
  processFacebookWebhookAsync,
  ingestFacebookLeadgen,
  mapLeadFields,
  extractLeadgenEvents,
  getDiagnostics,
  probePageTokenHealth,
  recordIncomingWebhook,
  getRecentEvents: () => recentEvents.slice(),
};
