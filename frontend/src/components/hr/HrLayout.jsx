import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SidebarProvider } from '../../context/SidebarContext';
import AppSidebar from '../sidebar/AppSidebar';
import MobileSidebarDrawer from '../sidebar/MobileSidebarDrawer';
import RouteFallback from '../ui/RouteFallback';
import PanelMobileNav from '../mobile/PanelMobileNav';
import HrTopBar from './HrTopBar';
import HrSidebarFooter from './HrSidebarFooter';
import HrSidebarHero from './HrSidebarHero';
import { hrPortalNavItems } from './hr-nav-config';
import { APP_BRAND_NAME } from '../../config/branding';

function HrShell() {
  const { user } = useAuth();

  const sidebarProps = {
    user,
    navItems: hrPortalNavItems,
    brandTitle: APP_BRAND_NAME,
    brandSubtitle: 'HR Management',
    accent: 'sunset',
    sidebarVariant: 'sunset',
    profilePath: '/hr/profile',
    // HR portal me "Key Highlights" strip nahi chahiye.
    // Empty array => SidebarQuickActions render nahi karega.
    quickActions: [],
    sidebarHero: <HrSidebarHero user={user} />,
    sidebarFooter: <HrSidebarFooter user={user} />,
  };

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <div className="hidden lg:block h-screen sticky top-0">
        <AppSidebar {...sidebarProps} className="h-screen border-r-orange-200/20" />
      </div>

      <MobileSidebarDrawer sidebarProps={sidebarProps} />

      <div className="flex-1 flex flex-col min-w-0">
        <HrTopBar />
        <main className="flex-1 overflow-auto pb-20 lg:pb-0">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        <PanelMobileNav />
      </div>
    </div>
  );
}

export default function HrLayout() {
  return (
    <SidebarProvider>
      <HrShell />
    </SidebarProvider>
  );
}
