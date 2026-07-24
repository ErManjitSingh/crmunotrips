/** UNO Trips Sales SOP — Phase 1 constants */

const LEAD_ACCEPT_MINUTES = 2;

const FIRST_CONTACT_SLA = {
  hotMinutes: 5,
  warmMinutes: 10,
  coldMinutes: 15,
  nightCallByHour: 9,
  nightCallByMinute: 15,
  /** Local (IST) hour after which a lead is treated as "night" */
  nightStartsAtHour: 20,
  /** Local (IST) hour before which a lead is still "night / early morning" */
  morningOpensAtHour: 9,
  timeZone: 'Asia/Kolkata',
};

const LOST_REASONS = [
  { value: 'too_expensive', label: 'Too Expensive' },
  { value: 'not_travelling', label: 'Not Travelling' },
  { value: 'booked_elsewhere', label: 'Booked Elsewhere' },
  { value: 'no_response', label: 'No Response' },
  { value: 'date_changed', label: 'Date Changed' },
  { value: 'budget_issue', label: 'Budget Issue' },
  { value: 'destination_changed', label: 'Destination Changed' },
  { value: 'duplicate_lead', label: 'Duplicate Lead' },
];

const LOST_REASON_VALUES = LOST_REASONS.map((r) => r.value);

/** Fields required before any quotation (SOP §3) */
const QUOTE_QUALIFICATION_FIELDS = [
  { key: 'destination', label: 'Destination' },
  { key: 'travelDate', label: 'Travel Dates' },
  { key: 'adults', label: 'Number of Adults', min: 1 },
  { key: 'children', label: 'Number of Children', allowZero: true },
  { key: 'hotelCategory', label: 'Hotel Category' },
  { key: 'budget', label: 'Budget', min: 1 },
  { key: 'transportRequirement', label: 'Transportation', altKeys: ['cabType'] },
  { key: 'pickupPoint', label: 'Pickup City' },
  { key: 'specialRequirements', label: 'Special Requirements' },
];

module.exports = {
  LEAD_ACCEPT_MINUTES,
  FIRST_CONTACT_SLA,
  LOST_REASONS,
  LOST_REASON_VALUES,
  QUOTE_QUALIFICATION_FIELDS,
};
