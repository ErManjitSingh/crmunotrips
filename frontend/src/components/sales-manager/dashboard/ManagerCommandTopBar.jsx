import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Bell, Menu, X, LogOut, User, Search, Command, ChevronDown } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';
import { NOTIFICATIONS_ENABLED } from '../../../config/notifications';
import { useSidebar } from '../../../context/SidebarContext';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../../ui/dropdown-menu';
import { cn } from '../../../lib/utils';

function getInitials(name) {
  return (
    name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  );
}

/** Mockup-matching header for Sales Manager Command Center only. */
export default function ManagerCommandTopBar() {
  const { mobileOpen, toggleMobileOpen } = useSidebar();
  const { user, logout } = useAuth();
  const { unreadCount, openDrawer } = useNotifications();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/sales-manager/leads/all?search=${encodeURIComponent(q)}`);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="flex items-center gap-4 px-4 lg:px-8 h-[76px]">
        <button
          type="button"
          onClick={() => toggleMobileOpen()}
          className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="min-w-0 shrink-0 max-w-[280px] xl:max-w-[340px]">
          <h1 className="text-lg xl:text-xl font-bold text-slate-900 tracking-tight truncate">
            Sales Manager Command Center
          </h1>
          <p className="text-xs text-slate-500 truncate mt-0.5 hidden sm:block">
            Team pipeline, approvals, and performance at a glance.
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 justify-center px-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads, customers, emails..."
              className="w-full h-11 pl-10 pr-16 rounded-full bg-slate-100 border border-slate-200/80 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-300"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-semibold text-slate-400 pointer-events-none">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          </div>
        </form>

        <div className="flex-1 md:hidden" />

        <div className="flex items-center gap-2.5 shrink-0 ml-auto">
          {NOTIFICATIONS_ENABLED && (
            <button
              type="button"
              onClick={openDrawer}
              className="relative flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {user ? (
            <DropdownMenuRoot>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-2.5 pl-1.5 pr-2.5 h-11 rounded-full',
                    'border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-colors'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white">
                    {getInitials(user.name)}
                  </div>
                  <div className="hidden lg:block text-left min-w-0 max-w-[120px]">
                    <p className="text-xs font-bold text-slate-800 truncate leading-tight">{user.name}</p>
                    <p className="text-[10px] text-slate-500 truncate leading-tight">Sales Manager</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5">
                <DropdownMenuLabel className="px-2 py-2">
                  <p className="font-bold text-content-primary truncate">{user.name}</p>
                  <p className="text-xs font-normal text-content-muted truncate mt-0.5">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/sales-manager/profile" className="cursor-pointer rounded-lg">
                    <User className="w-4 h-4" />
                    My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-red-600 focus:text-red-600 focus:bg-red-500/10 rounded-lg cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuRoot>
          ) : null}
        </div>
      </div>
    </header>
  );
}
