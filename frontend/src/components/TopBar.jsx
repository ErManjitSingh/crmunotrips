import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Bell, Sun, Moon, Menu, X, LogOut, User, LogIn, ChevronDown, RefreshCw, Search, Command } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { NOTIFICATIONS_ENABLED } from '../config/notifications';
import { getTopBarAccent } from './topbarAccent';
import { DropdownMenuRoot, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from './ui/dropdown-menu';
import { cn } from '../lib/utils';
import AttendanceTopBarAction from './attendance/AttendanceTopBarAction';
import API from '../api/axios';
import {
  hydrateSelectedBranch,
  setAvailableBranches,
  setSelectedBranch,
} from '../store/slices/branchSlice';
import { refreshAppData } from '../lib/appRefresh';
import { useSidebar } from '../context/SidebarContext';

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

function getProfilePath(pathname) {
  if (pathname.startsWith('/operations-manager')) return '/operations-manager/profile';
  if (pathname.startsWith('/sales-manager')) return '/sales-manager/profile';
  if (pathname.startsWith('/team-leader')) return '/team-leader/profile';
  if (pathname.startsWith('/sales-executive')) return '/sales-executive/profile';
  return '/profile';
}

function formatBranchLabel(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const normalized = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (
    normalized.includes('bhatakhur') ||
    normalized.includes('bhatakufar') ||
    normalized.includes('bhattakufer') ||
    normalized.includes('bhattakufar') ||
    normalized.includes('bhata')
  ) {
    return 'PTW';
  }
  if (normalized.includes('shimla')) return 'UNO Trips';
  return raw;
}

function IconButton({ children, className, accent, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        'relative flex items-center justify-center w-10 h-10 rounded-xl',
        'border border-subtle bg-surface/90 shadow-sm',
        'text-content-secondary transition-all duration-200',
        accent.iconHover,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export default function TopBar({ onMenuClick }) {
  const { mobileOpen, toggleMobileOpen } = useSidebar();
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const { toggleTheme, isDark } = useTheme();
  const { user, logout, hasPermission } = useAuth();
  const { unreadCount, openDrawer } = useNotifications();
  const { selectedBranchId, availableBranches } = useSelector((s) => s.branch);
  const navigate = useNavigate();
  const location = useLocation();
  const accent = getTopBarAccent(location.pathname);
  const profilePath = getProfilePath(location.pathname);
  const isAdmin = user?.role === 'admin';
  const canAddLead = isAdmin || hasPermission?.('leads', 'create');
  const selectedBranch = availableBranches.find((b) => b._id === selectedBranchId);
  const selectedBranchLabel = formatBranchLabel(selectedBranch?.name);
  const adminRoleLine = isAdmin
    ? `${user?.roleName || 'Admin'}${selectedBranchLabel ? ` - ${selectedBranchLabel}` : ''}`
    : (user?.roleName || user?.role);
  const [isBranchSwitching, setIsBranchSwitching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const refreshTimerRef = useRef(null);
  const failSafeTimerRef = useRef(null);

  useEffect(() => {
    dispatch(hydrateSelectedBranch());
  }, [dispatch]);

  useEffect(() => {
    if (!isAdmin) return;
    API.get('/branches', { skipSuccessToast: true, skipErrorToast: true })
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        dispatch(setAvailableBranches(list));
        if (!list.length) return;
        const storedBranchId =
          typeof window !== 'undefined'
            ? window.localStorage.getItem('crm.selectedBranchId')
            : null;
        const resolvedBranchId =
          selectedBranchId && list.some((b) => b._id === selectedBranchId)
            ? selectedBranchId
            : storedBranchId && list.some((b) => b._id === storedBranchId)
              ? storedBranchId
              : null;
        if (!resolvedBranchId) {
          const preferredBranchId =
            user?.branchId && list.some((b) => b._id === user.branchId)
              ? user.branchId
              : list[0]._id;
          dispatch(setSelectedBranch(preferredBranchId));
        } else if (resolvedBranchId !== selectedBranchId) {
          dispatch(setSelectedBranch(resolvedBranchId));
        }
      })
      .catch(() => {
        dispatch(setAvailableBranches([]));
      });
  }, [dispatch, isAdmin, selectedBranchId, user?.branchId]);

  const handleBranchChange = (branchId) => {
    if (!branchId || branchId === selectedBranchId) return;
    setIsBranchSwitching(true);
    dispatch(setSelectedBranch(branchId));
    refreshTimerRef.current = window.setTimeout(() => {
      window.location.reload();
    }, 1400);
    // Safety net: never leave user stuck on loading.
    failSafeTimerRef.current = window.setTimeout(() => {
      window.location.reload();
    }, 10000);
  };

  useEffect(() => () => {
    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    if (failSafeTimerRef.current) window.clearTimeout(failSafeTimerRef.current);
  }, []);

  const handleBranchToggle = () => {
    if (!availableBranches.length) return;
    const currentIndex = availableBranches.findIndex((b) => b._id === selectedBranchId);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % availableBranches.length : 0;
    handleBranchChange(availableBranches[nextIndex]?._id);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const handleAppRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    refreshAppData(queryClient).finally(() => {
      window.setTimeout(() => setIsRefreshing(false), 900);
    });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) navigate(`/leads?search=${encodeURIComponent(q)}`);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-subtle bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-sm">
      <div className="relative flex items-center gap-3 sm:gap-4 px-4 lg:px-6 h-[68px]">
        {/* Mobile menu */}
        <button
          type="button"
          onClick={() => toggleMobileOpen()}
          className={cn(
            'lg:hidden flex items-center justify-center w-10 h-10 rounded-xl',
            'border border-subtle bg-surface/90 text-content-secondary shadow-sm transition-colors',
            accent.iconHover
          )}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="hidden sm:flex flex-1 max-w-xl">
          <div className="relative w-full group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads, customers, bookings..."
              className={cn(
                'w-full h-10 pl-10 pr-20 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-subtle text-sm text-content-primary placeholder:text-content-muted outline-none transition-all',
                accent.searchFocus
              )}
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white dark:bg-slate-700 border border-subtle text-[10px] font-semibold text-content-muted pointer-events-none">
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </div>
          </div>
        </form>

        <div className="flex-1 sm:hidden" />

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {user && (
            <button
              type="button"
              onClick={handleAppRefresh}
              disabled={isRefreshing}
              className={cn(
                'inline-flex items-center gap-2 h-10 rounded-xl border border-subtle bg-surface/95',
                'text-xs font-semibold text-content-primary transition-colors',
                'px-3 disabled:opacity-70',
                accent.iconHover
              )}
              title="Refresh data"
              aria-label="Refresh data"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 shrink-0', isRefreshing && 'animate-spin')} />
              <span className="hidden md:inline">Refresh</span>
            </button>
          )}
          {isAdmin && availableBranches.length > 0 && (
            <div className="hidden md:inline-flex items-center h-10 rounded-xl border border-subtle bg-surface/95 p-1">
              {availableBranches.slice(0, 2).map((branch) => {
                const isActive = branch._id === selectedBranchId;
                const branchLabel = formatBranchLabel(branch.name);
                return (
                  <button
                    key={branch._id}
                    type="button"
                    onClick={() => handleBranchChange(branch._id)}
                    disabled={isBranchSwitching || isActive}
                    className={cn(
                      'px-3 h-8 rounded-lg text-xs font-semibold transition-colors',
                      isActive
                        ? 'bg-brand-600 text-white'
                        : 'text-content-muted hover:text-content-primary',
                      'disabled:opacity-90'
                    )}
                    title={`Switch to ${branchLabel}`}
                  >
                    {branchLabel}
                  </button>
                );
              })}
              {availableBranches.length > 2 && (
                <button
                  type="button"
                  onClick={handleBranchToggle}
                  disabled={isBranchSwitching}
                  className="px-2 h-8 rounded-lg text-xs font-semibold text-content-muted hover:text-content-primary"
                  title="Switch to next branch"
                >
                  +{availableBranches.length - 2}
                </button>
              )}
            </div>
          )}

          {canAddLead && (
            <Link
              to={user?.role === 'sales_executive' ? '/sales-executive/leads/add' : '/leads/new'}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 shadow-md shadow-blue-500/25 transition-all active:scale-[0.98] hidden sm:inline-flex"
            >
              <Plus className="w-4 h-4" />
              Add Lead
              <ChevronDown className="w-3.5 h-3.5 opacity-80" />
            </Link>
          )}

          <AttendanceTopBarAction accent={accent} />

          {canAddLead && (
            <Link
              to={user?.role === 'sales_executive' ? '/sales-executive/leads/add' : '/leads/new'}
              className="sm:hidden flex items-center justify-center w-10 h-10 rounded-xl text-white bg-blue-500 shadow-md"
              aria-label="Add Lead"
            >
              <Plus className="w-5 h-5" />
            </Link>
          )}

          {NOTIFICATIONS_ENABLED && (
            <IconButton
              accent={accent}
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
              onClick={openDrawer}
            >
              <Bell className="w-[18px] h-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </IconButton>
          )}

          <IconButton accent={accent} onClick={toggleTheme} aria-label="Toggle theme">
            {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          </IconButton>

          {user ? (
            <DropdownMenuRoot>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-2.5 pl-1.5 pr-2 h-10 rounded-xl',
                    'border border-subtle bg-surface/95 shadow-sm',
                    'hover:bg-surface-elevated transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500/25'
                  )}
                >
                  <div className="relative">
                    <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-[11px] font-bold text-white', accent.avatar)}>
                      {getInitials(user.name)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                  </div>
                  <div className="hidden md:block text-left min-w-0 max-w-[110px]">
                    <p className="text-xs font-bold text-content-primary truncate leading-tight">{user.name}</p>
                    <p className="text-[10px] text-content-muted truncate leading-tight">{adminRoleLine}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-content-muted hidden md:block shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5">
                <DropdownMenuLabel className="px-2 py-2">
                  <p className="font-bold text-content-primary truncate">{user.name}</p>
                  <p className="text-xs font-normal text-content-muted truncate mt-0.5">{user.email}</p>
                  <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                    ● Online
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={profilePath} className="cursor-pointer rounded-lg">
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
          ) : (
            <Link
              to="/login"
              className={cn(
                'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white',
                'bg-gradient-to-r shadow-md transition-all', accent.addBtn
              )}
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}
        </div>
      </div>
      {isBranchSwitching && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900 text-white shadow-2xl p-6 text-center">
            <div className="mx-auto mb-4 w-10 h-10 rounded-full border-2 border-white/25 border-t-white animate-spin" />
            <p className="text-base font-semibold">Switching branch...</p>
            <p className="text-sm text-slate-300 mt-1">Refreshing data. Please wait.</p>
          </div>
        </div>,
        document.body
      )}

    </header>
  );
}
