import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SidebarProvider } from '../../context/SidebarContext';
import AppSidebar from '../sidebar/AppSidebar';
import MobileSidebarDrawer from '../sidebar/MobileSidebarDrawer';
import TopBar from '../TopBar';
import MissedFollowUpAlert from '../notifications/MissedFollowUpAlert';
import RouteFallback from '../ui/RouteFallback';
import SalesExecutiveMobileNav from './SalesExecutiveMobileNav';
import ExecutiveSidebarFooter from './ExecutiveSidebarFooter';
import { salesExecutiveNavItems } from './sidebar-config';

function SalesExecutiveShell() {
  const { user } = useAuth();

  const sidebarProps = {
    user,
    navItems: salesExecutiveNavItems,
    brandSubtitle: 'Sales Executive',
    accent: 'violet',
    profilePath: '/sales-executive/profile',
    quickActions: [],
    sidebarFooter: <ExecutiveSidebarFooter />,
  };

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-[#F8F9FD] dark:bg-surface-app">
      <div className="hidden lg:block shrink-0">
        <AppSidebar {...sidebarProps} className="h-dvh border-r-violet-500/10" />
      </div>

      <MobileSidebarDrawer sidebarProps={sidebarProps} />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <TopBar />
        <main data-workspace-main className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain pb-20 lg:pb-0">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
            <MissedFollowUpAlert />
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <SalesExecutiveMobileNav />
      </div>
    </div>
  );
}

export default function SalesExecutiveLayout() {
  return (
    <SidebarProvider>
      <SalesExecutiveShell />
    </SidebarProvider>
  );
}
