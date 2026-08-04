import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import RouteFallback from "./ui/RouteFallback";
import { useAuth } from "../context/AuthContext";
import { SidebarProvider } from "../context/SidebarContext";
import AppSidebar from "./sidebar/AppSidebar";
import MobileSidebarDrawer from "./sidebar/MobileSidebarDrawer";
import TopBar from "./TopBar";
import MobileNav from "./MobileNav";

function LayoutShell() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isAdminDashboard = pathname === "/admin/dashboard";
  const isLeadProviderDashboard = pathname === "/lead-provider/dashboard";
  const isAdminLeadDetail =
    user?.role === "admin" &&
    pathname !== "/leads/new" &&
    /^\/leads\/[^/]+$/.test(pathname);
  const isAdminLeadList =
    user?.role === "admin" &&
    (pathname === "/leads" ||
      /^\/leads\/(inbox\/new|new-leads|hot|unassigned|assigned|converted|lost)$/.test(
        pathname,
      ));
  const isQuotationBuilder = pathname === "/quotations/new";
  const isMobileImmersive =
    isAdminDashboard ||
    isLeadProviderDashboard ||
    isAdminLeadDetail ||
    isAdminLeadList ||
    isQuotationBuilder;
  const sidebarProps = { user };

  return (
    <div className="flex min-h-screen bg-surface-app">
      <div className="hidden lg:block h-screen sticky top-0">
        <AppSidebar {...sidebarProps} className="h-screen" />
      </div>

      <MobileSidebarDrawer sidebarProps={sidebarProps} />

      <div className="flex-1 flex flex-col min-w-0">
        <div className={isMobileImmersive ? "hidden lg:block" : ""}>
          <TopBar />
        </div>
        <main
          className={`flex-1 overflow-auto ${isQuotationBuilder ? "pb-0 lg:pb-0" : "pb-20 lg:pb-0"}`}
        >
          <div
            className={`${isMobileImmersive ? "p-0 lg:p-8" : "p-4 sm:p-6 lg:p-8"} max-w-[1600px] mx-auto`}
          >
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
        {!isQuotationBuilder && <MobileNav />}
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
