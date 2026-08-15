export const LEAD_STATUSES = [
  { value: 'new', label: 'New', meaning: 'Lead just received' },
  { value: 'contacted', label: 'Contacted', meaning: 'Executive has spoken / message exchanged' },
  { value: 'working_progress', label: 'Working', meaning: 'Customer interested; requirements not confirmed' },
  { value: 'qualified', label: 'Qualified', meaning: 'Genuine buyer + requirements confirmed' },
  { value: 'quotation_sent', label: 'Quotation', meaning: 'Price / package sent' },
  { value: 'follow_up', label: 'Follow-up', meaning: 'Waiting for customer decision' },
  { value: 'converted', label: 'Booking', meaning: 'Customer has confirmed / paid' },
  { value: 'lost', label: 'Lost', meaning: 'Not converting / rejected' },
  { value: 'negotiation', label: 'Negotiation', meaning: 'Price discussion in progress' },
  { value: 'reactivated', label: 'Reactivated', meaning: 'Previously lost lead revived' },
  { value: 'booked_from_another_company', label: 'Booked Elsewhere', meaning: 'Lost to another company' },
];

/** Stored source keys — display uses short labels via getLeadSourceShortLabel */
export const LEAD_SOURCES = [
  'dpw',
  'dpw_wa',
  'dpw_call',
  'dpw2',
  'dpw2_wa',
  'dpw2_call',
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
  'Goa', 'Kerala', 'Dubai', 'Thailand', 'Maldives', 'Manali', 'Shimla', 'Kashmir',
  'Rajasthan', 'Andaman', 'Bali', 'Singapore', 'Europe', 'Sri Lanka', 'Nepal', 'Bhutan',
  'Mauritius', 'Vietnam', 'Turkey', 'Switzerland', 'Paris', 'London', 'New York',
  'Himachal Pradesh', 'Uttarakhand', 'Ladakh', 'Spiti Valley', 'Rishikesh',
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Gujarat',
  'Haryana', 'Jharkhand', 'Karnataka', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'West Bengal', 'Delhi', 'Jammu & Kashmir',
];

export { INDIAN_STATES } from '../lead-wizard/constants';

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
  '/leads/converted': { title: 'Bookings', subtitle: 'Confirmed / paid customers', status: 'converted', assignee: '' },
  '/leads/arrivals': {
    title: 'Arrivals',
    subtitle: 'Converted leads by travel / arrival date',
    status: 'converted',
    assignee: '',
    listFilter: 'arrivals',
  },
  '/leads/lost': { title: 'Lost Leads', subtitle: 'Did not convert', status: 'lost', assignee: '' },
  '/leads/duplicates': {
    title: 'Repeated Leads',
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
  { value: 'under_50000', label: 'Under ₹50k', min: '0', max: '50000' },
  { value: '50000_100000', label: '₹50k – ₹1L', min: '50000', max: '100000' },
  { value: '100000_200000', label: '₹1L – ₹2L', min: '100000', max: '200000' },
  { value: '200000_300000', label: '₹2L – ₹3L', min: '200000', max: '300000' },
  { value: 'above_300000', label: '₹3L & Above', min: '300000', max: '' },
];

export const emptyFilters = {
  search: '',
  destination: '',
  source: '',
  agent: '',
  status: '',
  filter: '',
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
