import { FileText, ClipboardCheck } from 'lucide-react';

export const WIZARD_STEP_COUNT = 2;

export const WIZARD_STEPS = [
  { id: 1, key: 'form', title: 'Lead Form', subtitle: 'Fill all lead details.', icon: FileText },
  { id: 2, key: 'review', title: 'Review', subtitle: 'Confirm & save.', icon: ClipboardCheck },
];

export const LEAD_SOURCES = [
  { value: 'dpw', label: 'DPW' },
  { value: 'dpw_wa', label: 'DPW WA' },
  { value: 'dpw2', label: 'DPW2' },
  { value: 'dpw2_wa', label: 'DPW2 WA' },
  { value: 'referral', label: 'Referral' },
  { value: 'call_lead', label: 'Call Lead' },
  { value: 'organic', label: 'Organic' },
];

/** Hidden for sales executive when creating / picking a source */
export const SE_HIDDEN_LEAD_SOURCES = new Set(['dpw', 'organic']);

export function getLeadSourcesForRole(role) {
  if (role === 'sales_executive') {
    return LEAD_SOURCES.filter((s) => !SE_HIDDEN_LEAD_SOURCES.has(s.value));
  }
  return LEAD_SOURCES;
}

export function defaultLeadSourceForRole(role) {
  if (role === 'sales_executive') return 'call_lead';
  return 'dpw';
}

export const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-slate-600 bg-slate-500/10 border-slate-500/30' },
  { value: 'medium', label: 'Medium', color: 'text-sky-600 bg-sky-500/10 border-sky-500/30' },
  { value: 'high', label: 'High', color: 'text-amber-600 bg-amber-500/10 border-amber-500/30' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600 bg-red-500/10 border-red-500/30' },
];

/** UI label for lead.priority field */
export const INTENT_LABEL = 'Intent';

export const COLD_LEAD_REASONS = [
  { value: 'not_answering', label: 'Not answering' },
  { value: 'asked_callback_later', label: 'Asked to call later' },
  { value: 'budget_not_ready', label: 'Budget not ready' },
  { value: 'dates_not_final', label: 'Travel dates not final' },
  { value: 'comparing_options', label: 'Comparing other options' },
  { value: 'wrong_time', label: 'Called at wrong time' },
  { value: 'destination_not_final', label: 'Travel destination not final' },
  { value: 'other', label: 'Other' },
];

export const PICKUP_DROP_POINTS = [
  'Delhi Airport (IGI T1)',
  'Delhi Airport (IGI T2)',
  'Delhi Airport (IGI T3)',
  'Mumbai Airport (BOM T1)',
  'Mumbai Airport (BOM T2)',
  'Bengaluru Airport (BLR)',
  'Hyderabad Airport (HYD)',
  'Chennai Airport (MAA)',
  'Kolkata Airport (CCU)',
  'Goa Airport (GOX / GOI)',
  'Jaipur Airport (JAI)',
  'Ahmedabad Airport (AMD)',
  'Chandigarh Airport (IXC)',
  'Lucknow Airport (LKO)',
  'Pune Airport (PNQ)',
  'Kochi Airport (COK)',
  'Trivandrum Airport (TRV)',
  'Srinagar Airport (SXR)',
  'Leh Airport (IXL)',
  'New Delhi Railway Station',
  'Old Delhi Railway Station',
  'Mumbai CST Railway Station',
  'Howrah Railway Station',
  'Chennai Central Railway Station',
  'Hotel Lobby / Stay Location',
  'Home Pickup',
  'Office Pickup',
  'Bus Stand',
  'City Center',
  'Same as pickup',
];

/** Major cities — valid free-text pickup / drop values */
export const PICKUP_DROP_CITIES = [
  'Delhi', 'New Delhi', 'Noida', 'Gurgaon', 'Gurugram', 'Faridabad', 'Ghaziabad',
  'Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Nagpur', 'Nashik',
  'Bengaluru', 'Bangalore', 'Mysuru', 'Mangaluru',
  'Hyderabad', 'Secunderabad', 'Warangal',
  'Chennai', 'Coimbatore', 'Madurai',
  'Kolkata', 'Howrah', 'Siliguri',
  'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot',
  'Jaipur', 'Udaipur', 'Jodhpur', 'Ajmer',
  'Chandigarh', 'Mohali', 'Panchkula',
  'Lucknow', 'Kanpur', 'Varanasi', 'Agra', 'Prayagraj',
  'Indore', 'Bhopal', 'Gwalior',
  'Kochi', 'Thiruvananthapuram', 'Kozhikode',
  'Goa', 'Panaji', 'Margao',
  'Srinagar', 'Jammu', 'Leh',
  'Shimla', 'Manali', 'Dharamshala', 'Kullu', 'Solan',
  'Dehradun', 'Rishikesh', 'Haridwar', 'Mussoorie', 'Nainital',
  'Amritsar', 'Ludhiana', 'Jalandhar',
  'Patna', 'Ranchi', 'Bhubaneswar', 'Guwahati',
  'Visakhapatnam', 'Vijayawada', 'Tirupati',
];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh',
];

/** Combined suggestions for pickup/drop autocomplete (airports + cities + states) */
export const PICKUP_DROP_SUGGESTIONS = Array.from(
  new Set([...PICKUP_DROP_POINTS, ...PICKUP_DROP_CITIES, ...INDIAN_STATES])
);

export function filterPickupDropSuggestions(query, limit = 12) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) {
    return [...PICKUP_DROP_CITIES.slice(0, 8), ...INDIAN_STATES.slice(0, 4)];
  }
  const starts = [];
  const includes = [];
  for (const item of PICKUP_DROP_SUGGESTIONS) {
    const lower = item.toLowerCase();
    if (lower.startsWith(q)) starts.push(item);
    else if (lower.includes(q)) includes.push(item);
  }
  return [...starts, ...includes].slice(0, limit);
}

export const LEAD_TYPES = [
  { value: 'fit', label: 'FIT', description: 'Individual / family' },
  { value: 'group', label: 'Group', description: '10+ travelers' },
  { value: 'corporate', label: 'Corporate', description: 'Business / MICE' },
];

export const DESTINATIONS = [
  'Goa', 'Kerala', 'Dubai', 'Thailand', 'Maldives', 'Manali', 'Shimla', 'Kashmir',
  'Rajasthan', 'Andaman', 'Bali', 'Singapore', 'Europe', 'Sri Lanka', 'Nepal', 'Bhutan',
  'Mauritius', 'Vietnam', 'Turkey', 'Switzerland', 'Paris', 'London', 'New York',
  'Himachal Pradesh', 'Uttarakhand', 'Ladakh', 'Spiti Valley', 'Rishikesh',
];

export const BUDGET_RANGE_OPTIONS = [
  { value: 'under_20000', label: 'Under 20k', amount: 20000 },
  { value: '20000_40000', label: '20–40k', amount: 30000 },
  { value: '40000_60000', label: '40–60k', amount: 50000 },
  { value: '60000_100000', label: '60–100k', amount: 80000 },
  { value: 'above_100000', label: '100k+', amount: 120000 },
  { value: 'custom', label: 'Custom', amount: '' },
];

export const HOTEL_CATEGORY_OPTIONS = [
  { value: '1_star', label: '1 Star' },
  { value: '2_star', label: '2 Star' },
  { value: '3_star', label: '3 Star' },
  { value: '4_star', label: '4 Star' },
  { value: '5_star', label: '5 Star' },
];

export const CAB_TYPE_OPTIONS = [
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'innova', label: 'Innova' },
  { value: 'innova_crysta', label: 'Innova Crysta' },
  { value: 'tempo_traveller', label: 'Tempo Traveller' },
  { value: 'bus', label: 'Bus' },
  { value: 'hatchback', label: 'Hatchback' },
  { value: 'not_required', label: 'Not required' },
];

export const DRAFT_STORAGE_KEY = 'uno-crm-lead-wizard-draft-v10';

export const defaultWizardValues = {
  name: '',
  phone: '',
  whatsapp: '',
  email: '',
  city: '',
  state: '',
  destination: '',
  travelDate: '',
  returnDate: '',
  tourDays: '',
  pickupPoint: '',
  dropPoint: '',
  numberOfRooms: 1,
  roomsWithMattress: 0,
  dateOfBirth: '',
  cabType: 'sedan',
  adults: 2,
  children: 0,
  infants: 0,
  hotelCategory: '3_star',
  requirements: '',
  budgetRange: '',
  customBudget: '',
  budget: '',
  leadSource: 'dpw',
  priority: 'medium',
  branchId: '',
  leadType: 'fit',
  companyName: '',
  alternatePhone: '',
  alternateEmail: '',
};
