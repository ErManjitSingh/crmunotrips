import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SidebarProvider } from '../../context/SidebarContext';
import AppSidebar from '../sidebar/AppSidebar';
import MobileSidebarDrawer from '../sidebar/MobileSidebarDrawer';
import MobileBottomNav from '../ui/MobileBottomNav';
import RouteFallback from '../ui/RouteFallback';
import ColdCallingTopBar from './ColdCallingTopBar';
import { coldCallingNavItems } from './sidebar-config';
import { COLD_CALLING_HOME_PATH } from '../../lib/coldCallingWorkspace';

const mobileTabs = coldCallingNavItems.map(({ path, label, icon }) => ({ path, label, icon }));
// Dashboard is the workspace root, so it is active only on an exact match (My Leads lives beneath it).
const isMobileTabActive = (pathname) => (path) =>
  path === COLD_CALLING_HOME_PATH ? pathname === path : pathname.startsWith(path);

function ColdCallingShell() {
  const { user } = useAuth();

  const sidebarProps = {
    user,
    navItems: coldCallingNavItems,
    brandSubtitle: 'Cold Calling',
    accent: 'sky',
    profilePath: COLD_CALLING_HOME_PATH,
    quickActions: [],
    showCounts: false,
  };

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-[#F8F9FD] dark:bg-surface-app">
      <div className="hidden shrink-0 lg:block">
        <AppSidebar {...sidebarProps} className="h-dvh" />
      </div>

      <MobileSidebarDrawer sidebarProps={sidebarProps} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ColdCallingTopBar />
        <main data-workspace-main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-20 lg:pb-0">
          <div className="mx-auto max-w-[1600px] p-3 sm:p-4 lg:p-5">
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <MobileNav />
      </div>
    </div>
  );
}

function MobileNav() {
  const { pathname } = useLocation();
  return <MobileBottomNav tabs={mobileTabs} isActive={isMobileTabActive(pathname)} accent="sky" />;
}

export default function ColdCallingLayout() {
  return (
    <SidebarProvider>
      <ColdCallingShell />
    </SidebarProvider>
  );
}
