import {
  LayoutDashboard,
  Users,
  Clock,
  CalendarOff,
  CalendarDays,
  Building2,
  BadgeCheck,
  Wallet,
  Layers,
  Gift,
  Target,
  UserPlus,
  Briefcase,
  MessagesSquare,
  Laptop,
  FolderOpen,
  Receipt,
  Megaphone,
  PartyPopper,
  GraduationCap,
  LogOut,
  BarChart3,
  Settings,
} from 'lucide-react';

/** HR Management sidebar sections — admin CRM. */
export const hrManagementSections = [
  {
    title: 'Overview',
    items: [
      { path: '/hr', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { path: '/hr/employees', label: 'Employees', icon: Users },
      { path: '/hr/attendance', label: 'Attendance', icon: Clock },
      { path: '/hr/leaves', label: 'Leave Management', icon: CalendarOff },
      { path: '/hr/holidays', label: 'Holidays', icon: CalendarDays },
    ],
  },
  {
    title: 'Organization',
    items: [
      { path: '/hr/departments', label: 'Departments', icon: Building2 },
      { path: '/hr/designations', label: 'Designations', icon: BadgeCheck },
    ],
  },
  {
    title: 'Compensation',
    items: [
      { path: '/hr/payroll', label: 'Payroll', icon: Wallet },
      { path: '/hr/salary-structure', label: 'Salary Structure', icon: Layers },
      { path: '/hr/incentives', label: 'Incentives', icon: Gift },
    ],
  },
  {
    title: 'Talent',
    items: [
      { path: '/hr/performance', label: 'Performance', icon: Target },
      { path: '/hr/recruitment', label: 'Recruitment', icon: UserPlus },
      { path: '/hr/job-openings', label: 'Job Openings', icon: Briefcase },
      { path: '/hr/interviews', label: 'Interviews', icon: MessagesSquare },
    ],
  },
  {
    title: 'Workplace',
    items: [
      { path: '/hr/assets', label: 'Assets', icon: Laptop },
      { path: '/hr/documents', label: 'Documents', icon: FolderOpen },
      { path: '/hr/expenses', label: 'Expenses', icon: Receipt },
      { path: '/hr/announcements', label: 'Announcements', icon: Megaphone },
      { path: '/hr/events', label: 'Events', icon: PartyPopper },
      { path: '/hr/training', label: 'Training', icon: GraduationCap },
      { path: '/hr/exit', label: 'Exit Management', icon: LogOut },
    ],
  },
  {
    title: 'Insights',
    items: [
      { path: '/hr/reports', label: 'Reports', icon: BarChart3 },
      { path: '/hr/settings', label: 'Settings', icon: Settings },
    ],
  },
];
