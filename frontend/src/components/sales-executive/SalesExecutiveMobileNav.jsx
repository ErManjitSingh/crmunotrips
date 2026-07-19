import { useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarClock, FileText, User } from 'lucide-react';
import MobileBottomNav from '../ui/MobileBottomNav';

const tabs = [
  { path: '/sales-executive/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/sales-executive/leads/all', label: 'Leads', icon: Users },
  { path: '/sales-executive/follow-ups', label: 'Follow', icon: CalendarClock, primary: true },
  { path: '/sales-executive/quotations', label: 'Quotes', icon: FileText },
  { path: '/sales-executive/profile', label: 'Profile', icon: User },
];

export default function SalesExecutiveMobileNav() {
  const location = useLocation();

  const isActive = (path) => {
    const { pathname } = location;
    if (path === '/sales-executive/dashboard') return pathname === path;
    if (path === '/sales-executive/leads/all') return pathname.startsWith('/sales-executive/leads');
    if (path === '/sales-executive/profile') return pathname.startsWith('/sales-executive/profile');
    return pathname.startsWith(path);
  };

  return <MobileBottomNav tabs={tabs} isActive={isActive} accent="violet" />;
}
