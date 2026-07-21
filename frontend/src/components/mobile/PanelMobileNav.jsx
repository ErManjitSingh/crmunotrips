import { useLocation } from 'react-router-dom';
import {
  BarChart3,
  CalendarCheck,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  FileText,
  LayoutDashboard,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  ReceiptText,
  Target,
  User,
  UserCheck,
  Users,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import MobileBottomNav from '../ui/MobileBottomNav';

const PANEL_CONFIG = {
  admin: {
    accent: 'brand',
    tabs: [
      { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/leads', label: 'Leads', icon: Users },
      { path: '/leads/new', label: 'Add', icon: Plus, primary: true },
      { path: '/followups', label: 'Follow-ups', icon: CalendarClock },
      { path: '/profile', label: 'Profile', icon: User },
    ],
  },
  accountant: {
    accent: 'emerald',
    tabs: [
      { path: '/accountant/dashboard', label: 'Home', icon: LayoutDashboard },
      { path: '/payments', label: 'Payments', icon: CreditCard },
      { path: '/invoices', label: 'Invoices', icon: ReceiptText, primary: true },
      { path: '/refunds', label: 'Refunds', icon: WalletCards },
      { path: '/profile', label: 'Profile', icon: User },
    ],
  },
  sales_manager: {
    accent: 'violet',
    tabs: [
      { path: '/sales-manager/dashboard', label: 'Home', icon: LayoutDashboard },
      { path: '/sales-manager/leads/all', activePrefix: '/sales-manager/leads', label: 'Leads', icon: Users },
      { path: '/sales-manager/assignment', label: 'Assign', icon: UserCheck, primary: true },
      { path: '/sales-manager/follow-ups', label: 'Follow', icon: CalendarClock },
      { path: '/sales-manager/profile', label: 'Profile', icon: User },
    ],
  },
  team_leader: {
    accent: 'amber',
    tabs: [
      { path: '/team-leader/dashboard', label: 'Home', icon: LayoutDashboard },
      { path: '/team-leader/leads', label: 'Leads', icon: Users },
      { path: '/team-leader/follow-ups', label: 'Follow', icon: CalendarClock, primary: true },
      { path: '/team-leader/performance', label: 'Team', icon: BarChart3 },
      { path: '/team-leader/profile', label: 'Profile', icon: User },
    ],
  },
  sales_executive: {
    accent: 'violet',
    tabs: [
      { path: '/sales-executive/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/sales-executive/leads/all', activePrefix: '/sales-executive/leads', label: 'Leads', icon: Users },
      { path: '/sales-executive/leads/add', label: 'Add', icon: Plus, primary: true },
      { path: '/sales-executive/follow-ups', label: 'Follow-ups', icon: Phone },
      { path: '/sales-executive/profile', label: 'More', icon: MoreHorizontal },
    ],
  },
  operations_manager: {
    accent: 'teal',
    tabs: [
      { path: '/operations-manager/dashboard', label: 'Home', icon: LayoutDashboard },
      { path: '/operations-manager/bookings/pending', activePrefix: '/operations-manager/bookings', label: 'Bookings', icon: ClipboardCheck },
      { path: '/operations-manager/trip-tracker', label: 'Trips', icon: MapPin, primary: true },
      { path: '/operations-manager/tasks', label: 'Tasks', icon: Target },
      { path: '/operations-manager/profile', label: 'Profile', icon: User },
    ],
  },
  hr_admin: {
    accent: 'sunset',
    tabs: [
      { path: '/hr/dashboard', label: 'Home', icon: LayoutDashboard },
      { path: '/hr/employees', activePrefix: '/hr/employees', label: 'Employees', icon: UsersRound },
      { path: '/hr/attendance', label: 'Attendance', icon: CalendarCheck, primary: true },
      { path: '/hr/leaves', label: 'Leaves', icon: CalendarClock },
      { path: '/hr/profile', label: 'Profile', icon: User },
    ],
  },
};

function resolvePanel(pathname, role) {
  if (pathname.startsWith('/sales-manager')) return 'sales_manager';
  if (pathname.startsWith('/team-leader')) return 'team_leader';
  if (pathname.startsWith('/sales-executive')) return 'sales_executive';
  if (pathname.startsWith('/operations-manager')) return 'operations_manager';
  if (pathname.startsWith('/hr')) return 'hr_admin';
  return role === 'accountant' ? 'accountant' : 'admin';
}

export default function PanelMobileNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const panel = resolvePanel(pathname, user?.role);
  const config = PANEL_CONFIG[panel];

  const isActive = (path, tab) => {
    const prefix = tab?.activePrefix || path;
    if (path.endsWith('/dashboard')) return pathname === path;
    if (tab?.primary) return pathname === path;
    if (path === '/leads/new') return pathname === path;
    return pathname.startsWith(prefix);
  };

  return (
    <MobileBottomNav
      tabs={config.tabs}
      isActive={(path) => isActive(path, config.tabs.find((tab) => tab.path === path))}
      accent={config.accent}
    />
  );
}
