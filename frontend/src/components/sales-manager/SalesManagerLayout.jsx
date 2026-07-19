import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SidebarProvider } from '../../context/SidebarContext';
import AppSidebar from '../sidebar/AppSidebar';
import MobileSidebarDrawer from '../sidebar/MobileSidebarDrawer';
import TopBar from '../TopBar';
import MissedFollowUpAlert from '../notifications/MissedFollowUpAlert';
import RouteFallback from '../ui/RouteFallback';
import { salesManagerNavItems } from './sidebar-config';

function SalesManagerShell() {
  const { user } = useAuth();

  const sidebarProps = {
    user,
    navItems: salesManagerNavItems,
    brandSubtitle: 'Sales Manager',
    accent: 'violet',
    profilePath: '/sales-manager/profile',
  };

  return (
    <div className="flex min-h-screen bg-surface-app">
      <div className="hidden lg:block h-screen sticky top-0">
        <AppSidebar {...sidebarProps} className="h-screen border-r-violet-500/10" />
      </div>

      <MobileSidebarDrawer sidebarProps={sidebarProps} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
            <MissedFollowUpAlert />
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SalesManagerLayout() {
  return (
    <SidebarProvider>
      <SalesManagerShell />
    </SidebarProvider>
  );
}
