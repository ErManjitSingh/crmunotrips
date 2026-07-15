import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import RouteFallback from './ui/RouteFallback';
import { useAuth } from '../context/AuthContext';
import { SidebarProvider } from '../context/SidebarContext';
import AppSidebar from './sidebar/AppSidebar';
import MobileSidebarDrawer from './sidebar/MobileSidebarDrawer';
import TopBar from './TopBar';
import MobileNav from './MobileNav';

function LayoutShell() {
  const { user } = useAuth();
  const sidebarProps = { user };

  return (
    <div className="flex min-h-screen bg-surface-app">
      <div className="hidden lg:block h-screen sticky top-0">
        <AppSidebar {...sidebarProps} className="h-screen" />
      </div>

      <MobileSidebarDrawer sidebarProps={sidebarProps} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto pb-20 lg:pb-0">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
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

export default function Layout() {
  return (
    <SidebarProvider>
      <LayoutShell />
    </SidebarProvider>
  );
}
