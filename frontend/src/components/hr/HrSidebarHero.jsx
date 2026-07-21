import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';

function initials(name) {
  return String(name || 'HR Admin')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function HrSidebarHero({ user }) {
  const { collapsed } = useSidebar();

  if (collapsed) return <div className="h-16" aria-hidden="true" />;

  return (
    <div className="px-3 pb-2">
      <div className="h-20" aria-hidden="true" />
      <Link
        to="/hr/profile"
        className="flex items-center gap-3 rounded-xl bg-[#5A222A]/35 p-2.5 backdrop-blur-sm transition hover:bg-[#5A222A]/50"
      >
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-rose-300 text-xs font-bold text-[#712B2C] ring-2 ring-white/35">
            {initials(user?.name)}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#6B2930] bg-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-white">{user?.name || 'HR Admin'}</p>
          <p className="truncate text-[10px] text-orange-100/80">{user?.roleName || 'HR Admin'}</p>
          <p className="mt-0.5 text-[9px] font-medium text-emerald-300">● Online</p>
        </div>
        <ChevronDown className="h-4 w-4 text-orange-100/70" />
      </Link>
    </div>
  );
}
