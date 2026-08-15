import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SidebarProvider } from '../../context/SidebarContext';
import AppSidebar from '../sidebar/AppSidebar';
import MobileSidebarDrawer from '../sidebar/MobileSidebarDrawer';
import TopBar from '../TopBar';
import MissedFollowUpAlert from '../notifications/MissedFollowUpAlert';
import RouteFallback from '../ui/RouteFallback';
import PanelMobileNav from '../mobile/PanelMobileNav';
import { salesManagerNavItems } from './sidebar-config';
import ManagerCommandTopBar from './dashboard/ManagerCommandTopBar';

function SalesManagerShell() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isQuotationBuilder = pathname === '/sales-manager/quotations/new';
  const isCommandCenter = pathname === '/sales-manager/dashboard' || pathname === '/sales-manager';

  const sidebarProps = {
    user,
    navItems: salesManagerNavItems,
    brandSubtitle: 'Sales Manager',
    accent: 'violet',
    profilePath: '/sales-manager/profile',
  };

  return (
    <div className="flex min-h-screen bg-[#F4F6FB]">
      <div className="hidden lg:block h-screen sticky top-0">
        <AppSidebar {...sidebarProps} className="h-screen border-r-violet-500/10" />
      </div>

      <MobileSidebarDrawer sidebarProps={sidebarProps} />

      <div className="flex-1 flex flex-col min-w-0">
        <div className={isQuotationBuilder ? 'hidden lg:block' : ''}>
          {isCommandCenter ? <ManagerCommandTopBar /> : <TopBar />}
        </div>
        <main className={`flex-1 overflow-auto ${isQuotationBuilder ? 'pb-0' : 'pb-20 lg:pb-0'}`}>
          <div
            className={`${
              isQuotationBuilder
                ? 'p-0 lg:p-8'
                : isCommandCenter
                  ? 'p-4 sm:p-5 lg:p-6'
                  : 'p-4 sm:p-6 lg:p-8'
            } max-w-[1600px] mx-auto`}
          >
            {!isQuotationBuilder && <MissedFollowUpAlert />}
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        {!isQuotationBuilder && <PanelMobileNav />}
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
