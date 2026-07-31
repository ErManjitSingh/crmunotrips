export function formatMessageTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatFullDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDateDivider(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatBudget(amount) {
  if (!amount) return '—';
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function formatTravelDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function getPhoneDigits(phone) {
  return (phone || '').replace(/\D/g, '');
}

/** WhatsApp-style display: +91 82194 40351 */
export function formatWhatsAppPhone(phoneOrWaId) {
  const digits = getPhoneDigits(phoneOrWaId);
  if (!digits) return '';
  const local = digits.length >= 10 ? digits.slice(-10) : digits;
  if (local.length === 10) {
    return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  }
  return digits.startsWith('91') ? `+${digits}` : `+91 ${digits}`;
}

/** Chat title like WhatsApp: profile name, else number */
export function resolveWhatsAppDisplayName(contact = {}, lead = null) {
  const profile = String(contact.profileName || '').trim();
  if (profile) return profile;
  return formatWhatsAppPhone(contact.waId || contact.phone) || lead?.name || 'WhatsApp';
}

export function groupMessagesByDate(messages) {
  const groups = [];
  let currentDate = null;
  messages.forEach((msg) => {
    const dateKey = new Date(msg.timestamp).toDateString();
    if (dateKey !== currentDate) {
      currentDate = dateKey;
      groups.push({ type: 'divider', date: msg.timestamp, key: `div-${dateKey}` });
    }
    groups.push({ type: 'message', data: msg, key: msg._id });
  });
  return groups;
}

export function getInitials(name) {
  return (name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Resolve /uploads/... against API host (same origin on production). */
export function resolveWhatsAppMediaUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('blob:') || url.startsWith('data:')) return url;
  const api = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const origin = api.replace(/\/api$/i, '');
  if (origin) return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
  return url.startsWith('/') ? url : `/${url}`;
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export function detectWhatsAppMediaType(file) {
  const mime = String(file?.type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}
