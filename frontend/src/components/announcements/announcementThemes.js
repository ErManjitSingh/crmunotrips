/** Theme tokens by announcement type — used across hero/carousel/popup */
export const ANNOUNCEMENT_THEMES = {
  offer: {
    gradient: 'from-violet-600 via-fuchsia-500 to-pink-500',
    soft: 'from-violet-50 via-fuchsia-50 to-pink-50 dark:from-violet-950/50 dark:via-fuchsia-950/40 dark:to-pink-950/40',
    border: 'border-fuchsia-400/40',
    glow: 'shadow-fuchsia-500/25',
    badge: 'bg-white/20 text-white',
    accent: 'text-fuchsia-600',
  },
  promotion: {
    gradient: 'from-violet-600 via-purple-500 to-pink-500',
    soft: 'from-violet-50 via-purple-50 to-pink-50 dark:from-violet-950/50 dark:via-purple-950/40 dark:to-pink-950/40',
    border: 'border-purple-400/40',
    glow: 'shadow-purple-500/25',
    badge: 'bg-white/20 text-white',
    accent: 'text-purple-600',
  },
  contest: {
    gradient: 'from-orange-500 via-rose-500 to-red-500',
    soft: 'from-orange-50 via-rose-50 to-red-50 dark:from-orange-950/40 dark:via-rose-950/40 dark:to-red-950/40',
    border: 'border-orange-400/40',
    glow: 'shadow-orange-500/25',
    badge: 'bg-white/20 text-white',
    accent: 'text-orange-600',
  },
  festival: {
    gradient: 'from-amber-400 via-orange-400 to-yellow-400',
    soft: 'from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-yellow-950/30',
    border: 'border-amber-400/40',
    glow: 'shadow-amber-500/25',
    badge: 'bg-black/10 text-amber-950',
    accent: 'text-amber-700',
  },
  holiday: {
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    soft: 'from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950/40 dark:via-green-950/40 dark:to-teal-950/40',
    border: 'border-emerald-400/40',
    glow: 'shadow-emerald-500/25',
    badge: 'bg-white/20 text-white',
    accent: 'text-emerald-600',
  },
  target: {
    gradient: 'from-blue-600 via-sky-500 to-cyan-400',
    soft: 'from-blue-50 via-sky-50 to-cyan-50 dark:from-blue-950/40 dark:via-sky-950/40 dark:to-cyan-950/40',
    border: 'border-sky-400/40',
    glow: 'shadow-sky-500/25',
    badge: 'bg-white/20 text-white',
    accent: 'text-sky-600',
  },
  incentive: {
    gradient: 'from-violet-600 via-indigo-500 to-blue-500',
    soft: 'from-violet-50 via-indigo-50 to-blue-50 dark:from-violet-950/40 dark:via-indigo-950/40 dark:to-blue-950/40',
    border: 'border-indigo-400/40',
    glow: 'shadow-indigo-500/25',
    badge: 'bg-white/20 text-white',
    accent: 'text-indigo-600',
  },
  emergency: {
    gradient: 'from-red-600 via-rose-600 to-red-500',
    soft: 'from-red-50 via-rose-50 to-red-50 dark:from-red-950/50 dark:via-rose-950/40 dark:to-red-950/40',
    border: 'border-red-400/40',
    glow: 'shadow-red-500/30',
    badge: 'bg-white/20 text-white',
    accent: 'text-red-600',
  },
  update: {
    gradient: 'from-indigo-600 via-violet-500 to-indigo-400',
    soft: 'from-indigo-50 via-violet-50 to-indigo-50 dark:from-indigo-950/40 dark:via-violet-950/40 dark:to-indigo-950/40',
    border: 'border-indigo-400/40',
    glow: 'shadow-indigo-500/25',
    badge: 'bg-white/20 text-white',
    accent: 'text-indigo-600',
  },
  policy: {
    gradient: 'from-slate-700 via-slate-600 to-indigo-600',
    soft: 'from-slate-50 via-slate-100 to-indigo-50 dark:from-slate-900/60 dark:via-slate-800/40 dark:to-indigo-950/40',
    border: 'border-slate-400/40',
    glow: 'shadow-slate-500/20',
    badge: 'bg-white/15 text-white',
    accent: 'text-slate-700 dark:text-slate-200',
  },
  maintenance: {
    gradient: 'from-slate-500 via-gray-500 to-zinc-500',
    soft: 'from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-900/50 dark:via-gray-900/40 dark:to-zinc-900/40',
    border: 'border-slate-400/40',
    glow: 'shadow-slate-500/20',
    badge: 'bg-white/15 text-white',
    accent: 'text-slate-600',
  },
};

export function getAnnouncementTheme(type) {
  return ANNOUNCEMENT_THEMES[type] || ANNOUNCEMENT_THEMES.update;
}

export function getRemainingTime(expiresAt) {
  if (!expiresAt) return null;
  const end = new Date(expiresAt).getTime();
  const diff = end - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, ended: true };
  const days = Math.floor(diff / (24 * 3600 * 1000));
  const hours = Math.floor((diff % (24 * 3600 * 1000)) / (3600 * 1000));
  return { days, hours, ended: false };
}

export const ANNOUNCEMENT_TYPE_OPTIONS = [
  { value: 'offer', label: 'Offer' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'contest', label: 'Contest' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'target', label: 'Target' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'policy', label: 'Policy' },
  { value: 'festival', label: 'Festival' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'update', label: 'Update' },
  { value: 'incentive', label: 'Incentive' },
];

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const ROLE_OPTIONS = [
  { value: 'sales_executive', label: 'Sales Executive' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'team_leader', label: 'Team Leader' },
  { value: 'operations_manager', label: 'Operations' },
  { value: 'accountant', label: 'Accounts' },
  { value: 'admin', label: 'Admin' },
];
