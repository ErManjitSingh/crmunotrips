/** Fields returned by paginated lead lists — excludes notes, timeline, heavy nested history */
const LEAD_LIST_SELECT = [
  'leadId',
  'name',
  'phone',
  'email',
  'whatsapp',
  'alternatePhone',
  'destination',
  'budget',
  'mealPlan',
  'status',
  'statusReason',
  'source',
  'sourceLabel',
  'leadSource',
  'travelDate',
  'returnDate',
  'tourDays',
  'travelers',
  'adults',
  'children',
  'infants',
  'assignedTo',
  'assignedAt',
  'assigneeRole',
  'assignedTeamLeader',
  'createdBy',
  'branchId',
  'createdAt',
  'updatedAt',
  'convertedAt',
  'priority',
  'isHot',
  'isRepeatCustomer',
  'temperature',
  'coldReason',
  'leadScore',
  'agingBucket',
  'callStats.count',
  'callStats.totalDurationSeconds',
  'callStats.lastCallAt',
  'callStats.recent',
  'assignmentAcceptance',
  'assignmentAcceptBy',
  'acceptedAt',
  'acceptanceMissedBy',
  'acceptanceMissedName',
  'acceptanceMissedAt',
  'firstContactDeadline',
  'slaBreached',
  'nextFollowUp',
  'lastFollowUp',
  'reactivation.isReactivated',
  'reactivation.stage',
  'reactivation.reactivatedAt',
].join(' ');

/** Detail view — excludes notes string and reactivation stageHistory */
const LEAD_DETAIL_SELECT = `${LEAD_LIST_SELECT} city state travelDate returnDate tourDays pickupPoint dropPoint numberOfRooms roomsWithMattress cabType budgetRange leadType companyName hotelCategory mealPlan mealPreference transportRequirement specialRequirements statusReason priority channel assigneeRole assignedManager teamId lastContactedAt lastContactMethod executiveLastViewedAt smartScore referral occupationCategory occupation subCity foodPreference`;

/**
 * "Opened" timeline info — management-only (see MANAGEMENT_VIEWER_ROLES). Kept out of
 * LEAD_LIST_SELECT/LEAD_DETAIL_SELECT so it's excluded by default everywhere; callers opt in
 * with withManagementFields()/withManagementPopulate() only after checking canViewLeadOpenInfo().
 */
const LEAD_MANAGEMENT_ONLY_SELECT = 'firstOpenedAt firstOpenedBy';
const LEAD_MANAGEMENT_ONLY_POPULATE = [{ path: 'firstOpenedBy', select: 'name email' }];
const MANAGEMENT_VIEWER_ROLES = ['admin', 'sales_manager'];

function canViewLeadOpenInfo(role) {
  return MANAGEMENT_VIEWER_ROLES.includes(role);
}

function withManagementFields(baseSelect, includeManagementFields) {
  return includeManagementFields ? `${baseSelect} ${LEAD_MANAGEMENT_ONLY_SELECT}` : baseSelect;
}

function withManagementPopulate(basePopulate, includeManagementFields) {
  return includeManagementFields ? [...basePopulate, ...LEAD_MANAGEMENT_ONLY_POPULATE] : basePopulate;
}

/**
 * Admin cannot see a lead's phone/alternatePhone/whatsapp until the assigned Sales Executive has
 * logged an actual first call for it — see utils/leadPhoneVisibility (the same call-gated check
 * used for the Sales Executive's own views). Deliberately NOT gated on `firstOpenedAt` ("lead
 * opened") any more — opening a lead or clicking Call is not proof a call happened; only a
 * recorded CallNote is. Only applies to role 'admin'; every other role's phone visibility is
 * handled at its own call site (sales_manager/team_leader are unchanged/out of scope for now —
 * see PR notes). Async because it queries CallNote; every call site must await it.
 */
async function applyAdminPhoneVisibility(leadOrList, role) {
  if (role !== 'admin') return leadOrList;
  const { applyPhoneVisibilityGate } = require('./leadPhoneVisibility');
  return applyPhoneVisibilityGate(leadOrList);
}

const LEAD_DETAIL_POPULATE = [
  { path: 'assignedTo', select: 'name email' },
  { path: 'assignedManager', select: 'name email' },
  { path: 'assignedTeamLeader', select: 'name email' },
  { path: 'createdBy', select: 'name email role' },
  { path: 'lastContactedBy', select: 'name email' },
  { path: 'teamId', select: 'name' },
  { path: 'reactivation.reactivatedBy', select: 'name email' },
  { path: 'reactivation.reassignedBy', select: 'name email' },
  { path: 'reactivation.reassignedTo', select: 'name email' },
];

const FOLLOWUP_ON_LEAD_POPULATE = [
  { path: 'assignedTo', select: 'name email' },
  { path: 'createdBy', select: 'name email' },
];

const QUOTATION_ON_LEAD_POPULATE = [
  { path: 'package', select: 'name destination duration' },
  { path: 'createdBy', select: 'name email' },
  { path: 'createdByExecutive', select: 'name email' },
  { path: 'approvedBy', select: 'name email' },
];

module.exports = {
  LEAD_LIST_SELECT,
  LEAD_DETAIL_SELECT,
  LEAD_DETAIL_POPULATE,
  FOLLOWUP_ON_LEAD_POPULATE,
  QUOTATION_ON_LEAD_POPULATE,
  MANAGEMENT_VIEWER_ROLES,
  canViewLeadOpenInfo,
  withManagementFields,
  withManagementPopulate,
  applyAdminPhoneVisibility,
};
