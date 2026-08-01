/**
 * State ↔ city destination families for package / analytics matching.
 * Keep in sync with backend MARGIN_STATES (destinationMarginService).
 */
export const DESTINATION_FAMILIES = [
  {
    name: 'Himachal Pradesh',
    aliases: ['Himachal', 'Manali', 'Shimla', 'Kasol', 'Dharamshala', 'Spiti', 'Kullu'],
  },
  { name: 'Goa', aliases: [] },
  {
    name: 'Kerala',
    aliases: ["God's Own Country", 'Munnar', 'Alleppey', 'Kochi', 'Alappuzha', 'Wayanad'],
  },
  {
    name: 'Rajasthan',
    aliases: ['Jaipur', 'Udaipur', 'Jodhpur', 'Jaisalmer', 'Pushkar'],
  },
  {
    name: 'Uttarakhand',
    aliases: ['Rishikesh', 'Mussoorie', 'Nainital', 'Haridwar', 'Auli', 'Jim Corbett'],
  },
  {
    name: 'Jammu and Kashmir',
    aliases: ['Kashmir', 'Srinagar', 'Gulmarg', 'Pahalgam', 'Jammu Kashmir'],
  },
  {
    name: 'Ladakh',
    aliases: ['Leh Ladakh', 'Leh', 'Nubra', 'Pangong'],
  },
  {
    name: 'Andaman and Nicobar',
    aliases: ['Andaman', 'Andaman Islands', 'Port Blair', 'Havelock'],
  },
  {
    name: 'Sikkim',
    aliases: ['Gangtok', 'Lachung', 'Pelling'],
  },
  {
    name: 'Meghalaya',
    aliases: ['Shillong', 'Cherrapunji'],
  },
  {
    name: 'Maharashtra',
    aliases: ['Mumbai', 'Lonavala', 'Mahabaleshwar'],
  },
  {
    name: 'Karnataka',
    aliases: ['Coorg', 'Bangalore', 'Bengaluru', 'Mysore', 'Gokarna'],
  },
  {
    name: 'Tamil Nadu',
    aliases: ['Ooty', 'Kodaikanal', 'Chennai', 'Madurai'],
  },
  {
    name: 'West Bengal',
    aliases: ['Darjeeling', 'Kolkata', 'Sundarbans'],
  },
  {
    name: 'Gujarat',
    aliases: ['Dwarka', 'Somnath', 'Kutch', 'Ahmedabad'],
  },
  { name: 'Punjab', aliases: ['Amritsar'] },
  {
    name: 'Odisha',
    aliases: ['Orissa', 'Puri', 'Bhubaneswar', 'Konark'],
  },
  {
    name: 'Assam',
    aliases: ['Guwahati', 'Kaziranga'],
  },
  {
    name: 'Madhya Pradesh',
    aliases: ['Khajuraho', 'Indore', 'Bhopal'],
  },
  { name: 'Dubai', aliases: ['UAE', 'Abu Dhabi'] },
  {
    name: 'Thailand',
    aliases: ['Bangkok', 'Phuket', 'Pattaya', 'Krabi'],
  },
  { name: 'Maldives', aliases: [] },
  { name: 'Singapore', aliases: [] },
  {
    name: 'Bali',
    aliases: ['Indonesia', 'Bali Indonesia'],
  },
];

function normalizeKey(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeTerm(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const FAMILY_BY_KEY = (() => {
  const map = new Map();
  for (const family of DESTINATION_FAMILIES) {
    const entry = {
      name: family.name,
      terms: [family.name, ...(family.aliases || [])],
    };
    map.set(normalizeKey(family.name), entry);
    for (const alias of family.aliases || []) {
      const key = normalizeKey(alias);
      if (key) map.set(key, entry);
    }
  }
  return map;
})();

function resolveFamily(destinationText = '') {
  const raw = String(destinationText || '').trim();
  if (!raw) return null;

  const fullKey = normalizeKey(raw);
  if (fullKey && FAMILY_BY_KEY.has(fullKey)) return FAMILY_BY_KEY.get(fullKey);

  const parts = raw.split(/[,|/→\-–>]+/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const key = normalizeKey(part);
    if (key && FAMILY_BY_KEY.has(key)) return FAMILY_BY_KEY.get(key);
  }

  const keys = [...FAMILY_BY_KEY.keys()].sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (key.length >= 3 && fullKey.includes(key)) return FAMILY_BY_KEY.get(key);
  }

  return null;
}

/**
 * Expand a lead destination (state or any city) into match terms for related packages.
 * Example: "Manali" → Himachal Pradesh + Manali + Shimla + …
 */
export function expandDestinationMatchTerms(destination = '') {
  const raw = String(destination || '').trim();
  const terms = new Set();

  const add = (value) => {
    const normalized = normalizeTerm(String(value || '').replace(/\s+india$/i, ''));
    if (normalized.length >= 3) terms.add(normalized);
  };

  if (raw) {
    raw.split(/[,|/]/).forEach((part) => add(part));
    add(raw);
  }

  const family = resolveFamily(raw);
  if (family) {
    add(family.name);
    family.terms.forEach((term) => add(term));
  }

  return [...terms];
}

/** Preferred UNO/catalog search string — prefer state name for broader related packages. */
export function preferredDestinationSearch(destination = '') {
  const family = resolveFamily(destination);
  if (family?.name) return family.name;
  const raw = String(destination || '').trim();
  if (!raw) return '';
  return raw.split(/[,|/]/)[0]?.trim() || raw;
}
