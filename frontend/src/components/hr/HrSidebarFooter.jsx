import { Link } from 'react-router-dom';
import { ArrowRight, Crown, MoreVertical } from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';

function initials(name) {
  return String(name || 'HR Admin')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function HrSidebarFooter({ user }) {
  const { collapsed } = useSidebar();

  return (
    <div className="mt-auto border-t border-white/[0.10] bg-[#3A1720]/20 backdrop-blur-sm">
      {!collapsed && (
        <div className="mx-3 mt-3 rounded-2xl border border-orange-200/20 bg-gradient-to-br from-[#D95545]/75 to-[#A23438]/75 p-3 shadow-lg shadow-[#2A1018]/20 backdrop-blur-md">
          <div className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
              <Crown className="h-4 w-4 text-amber-200" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white">Upgrade to Pro</p>
              <p className="mt-0.5 text-[10px] leading-snug text-orange-50/75">
                More analytics, reports &amp; automations
              </p>
            </div>
          </div>
          <button
            type="button"
            className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-white text-[11px] font-bold text-[#A33B32] shadow-sm transition hover:bg-orange-50"
          >
            Upgrade Now <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      <Link
        to="/hr/profile"
        className={`flex items-center gap-3 p-3 transition hover:bg-white/[0.08] ${collapsed ? 'justify-center' : ''}`}
      >
        <div className="relative shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-rose-300 text-xs font-bold text-[#712B2C] ring-2 ring-white/20">
            {initials(user?.name)}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#5A222A] bg-emerald-400" />
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user?.name || 'HR Admin'}</p>
              <p className="truncate text-[10px] text-orange-100/70">{user?.roleName || 'HR Admin'}</p>
            </div>
            <MoreVertical className="h-4 w-4 text-orange-100/60" />
          </>
        )}
      </Link>
    </div>
  );
}
