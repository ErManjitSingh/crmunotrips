import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { useTheme } from '../../context/ThemeContext';
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { getInitials, getWorkspaceIdentity } from '../../lib/coldCallingWorkspace';
import { cn } from '../../lib/utils';

const iconButton =
  'flex h-10 w-10 items-center justify-center rounded-xl border border-subtle bg-surface/90 text-content-secondary shadow-sm transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60';

/**
 * Header for the Cold Calling workspace. Deliberately not the shared TopBar: that one carries lead
 * search, Add Lead, attendance and app-wide refresh — none of which this role has access to.
 */
export default function ColdCallingTopBar() {
  const { user, logout } = useAuth();
  const { mobileOpen, toggleMobileOpen } = useSidebar();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const identity = getWorkspaceIdentity(user);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-subtle bg-white/95 shadow-sm backdrop-blur-xl dark:bg-slate-900/95">
      <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          onClick={() => toggleMobileOpen()}
          className={cn(iconButton, 'lg:hidden')}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <p className="truncate text-sm font-semibold text-content-primary">Cold Calling</p>
        <div className="flex-1" />

        <button type="button" onClick={toggleTheme} className={iconButton} aria-label="Toggle theme">
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        <DropdownMenuRoot>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-10 items-center gap-2.5 rounded-xl border border-subtle bg-surface/95 pl-1.5 pr-2 shadow-sm transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-[11px] font-bold text-white" aria-hidden="true">
                {getInitials(identity.fullName)}
              </span>
              <span className="hidden max-w-[130px] text-left md:block">
                <span className="block truncate text-xs font-bold leading-tight text-content-primary">{identity.fullName}</span>
                <span className="block truncate text-[10px] leading-tight text-content-muted">{identity.roleLabel}</span>
              </span>
              <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-content-muted md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-1.5">
            <DropdownMenuLabel className="px-2 py-2">
              <p className="truncate font-bold text-content-primary">{identity.fullName}</p>
              <p className="mt-0.5 truncate text-xs font-normal text-content-muted">{user?.email}</p>
              <span className="mt-2 inline-block rounded-md bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-400">
                {identity.roleLabel}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer rounded-lg text-red-600 focus:bg-red-500/10 focus:text-red-600"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuRoot>
      </div>
    </header>
  );
}
