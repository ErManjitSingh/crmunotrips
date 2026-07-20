/** Header accent themes — matched to panel sidebars */
export const TOPBAR_ACCENTS = {
  brand: {
    wash: 'from-orange-500/[0.06] via-transparent to-violet-500/[0.04]',
    border: 'border-orange-500/15',
    stripe: 'from-orange-500 via-amber-500 to-violet-500',
    searchFocus: 'focus:ring-orange-500/20 focus:border-orange-400/50',
    avatar: 'from-orange-500 to-amber-600',
    addBtn: 'from-orange-600 to-amber-600 shadow-orange-500/25 hover:from-orange-500 hover:to-amber-500',
    iconHover: 'hover:bg-orange-500/10 hover:text-orange-600',
    activeIcon: 'text-orange-600',
  },
  violet: {
    wash: 'from-violet-500/[0.06] via-transparent to-purple-500/[0.04]',
    border: 'border-violet-500/15',
    stripe: 'from-violet-500 via-purple-500 to-fuchsia-500',
    searchFocus: 'focus:ring-violet-500/20 focus:border-violet-400/50',
    avatar: 'from-violet-500 to-purple-600',
    addBtn: 'from-violet-600 to-purple-600 shadow-violet-500/25 hover:from-violet-500 hover:to-purple-500',
    iconHover: 'hover:bg-violet-500/10 hover:text-violet-600',
    activeIcon: 'text-violet-600',
  },
  teal: {
    wash: 'from-teal-500/[0.06] via-transparent to-emerald-500/[0.04]',
    border: 'border-teal-500/15',
    stripe: 'from-teal-500 via-emerald-500 to-cyan-500',
    searchFocus: 'focus:ring-teal-500/20 focus:border-teal-400/50',
    avatar: 'from-teal-500 to-emerald-600',
    addBtn: 'from-teal-600 to-emerald-600 shadow-teal-500/25 hover:from-teal-500 hover:to-emerald-500',
    iconHover: 'hover:bg-teal-500/10 hover:text-teal-600',
    activeIcon: 'text-teal-600',
  },
  sky: {
    wash: 'from-sky-500/[0.06] via-transparent to-blue-500/[0.04]',
    border: 'border-sky-500/15',
    stripe: 'from-sky-500 via-blue-500 to-indigo-500',
    searchFocus: 'focus:ring-sky-500/20 focus:border-sky-400/50',
    avatar: 'from-sky-500 to-blue-600',
    addBtn: 'from-sky-600 to-blue-600 shadow-sky-500/25 hover:from-sky-500 hover:to-blue-500',
    iconHover: 'hover:bg-sky-500/10 hover:text-sky-600',
    activeIcon: 'text-sky-600',
  },
  amber: {
    wash: 'from-amber-500/[0.06] via-transparent to-orange-500/[0.04]',
    border: 'border-amber-500/15',
    stripe: 'from-amber-500 via-orange-500 to-rose-500',
    searchFocus: 'focus:ring-amber-500/20 focus:border-amber-400/50',
    avatar: 'from-amber-500 to-orange-600',
    addBtn: 'from-amber-600 to-orange-600 shadow-amber-500/25 hover:from-amber-500 hover:to-orange-500',
    iconHover: 'hover:bg-amber-500/10 hover:text-amber-600',
    activeIcon: 'text-amber-600',
  },
};

export function getTopBarAccent(pathname) {
  if (pathname.startsWith('/hr')) return TOPBAR_ACCENTS.violet;
  if (pathname.startsWith('/operations-manager')) return TOPBAR_ACCENTS.teal;
  if (pathname.startsWith('/sales-manager')) return TOPBAR_ACCENTS.violet;
  if (pathname.startsWith('/team-leader')) return TOPBAR_ACCENTS.amber;
  if (pathname.startsWith('/sales-executive')) return TOPBAR_ACCENTS.violet;
  return TOPBAR_ACCENTS.brand;
}
