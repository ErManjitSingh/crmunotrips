import { FileText, ClipboardCheck } from 'lucide-react';

export const WIZARD_STEP_COUNT = 2;

export const WIZARD_STEPS = [
  { id: 1, key: 'form', title: 'Lead Form', subtitle: 'All details', icon: FileText },
  { id: 2, key: 'review', title: 'Review', subtitle: 'Confirm & save', icon: ClipboardCheck },
];

export const LEAD_SOURCES = [
  { value: 'google_ads', label: 'Website (Google Ads)' },
  { value: 'facebook_ads', label: 'FB Lead' },
  { value: 'website', label: 'Website' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'referral', label: 'Referral' },
  { value: 'organic', label: 'Organic' },
  { value: 'phone', label: 'Phone' },
  { value: 'social', label: 'Social' },
];

export const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'text-slate-600 bg-slate-500/10 border-slate-500/30' },
  { value: 'medium', label: 'Medium', color: 'text-sky-600 bg-sky-500/10 border-sky-500/30' },
  { value: 'high', label: 'High', color: 'text-amber-600 bg-amber-500/10 border-amber-500/30' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-600 bg-red-500/10 border-red-500/30' },
];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu & Kashmir', 'Ladakh',
];

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

export const DRAFT_STORAGE_KEY = 'uno-crm-lead-wizard-draft-v9';

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
  cabType: 'sedan',
  adults: 2,
  children: 0,
  infants: 0,
  hotelCategory: '3_star',
  requirements: '',
  budgetRange: '',
  customBudget: '',
  budget: '',
  leadSource: 'website',
  priority: 'medium',
  branchId: '',
  leadType: 'fit',
  companyName: '',
};
