import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SidebarProvider } from '../../context/SidebarContext';
import AppSidebar from '../sidebar/AppSidebar';
import MobileSidebarDrawer from '../sidebar/MobileSidebarDrawer';
import TopBar from '../TopBar';
import MissedFollowUpAlert from '../notifications/MissedFollowUpAlert';
import { teamLeaderNavItems } from './sidebar-config';

function TeamLeaderShell() {
  const { user } = useAuth();

  const sidebarProps = {
    user,
    navItems: teamLeaderNavItems,
    brandSubtitle: 'Team Leader',
    accent: 'amber',
    profilePath: '/team-leader/profile',
    quickActions: [],
  };

  return (
    <div className="flex min-h-screen bg-surface-app">
      <div className="hidden lg:block h-screen sticky top-0">
        <AppSidebar {...sidebarProps} className="h-screen border-r-amber-500/10" />
      </div>

      <MobileSidebarDrawer sidebarProps={sidebarProps} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
            <MissedFollowUpAlert />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default function TeamLeaderLayout() {
  return (
    <SidebarProvider>
      <TeamLeaderShell />
    </SidebarProvider>
  );
}
