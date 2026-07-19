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
  'status',
  'source',
  'sourceLabel',
  'leadSource',
  'travelDate',
  'travelers',
  'adults',
  'children',
  'assignedTo',
  'assignedAt',
  'executiveLastViewedAt',
  'assignedTeamLeader',
  'createdBy',
  'branchId',
  'createdAt',
  'updatedAt',
  'priority',
  'isHot',
  'isRepeatCustomer',
  'temperature',
  'leadScore',
  'agingBucket',
  'smartScore',
  'nextFollowUp',
  'lastFollowUp',
  'reactivation.isReactivated',
  'reactivation.stage',
  'reactivation.reactivatedAt',
].join(' ');

/** Detail view — excludes notes string and reactivation stageHistory */
const LEAD_DETAIL_SELECT = `${LEAD_LIST_SELECT} city state travelDate returnDate tourDays pickupPoint dropPoint numberOfRooms cabType budgetRange leadType companyName hotelCategory mealPreference transportRequirement specialRequirements statusReason priority channel assigneeRole assignedManager teamId lastContactedAt lastContactMethod slaBreached`;

const LEAD_DETAIL_POPULATE = [
  { path: 'assignedTo', select: 'name email' },
  { path: 'assignedManager', select: 'name email' },
  { path: 'assignedTeamLeader', select: 'name email' },
  { path: 'createdBy', select: 'name email' },
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
};
