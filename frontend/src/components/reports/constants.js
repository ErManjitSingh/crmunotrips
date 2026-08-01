export const REPORT_KPI_CONFIG = [
  { key: 'totalLeads', label: 'Total Leads', suffix: '', color: 'sky' },
  { key: 'totalConversions', label: 'Total Conversions', suffix: '', color: 'emerald' },
  { key: 'conversionRate', label: 'Conversion Rate', suffix: '%', color: 'violet' },
  { key: 'totalRevenue', label: 'Total Revenue', suffix: '', format: 'currency', color: 'amber' },
  { key: 'avgBookingValue', label: 'Avg Booking Value', suffix: '', format: 'currency', color: 'indigo' },
  { key: 'profitMargin', label: 'Profit Margin', suffix: '%', color: 'rose' },
];

export const KPI_THEMES = {
  sky: { gradient: 'from-sky-500/20 via-blue-500/10 to-indigo-500/5', border: 'border-sky-400/40', icon: 'bg-gradient-to-br from-sky-500 to-blue-600', text: 'text-sky-700 dark:text-sky-300' },
  emerald: { gradient: 'from-emerald-500/20 via-green-500/10 to-teal-500/5', border: 'border-emerald-400/40', icon: 'bg-gradient-to-br from-emerald-500 to-teal-600', text: 'text-emerald-700 dark:text-emerald-300' },
  violet: { gradient: 'from-violet-500/20 via-purple-500/10 to-fuchsia-500/5', border: 'border-violet-400/40', icon: 'bg-gradient-to-br from-violet-500 to-purple-600', text: 'text-violet-700 dark:text-violet-300' },
  amber: { gradient: 'from-amber-500/20 via-orange-500/10 to-yellow-500/5', border: 'border-amber-400/40', icon: 'bg-gradient-to-br from-amber-500 to-orange-500', text: 'text-amber-700 dark:text-amber-300' },
  indigo: { gradient: 'from-indigo-500/20 via-blue-500/10 to-violet-500/5', border: 'border-indigo-400/40', icon: 'bg-gradient-to-br from-indigo-500 to-violet-600', text: 'text-indigo-700 dark:text-indigo-300' },
  rose: { gradient: 'from-rose-500/20 via-pink-500/10 to-red-500/5', border: 'border-rose-400/40', icon: 'bg-gradient-to-br from-rose-500 to-pink-600', text: 'text-rose-700 dark:text-rose-300' },
};

export const REVENUE_PERIODS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
];

export const FILTER_DEFAULTS = {
  dateFrom: '',
  dateTo: '',
  destination: '',
  source: '',
  executive: '',
  package: '',
};

export const SOURCE_OPTIONS = ['DPW', 'DPW WA', 'DPW2', 'DPW2 WA', 'Referral', 'Call Lead', 'Organic'];
export const DESTINATION_OPTIONS = ['Shimla', 'Manali', 'Kashmir', 'Goa', 'Kerala', 'Leh Ladakh'];
export const EXECUTIVE_OPTIONS = ['Priya Patel', 'Amit Kumar', 'Vikram Singh', 'Sneha Reddy'];
