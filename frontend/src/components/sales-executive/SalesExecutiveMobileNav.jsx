import { useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarClock, FileText, User, Plus } from 'lucide-react';
import MobileBottomNav from '../ui/MobileBottomNav';

const tabs = [
  { path: '/sales-executive/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/sales-executive/leads/all', label: 'Leads', icon: Users },
  { path: '/sales-executive/leads/add', label: 'Add', icon: Plus, primary: true },
  { path: '/sales-executive/follow-ups', label: 'Follow', icon: CalendarClock },
  { path: '/sales-executive/profile', label: 'Profile', icon: User },
];

export default function SalesExecutiveMobileNav() {
  const location = useLocation();

  const isActive = (path) => {
    const { pathname } = location;
    if (path === '/sales-executive/dashboard') return pathname === path;
    if (path === '/sales-executive/leads/add') return pathname === path;
    if (path === '/sales-executive/leads/all') {
      return pathname.startsWith('/sales-executive/leads') && pathname !== '/sales-executive/leads/add';
    }
    if (path === '/sales-executive/profile') return pathname.startsWith('/sales-executive/profile');
    return pathname.startsWith(path);
  };

  return <MobileBottomNav tabs={tabs} isActive={isActive} accent="violet" />;
}
