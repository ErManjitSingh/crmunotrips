import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSidebar } from '../../context/SidebarContext';
import { useAuth } from '../../context/AuthContext';
import { filterNavItems } from '../../lib/permissions';
import { applySidebarCounts } from '../../lib/applySidebarCounts';
import { useSidebarCounts } from '../../hooks/useSidebarCounts';
import { TooltipProvider } from '../ui/tooltip';
import SidebarBrand from './SidebarBrand';
import { APP_BRAND_NAME } from '../../config/branding';
import SidebarNavItem from './SidebarNavItem';
import SidebarNavGroup from './SidebarNavGroup';
import SidebarNavSection from './SidebarNavSection';
import SidebarQuickActions from './SidebarQuickActions';
import SidebarCollectionTarget from './SidebarCollectionTarget';
import { SidebarThemeProvider } from './SidebarThemeContext';
import { mainNavItems } from './sidebar-config';
import { filterNavItemsBySearch, injectSectionHeaders, isNavItemActive } from './sidebar-utils';
import { cn } from '../../lib/utils';

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

function getSidebarTimeTheme(hour) {
  if (hour >= 5 && hour < 12) return 'sidebar-time-morning';
  if (hour >= 12 && hour < 17) return 'sidebar-time-afternoon';
  return 'sidebar-time-night';
}

export default function AppSidebar({
  user,
  className = '',
  navItems: navItemsProp,
  brandTitle,
  brandSubtitle,
  accent = 'brand',
  sidebarVariant = 'sunset',
  profilePath,
  quickActions,
  sidebarHero,
  sidebarFooter,
}) {
  const location = useLocation();
  const { collapsed, expandedWidth, collapsedWidth } = useSidebar();
  const { user: authUser } = useAuth();
  const { selectedBranchId, availableBranches } = useSelector((s) => s.branch);
  const [searchQuery] = useState('');
  const [timeTheme, setTimeTheme] = useState(() => getSidebarTimeTheme(new Date().getHours()));
  const width = collapsed ? collapsedWidth : expandedWidth;

  useEffect(() => {
    const syncTheme = () => setTimeTheme(getSidebarTimeTheme(new Date().getHours()));
    const timer = window.setInterval(syncTheme, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const sidebarCounts = useSidebarCounts();

  const baseNavItems = useMemo(() => {
    const items = navItemsProp ? navItemsProp : filterNavItems(mainNavItems, authUser || user);
    return applySidebarCounts(items, sidebarCounts);
  }, [navItemsProp, authUser, user, sidebarCounts]);

  const navItems = useMemo(() => {
    const filtered = filterNavItemsBySearch(baseNavItems, searchQuery);
    const hasSections = filtered.some((item) => item.section);
    return hasSections ? injectSectionHeaders(filtered) : filtered;
  }, [baseNavItems, searchQuery]);

  const resolvedProfilePath =
    profilePath ||
    (location.pathname.startsWith('/hr') ? '/hr/profile' :
      location.pathname.startsWith('/operations-manager') ? '/operations-manager/profile' :
      location.pathname.startsWith('/sales-manager') ? '/sales-manager/profile' :
        location.pathname.startsWith('/team-leader') ? '/team-leader/profile' :
          location.pathname.startsWith('/sales-executive') ? '/sales-executive/profile' :
            '/profile');

  const effectiveUser = authUser || user;
  const selectedBranch = availableBranches.find((b) => b._id === selectedBranchId);
  const selectedBranchLabel = formatBranchLabel(selectedBranch?.name);
  const resolvedBrandTitle = brandTitle || APP_BRAND_NAME;
  const financeRole = ['admin', 'accountant'].includes(effectiveUser?.role);
  const onFinanceRoute = ['/payments', '/invoices', '/refunds'].some((p) =>
    location.pathname.startsWith(p)
  );
  const showCollectionTarget = financeRole && (onFinanceRoute || effectiveUser?.role === 'accountant');
  const resolvedBrandSubtitle =
    brandSubtitle ||
    (effectiveUser?.role === 'admin'
      ? selectedBranchLabel || 'Super Admin'
      : effectiveUser?.role === 'accountant'
        ? 'Finance'
        : 'Travel Lead Management');

  return (
    <SidebarThemeProvider
      accent={sidebarVariant === 'sunset' ? 'sunset' : accent}
      profilePath={resolvedProfilePath}
    >
      <TooltipProvider delayDuration={0}>
        <motion.aside
          animate={{ width }}
          transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
          className={cn(
            'sidebar-dark relative flex flex-col h-full shrink-0 overflow-hidden',
            'border-r border-white/[0.06]',
            'shadow-[4px_0_32px_-8px_rgba(0,0,0,0.4)]',
            sidebarVariant === 'sunset' && 'hr-sidebar-sunset',
            sidebarVariant === 'sunset' && timeTheme,
            className
          )}
        >
          <div className="relative z-10 flex flex-col h-full min-h-0">
            <SidebarBrand title={resolvedBrandTitle} subtitle={resolvedBrandSubtitle} />
            {sidebarHero}

            <nav className="relative flex-1 px-2 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-thin">
              {navItems.length === 0 && searchQuery && !collapsed && (
                <p className="px-3 py-6 text-center text-xs text-sidebar-muted">No menu items match your search.</p>
              )}
              {navItems.map((item) => {
                if (item.type === 'section') {
                  return <SidebarNavSection key={`section-${item.label}`} label={item.label} />;
                }
                if (item.children || item.sections) {
                  return <SidebarNavGroup key={item.id} group={item} defaultOpen={!!searchQuery} />;
                }
                return (
                  <SidebarNavItem
                    key={item.path}
                    item={item}
                    isActive={isNavItemActive(location.pathname, item.path)}
                  />
                );
              })}
            </nav>

            <SidebarQuickActions actions={showCollectionTarget ? [] : quickActions} />
            {showCollectionTarget ? <SidebarCollectionTarget /> : null}
            {sidebarFooter}
          </div>
        </motion.aside>
      </TooltipProvider>
    </SidebarThemeProvider>
  );
}
