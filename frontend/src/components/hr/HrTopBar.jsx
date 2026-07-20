import { useNavigate } from 'react-router-dom';
import { Bell, CalendarDays, Moon, Sun, Search, Command, ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSidebar } from '../../context/SidebarContext';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';

function getInitials(name) {
  return name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'HA';
}

function formatToday() {
  return new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function HrTopBar() {
  const { user, logout } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const { toggleMobileOpen } = useSidebar();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/hr/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="flex h-[68px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={toggleMobileOpen}
          className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
          aria-label="Open menu"
        >
          <span className="sr-only">Menu</span>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        <div className="hidden md:flex flex-1 max-w-xl items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 h-11">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="search"
            placeholder="Search employees, departments, attendance..."
            className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
          />
          <span className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
            <Command className="h-3 w-3" /> K
          </span>
        </div>

        <div className="flex flex-1 md:flex-none items-center justify-end gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 h-10 text-sm font-medium text-slate-600">
            <CalendarDays className="h-4 w-4 text-[#5D5FEF]" />
            {formatToday()}
          </div>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-[#5D5FEF] hover:border-violet-200 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              12
            </span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-[#5D5FEF] transition-colors"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>

          <DropdownMenuRoot>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-sm outline-none transition hover:border-violet-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#5D5FEF] to-indigo-600 text-xs font-bold text-white shadow-md shadow-violet-500/25">
                {getInitials(user?.name)}
              </div>
              <div className="hidden sm:block min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{user?.name || 'HR Admin'}</p>
                <p className="truncate text-[11px] text-slate-400">{user?.roleName || 'HR Admin'}</p>
              </div>
              <ChevronDown className="hidden sm:block h-4 w-4 text-slate-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <p className="font-semibold text-slate-800">{user?.name || 'HR Admin'}</p>
                <p className="mt-0.5 text-[11px] font-normal text-slate-500">{user?.email || ''}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/hr/profile')} className="gap-2">
                <User className="h-4 w-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout} className="gap-2 text-rose-600">
                <LogOut className="h-4 w-4" /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuRoot>
        </div>
      </div>
    </header>
  );
}
