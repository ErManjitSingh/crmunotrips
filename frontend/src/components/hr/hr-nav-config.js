import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarOff,
  Wallet,
  Layers,
  Gift,
  Target,
  UserPlus,
  FolderOpen,
  Laptop,
  Receipt,
  GraduationCap,
  Megaphone,
  BarChart3,
  Settings,
} from 'lucide-react';

/** Flat HR sidebar — matches enterprise HR portal mockup. */
export const hrPortalNavItems = [
  { path: '/hr/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/hr/employees', label: 'Employees', icon: Users },
  { path: '/hr/attendance', label: 'Attendance', icon: Clock },
  { path: '/hr/leaves', label: 'Leave Management', icon: CalendarOff },
  { path: '/hr/payroll', label: 'Payroll', icon: Wallet },
  { path: '/hr/salary-structure', label: 'Salary Structure', icon: Layers },
  { path: '/hr/incentives', label: 'Incentives', icon: Gift },
  { path: '/hr/performance', label: 'Performance', icon: Target },
  { path: '/hr/recruitment', label: 'Recruitment', icon: UserPlus },
  { path: '/hr/documents', label: 'Documents', icon: FolderOpen },
  { path: '/hr/assets', label: 'Assets', icon: Laptop },
  { path: '/hr/expenses', label: 'Expenses', icon: Receipt },
  { path: '/hr/training', label: 'Training', icon: GraduationCap },
  { path: '/hr/announcements', label: 'Announcements', icon: Megaphone },
  { path: '/hr/reports', label: 'Reports', icon: BarChart3 },
  { path: '/hr/settings', label: 'Settings', icon: Settings },
];

/** Grouped sections — kept for exports / future use. */
export const hrManagementSections = [
  {
    title: 'Overview',
    items: hrPortalNavItems.slice(0, 5),
  },
  {
    title: 'Compensation',
    items: hrPortalNavItems.slice(5, 8),
  },
  {
    title: 'Talent',
    items: hrPortalNavItems.slice(8, 10),
  },
  {
    title: 'Workplace',
    items: hrPortalNavItems.slice(10, 14),
  },
  {
    title: 'Insights',
    items: hrPortalNavItems.slice(14),
  },
];
