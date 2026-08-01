const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WhatsAppMessage = require('../models/WhatsAppMessage');

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || process.env.FACEBOOK_GRAPH_VERSION || 'v21.0';
const UPLOAD_DIR = path.join(__dirname, '../../uploads/whatsapp');

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/3gpp': '.3gp',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/aac': '.aac',
  'audio/mp4': '.m4a',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

function getAccessToken() {
  return process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '';
}

function getPhoneNumberId() {
  return process.env.WHATSAPP_PHONE_NUMBER_ID || '';
}

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function extForMime(mime = '', fallbackName = '') {
  const fromMime = MIME_EXT[String(mime || '').toLowerCase()];
  if (fromMime) return fromMime;
  const fromName = path.extname(String(fallbackName || ''));
  if (fromName) return fromName;
  return '';
}

function formatBytes(n) {
  const size = Number(n) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function publicUrlFor(fileName) {
  return `/uploads/whatsapp/${fileName}`;
}

async function fetchMediaMeta(mediaId) {
  const token = getAccessToken();
  if (!token || !mediaId) return null;
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Media meta failed (${res.status})`);
  }
  return data;
}

async function downloadMediaBinary(mediaUrl) {
  const token = getAccessToken();
  const res = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    throw new Error(`Media download failed (${res.status})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get('content-type') || '';
  return { buffer: buf, mime };
}

async function downloadAndStoreWhatsAppMedia({ mediaId, mimeType, filename }) {
  if (!mediaId) return null;
  ensureUploadDir();

  const meta = await fetchMediaMeta(mediaId);
  const mediaUrl = meta?.url;
  if (!mediaUrl) throw new Error('Media URL missing from Meta');

  const { buffer, mime } = await downloadMediaBinary(mediaUrl);
  const resolvedMime = mimeType || meta.mime_type || mime || 'application/octet-stream';
  const ext = extForMime(resolvedMime, filename || meta.filename);
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext || ''}`;
  const diskPath = path.join(UPLOAD_DIR, fileName);
  fs.writeFileSync(diskPath, buffer);

  return {
    id: mediaId,
    url: publicUrlFor(fileName),
    mimeType: resolvedMime,
    mime_type: resolvedMime,
    name: filename || meta.filename || `file${ext || ''}`,
    filename: filename || meta.filename || `file${ext || ''}`,
    size: formatBytes(buffer.length),
    fileSize: buffer.length,
    sha256: meta.sha256,
  };
}

function pickInboundMediaPayload(message = {}) {
  const type = message.type;
  if (type === 'image') return { type, payload: message.image };
  if (type === 'video') return { type, payload: message.video };
  if (type === 'audio') return { type, payload: message.audio };
  if (type === 'document') return { type, payload: message.document };
  if (type === 'sticker') return { type: 'image', payload: message.sticker };
  return { type: mapLooseType(type), payload: null };
}

function mapLooseType(type) {
  if (['text', 'image', 'document', 'audio', 'video'].includes(type)) return type;
  return 'unknown';
}

async function resolveInboundAttachment(message = {}) {
  const { type, payload } = pickInboundMediaPayload(message);
  if (!payload?.id) {
    return { type: mapLooseType(message.type), attachment: payload || null };
  }

  try {
    const stored = await downloadAndStoreWhatsAppMedia({
      mediaId: payload.id,
      mimeType: payload.mime_type,
      filename: payload.filename,
    });
    return {
      type,
      attachment: {
        ...stored,
        caption: payload.caption || '',
      },
    };
  } catch (err) {
    console.error('[whatsappMedia] download failed', payload.id, err.message);
    return {
      type,
      attachment: {
        id: payload.id,
        mime_type: payload.mime_type,
        mimeType: payload.mime_type,
        filename: payload.filename,
        name: payload.filename,
        caption: payload.caption || '',
        url: null,
      },
    };
  }
}

async function hydrateMessageAttachment(messageDoc) {
  if (!messageDoc) return messageDoc;
  const att = messageDoc.attachment;
  if (!att || att.url || !att.id) return messageDoc;

  try {
    const stored = await downloadAndStoreWhatsAppMedia({
      mediaId: att.id,
      mimeType: att.mimeType || att.mime_type,
      filename: att.filename || att.name,
    });
    const next = {
      ...att,
      ...stored,
      caption: att.caption || '',
    };
    await WhatsAppMessage.updateOne({ _id: messageDoc._id }, { $set: { attachment: next } });
    messageDoc.attachment = next;
  } catch (err) {
    console.error('[whatsappMedia] hydrate failed', messageDoc._id, err.message);
  }
  return messageDoc;
}

async function hydrateMessageAttachments(messages = []) {
  if (!Array.isArray(messages) || !messages.length) return messages || [];
  return Promise.all(
    messages.map((m) =>
      m?.attachment?.id && !m?.attachment?.url ? hydrateMessageAttachment(m) : Promise.resolve(m)
    )
  );
}

async function uploadBufferToWhatsApp({ buffer, mimeType, filename }) {
  const token = getAccessToken();
  const phoneNumberId = getPhoneNumberId();
  if (!token || !phoneNumberId) throw new Error('WhatsApp Cloud API is not configured');

  ensureUploadDir();
  const ext = extForMime(mimeType, filename);
  const localName = `${Date.now()}-out-${crypto.randomBytes(4).toString('hex')}${ext || ''}`;
  const diskPath = path.join(UPLOAD_DIR, localName);
  fs.writeFileSync(diskPath, buffer);

  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimeType || 'application/octet-stream');
  form.append(
    'file',
    new Blob([new Uint8Array(buffer)], { type: mimeType || 'application/octet-stream' }),
    filename || localName
  );

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/media`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || 'WhatsApp media upload failed');
  }

  return {
    mediaId: data.id,
    localUrl: publicUrlFor(localName),
    mimeType,
    name: filename || localName,
    size: formatBytes(buffer.length),
    fileSize: buffer.length,
  };
}

async function sendWhatsAppMediaMessage({ toPhone, type, mediaId, caption, filename }) {
  const token = getAccessToken();
  const phoneNumberId = getPhoneNumberId();
  if (!token || !phoneNumberId) throw new Error('WhatsApp Cloud API is not configured');

  const digits = String(toPhone || '').replace(/\D/g, '');
  const to = digits.length === 10 ? `91${digits}` : digits;

  const mediaKey = type === 'image' ? 'image' : type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'document';
  const mediaBody = { id: mediaId };
  if (caption && (type === 'image' || type === 'video' || type === 'document')) {
    mediaBody.caption = caption;
  }
  if (type === 'document' && filename) mediaBody.filename = filename;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: mediaKey,
      [mediaKey]: mediaBody,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || 'WhatsApp media send failed');
  }
  return data;
}

function decodeDataUrlOrBase64(input = '', fallbackMime = '') {
  const raw = String(input || '');
  const m = raw.match(/^data:([^;]+);base64,(.+)$/s);
  if (m) {
    return { mimeType: m[1], buffer: Buffer.from(m[2], 'base64') };
  }
  return { mimeType: fallbackMime || '', buffer: Buffer.from(raw, 'base64') };
}

module.exports = {
  resolveInboundAttachment,
  hydrateMessageAttachment,
  hydrateMessageAttachments,
  downloadAndStoreWhatsAppMedia,
  uploadBufferToWhatsApp,
  sendWhatsAppMediaMessage,
  decodeDataUrlOrBase64,
  formatBytes,
  publicUrlFor,
};
