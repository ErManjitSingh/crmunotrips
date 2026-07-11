function normalizeLocation(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferCityFromDestination(destination = '') {
  const text = String(destination || '').trim();
  if (!text) return '';

  const firstPart = text.split(',')[0]?.trim() || text;
  return (
    firstPart
      .replace(
        /\s+(India|Himachal Pradesh|Uttarakhand|Rajasthan|Kerala|Goa|Punjab|Delhi)$/i,
        ''
      )
      .trim() || firstPart
  );
}

function inferStateFromDestination(destination = '') {
  const text = String(destination || '').trim();
  if (!text) return '';

  const knownStates = [
    'Himachal Pradesh',
    'Uttarakhand',
    'Rajasthan',
    'Kerala',
    'Goa',
    'Punjab',
    'Jammu and Kashmir',
    'Ladakh',
    'Sikkim',
    'West Bengal',
    'Maharashtra',
    'Karnataka',
    'Tamil Nadu',
  ];

  for (const state of knownStates) {
    if (new RegExp(state.replace(/\s+/g, '\\s+'), 'i').test(text)) return state;
  }

  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1].replace(/\s+india$/i, '').trim();

  return '';
}

function parseRouteCities(routing = '') {
  return String(routing || '')
    .split(/[→\-–>|,/]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractLocationTerms(destination = '') {
  const text = String(destination || '').trim();
  if (!text) return [];

  const terms = new Set();
  const add = (value) => {
    const normalized = normalizeLocation(value);
    if (normalized.length >= 3) terms.add(normalized);
  };

  text.split(/[,|/]/).forEach((part) => add(part.replace(/\s+india$/i, '')));
  add(inferCityFromDestination(text));

  return [...terms];
}

function buildLocationHaystack(target = {}) {
  return normalizeLocation(
    [
      target.city,
      target.state,
      target.country,
      target.destination,
      target.destination_name,
      target.destination_city,
      target.name,
      target.location,
      target.address,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function matchesDestination(target = {}, destination = '') {
  const terms = extractLocationTerms(destination);
  if (!terms.length) return true;

  const haystack = buildLocationHaystack(target);
  if (!haystack) return false;

  return terms.some((term) => {
    if (haystack.includes(term)) return true;
    const cityToken = term.split(' ')[0];
    return cityToken.length >= 3 && haystack.includes(cityToken);
  });
}

module.exports = {
  normalizeLocation,
  inferCityFromDestination,
  inferStateFromDestination,
  parseRouteCities,
  extractLocationTerms,
  matchesDestination,
  buildLocationHaystack,
};
