const {
  FIRST_CONTACT_SLA,
  QUOTE_QUALIFICATION_FIELDS,
  LOST_REASON_VALUES,
  LOST_REASONS,
} = require('../constants/salesSop');
const ApiError = require('../utils/apiError');

function getIstParts(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: FIRST_CONTACT_SLA.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function istWallToUtc(year, month, day, hour, minute) {
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute - 30));
}

function addIstDays(parts, days) {
  const probe = istWallToUtc(parts.year, parts.month, parts.day, 12, 0);
  probe.setUTCDate(probe.getUTCDate() + days);
  return getIstParts(probe);
}

function isNightOrEarlyLead(date = new Date()) {
  const { hour, minute } = getIstParts(date);
  if (hour >= FIRST_CONTACT_SLA.nightStartsAtHour) return true;
  if (hour < FIRST_CONTACT_SLA.morningOpensAtHour) return true;
  if (hour === FIRST_CONTACT_SLA.morningOpensAtHour && minute < FIRST_CONTACT_SLA.nightCallByMinute) {
    return true;
  }
  return false;
}

function nightFirstContactDeadline(fromDate = new Date()) {
  const parts = getIstParts(fromDate);
  let target = parts;
  if (parts.hour >= FIRST_CONTACT_SLA.nightStartsAtHour) {
    target = addIstDays(parts, 1);
  }
  return istWallToUtc(
    target.year,
    target.month,
    target.day,
    FIRST_CONTACT_SLA.nightCallByHour,
    FIRST_CONTACT_SLA.nightCallByMinute
  );
}

function resolveSlaTier(lead) {
  if (lead?.isHot || lead?.temperature === 'hot' || lead?.temperature === 'vip' || lead?.leadScore === 'hot') {
    return { key: 'hot', minutes: FIRST_CONTACT_SLA.hotMinutes };
  }
  if (lead?.temperature === 'warm' || lead?.leadScore === 'high' || lead?.leadScore === 'medium') {
    return { key: 'warm', minutes: FIRST_CONTACT_SLA.warmMinutes };
  }
  return { key: 'cold', minutes: FIRST_CONTACT_SLA.coldMinutes };
}

function computeFirstContactDeadline(lead, fromDate = lead?.assignedAt || lead?.createdAt || new Date()) {
  const anchor = new Date(fromDate);
  if (Number.isNaN(anchor.getTime())) return null;
  if (isNightOrEarlyLead(anchor)) return nightFirstContactDeadline(anchor);
  const tier = resolveSlaTier(lead);
  return new Date(anchor.getTime() + tier.minutes * 60 * 1000);
}

function describeFirstContactSla(lead) {
  if (isNightOrEarlyLead(lead?.assignedAt || lead?.createdAt || new Date())) {
    return 'Night lead — call by 9:15 AM (IST)';
  }
  const tier = resolveSlaTier(lead);
  return `${tier.key} lead — call within ${tier.minutes} min`;
}

function isBlank(value) {
  if (value == null) return true;
  if (typeof value === 'number') return Number.isNaN(value);
  return String(value).trim() === '';
}

function getFieldValue(lead, field) {
  const keys = [field.key, ...(field.altKeys || [])];
  for (const key of keys) {
    if (lead?.[key] != null && !isBlank(lead[key])) return lead[key];
    if (field.allowZero && (lead?.[key] === 0 || lead?.[key] === '0')) return lead[key];
  }
  if (field.allowZero) return 0;
  return null;
}

function getMissingQualificationFields(lead) {
  const missing = [];
  for (const field of QUOTE_QUALIFICATION_FIELDS) {
    const value = getFieldValue(lead, field);

    if (field.allowZero) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) missing.push(field.label);
      continue;
    }

    if (field.min != null) {
      const n = Number(value);
      if (!Number.isFinite(n) || n < field.min) {
        missing.push(field.label);
        continue;
      }
    }

    if (field.key === 'travelDate') {
      const d = value ? new Date(value) : null;
      if (!d || Number.isNaN(d.getTime())) missing.push(field.label);
      continue;
    }

    if (isBlank(value)) missing.push(field.label);
  }
  return [...new Set(missing)];
}

function assertQualifiedForQuotation(lead) {
  const missing = getMissingQualificationFields(lead);
  if (missing.length) {
    throw new ApiError(400, `Complete requirements before quotation: ${missing.join(', ')}`);
  }
  // Contacted ≠ Qualified: quoting needs a genuine buyer with confirmed requirements.
  const status = String(lead?.status || '');
  const quoteReady = ['qualified', 'quotation_sent', 'follow_up', 'negotiation', 'converted'];
  if (status && !quoteReady.includes(status) && status !== 'working_progress') {
    // Allow working_progress only when fields are complete (treated as ready to qualify).
    // Block pure contacted/new from jumping straight to quotation.
    if (['new', 'contacted', 'reactivated'].includes(status)) {
      throw new ApiError(
        400,
        'Mark the lead as Qualified (genuine buyer + requirements confirmed) before sending a quotation. Contacted alone is not enough.'
      );
    }
  }
  return true;
}

/** Accepts enum key or `key — comment`. Returns normalized storage value. */
function assertValidLostReason(reason, { requireComment = false } = {}) {
  const value = String(reason || '').trim();
  if (!value) throw new ApiError(400, 'Lost reason is required');

  const parts = value.split(/\s*[—–]\s*/).map((p) => p.trim()).filter(Boolean);
  const key = parts[0] || '';
  const comment = parts.slice(1).join(' — ').trim();

  if (!LOST_REASON_VALUES.includes(key)) {
    throw new ApiError(
      400,
      `Invalid lost reason. Use one of: ${LOST_REASONS.map((r) => r.label).join(', ')}`
    );
  }
  if (requireComment && !comment) {
    throw new ApiError(400, 'Lost reason comment is required before marking lead as lost');
  }
  return comment ? `${key} — ${comment}` : key;
}

function lostReasonLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parts = raw.split(/\s*[—–]\s*/).map((p) => p.trim()).filter(Boolean);
  const key = parts[0] || '';
  const comment = parts.slice(1).join(' — ').trim();
  const label = LOST_REASONS.find((r) => r.value === key)?.label || key;
  return comment ? `${label} — ${comment}` : label;
}

module.exports = {
  getIstParts,
  isNightOrEarlyLead,
  computeFirstContactDeadline,
  describeFirstContactSla,
  resolveSlaTier,
  getMissingQualificationFields,
  assertQualifiedForQuotation,
  assertValidLostReason,
  lostReasonLabel,
};
