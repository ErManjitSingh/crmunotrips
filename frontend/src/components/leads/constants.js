export const LEAD_STATUSES = [
  { value: 'new', label: 'New Lead' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'working_progress', label: 'Working Progress' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'quotation_sent', label: 'Quotation Sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'reactivated', label: 'Reactivated' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
  { value: 'booked_from_another_company', label: 'Booked From Another Company' },
];

/** Stored source keys — display uses short labels via getLeadSourceShortLabel */
export const LEAD_SOURCES = [
  'dpw',
  'dpw_wa',
  'dpw2',
  'dpw2_wa',
  'referral',
  'call_lead',
  'organic',
];

export const AGENTS = [
  { id: 'agent-1', name: 'Priya Patel' },
  { id: 'agent-2', name: 'Amit Kumar' },
  { id: 'agent-3', name: 'Vikram Singh' },
];

export const DESTINATIONS = [
  'Goa', 'Kerala', 'Dubai', 'Thailand', 'Manali', 'Maldives', 'Singapore', 'Europe',
];

export const TRAVEL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const pageConfig = {
  '/leads': { title: 'Lead Management', subtitle: 'All travel inquiries', status: '', assignee: '' },
  '/leads/inbox/new': {
    title: 'New Leads',
    subtitle: 'Fresh inquiries awaiting first contact',
    status: 'new',
    assignee: '',
  },
  '/leads/new-leads': { title: "Today's Leads", subtitle: 'Inquiries received today', status: '', assignee: '', todayOnly: true },
  '/leads/returned': {
    title: 'Unassigned Leads',
    subtitle: 'Leads waiting to be reassigned',
    status: '',
    assignee: '',
    listFilter: 'returned',
  },
  '/leads/hot': {
    title: 'Hot Leads',
    subtitle: 'High-priority leads requiring immediate attention',
    status: '',
    assignee: '',
    listFilter: 'hot',
  },
  '/leads/unassigned': {
    title: 'Unassigned Leads',
    subtitle: 'Not yet assigned to any executive',
    status: '',
    assignee: 'unassigned',
  },
  '/leads/assigned': { title: 'Assigned Leads', subtitle: 'Leads assigned to team members', status: '', assignee: 'assigned' },
  '/leads/converted': { title: 'Converted Leads', subtitle: 'Successfully closed deals', status: 'converted', assignee: '' },
  '/leads/lost': { title: 'Lost Leads', subtitle: 'Did not convert', status: 'lost', assignee: '' },
  '/leads/duplicates': {
    title: 'Duplicate Leads',
    subtitle: 'Leads sharing the same phone number',
    status: '',
    assignee: '',
    listFilter: 'duplicates',
  },
};

export function formatLeadId(id) {
  return `LD-${String(id).replace(/\D/g, '').slice(-4).padStart(4, '0')}`;
}

export const BUDGET_FILTER_OPTIONS = [
  { value: '', label: 'All Budgets', min: '', max: '' },
  { value: 'under_20000', label: 'Under ₹20k', min: '0', max: '20000' },
  { value: '20000_40000', label: '₹20k – ₹40k', min: '20000', max: '40000' },
  { value: '40000_60000', label: '₹40k – ₹60k', min: '40000', max: '60000' },
  { value: '60000_100000', label: '₹60k – ₹1L', min: '60000', max: '100000' },
  { value: 'above_100000', label: 'Above ₹1L', min: '100000', max: '' },
];

export const emptyFilters = {
  search: '',
  destination: '',
  source: '',
  agent: '',
  status: '',
  travelMonth: '',
  budgetMin: '',
  budgetMax: '',
  budgetRange: '',
  dateFrom: '',
  dateTo: '',
  priority: '',
  teamId: '',
  branchId: '',
  state: '',
};

export const PRIORITY_FILTER_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'hot', label: 'Hot' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
