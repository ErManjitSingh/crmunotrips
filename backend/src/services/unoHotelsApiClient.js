const ApiError = require('../utils/apiError');

const BASE_URL = (process.env.UNO_HOTELS_API_BASE_URL || 'https://api.unohotelsandresorts.com').replace(/\/$/, '');

let cachedAdminToken = null;
let tokenExpiresAt = 0;

function unwrapPayload(json) {
  if (!json || typeof json !== 'object') return json;
  if (json.data && typeof json.data === 'object' && !Array.isArray(json.data)) return json.data;
  return json;
}

function unwrapListPayload(json) {
  if (Array.isArray(json)) return json;
  const unwrapped = unwrapPayload(json);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (Array.isArray(unwrapped?.items)) return unwrapped.items;
  if (Array.isArray(unwrapped?.hotels)) return unwrapped.hotels;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

function sanitizeImageUrl(url, { allowDataImages = false } = {}) {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:')) {
    if (allowDataImages && /^data:image\//i.test(url)) return url;
    return '';
  }
  return url;
}

function sanitizeImages(images = [], options = {}) {
  return (Array.isArray(images) ? images : []).map((url) => sanitizeImageUrl(url, options)).filter(Boolean);
}

async function getAdminToken() {
  if (process.env.UNO_HOTELS_ADMIN_TOKEN) return process.env.UNO_HOTELS_ADMIN_TOKEN;

  const email = process.env.UNO_HOTELS_ADMIN_EMAIL;
  const password = process.env.UNO_HOTELS_ADMIN_PASSWORD;
  if (!email || !password) return null;

  if (cachedAdminToken && Date.now() < tokenExpiresAt) return cachedAdminToken;

  const res = await fetch(`${BASE_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(502, json.message || 'Failed to authenticate with Uno Hotels API');
  }

  const payload = unwrapPayload(json);
  const token = payload?.tokens?.access_token;
  if (!token) throw new ApiError(502, 'Uno Hotels API login did not return an access token');

  cachedAdminToken = token;
  tokenExpiresAt = Date.now() + Math.max(60, Number(payload.tokens.expires_in || 3600) - 60) * 1000;
  return token;
}

async function unoFetch(path, { query = {}, admin = false, method = 'GET', body = null } = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const headers = { Accept: 'application/json' };
  if (admin) {
    const token = await getAdminToken();
    if (!token) throw new ApiError(503, 'Uno Hotels admin credentials are not configured');
    headers.Authorization = `Bearer ${token}`;
  }

  const init = { method, headers };
  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status >= 500 ? 502 : res.status, json.message || 'Uno Hotels API request failed');
  }

  return json;
}

module.exports = {
  BASE_URL,
  unwrapPayload,
  unwrapListPayload,
  sanitizeImageUrl,
  sanitizeImages,
  getAdminToken,
  unoFetch,
};
