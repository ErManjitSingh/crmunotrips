import {
  LayoutDashboard,
  Users,
  MessageCircle,
  FileText,
  Mail,
  Globe2,
  UsersRound,
  BarChart3,
  Bell,
  Settings,
  Clock,
  MapPin,
  Award,
  BarChart2,
  Timer,
  Briefcase,
  Plane,
  CreditCard,
  Megaphone,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { operationsAdminMenuChildren } from '../operations-manager/operations-nav-config';
import { leadManagementSections } from './lead-management-config';

export const reportsAnalyticsItems = [
  { path: '/reports', label: 'Reports', icon: BarChart3, permission: { module: 'reports', action: 'view' } },
  {
    path: '/leads/analytics',
    label: 'Lead Analytics',
    icon: BarChart2,
    roles: ['admin', 'sales_manager', 'team_leader'],
    permission: { module: 'leads', action: 'view' },
  },
  {
    path: '/leads/sla',
    label: 'SLA Monitor',
    icon: Timer,
    roles: ['admin', 'sales_manager', 'team_leader'],
    permission: { module: 'leads', action: 'view' },
  },
];

export const settingsMenuItems = [
  { path: '/settings', label: 'General Settings', icon: Settings },
  {
    path: '/settings/email-templates',
    label: 'Email Templates',
    icon: Mail,
    permission: { module: 'email', action: 'manage' },
  },
  {
    path: '/settings/announcements',
    label: 'Announcements',
    icon: Megaphone,
    roles: ['admin'],
  },
  {
    path: '/settings/whatsapp-templates',
    label: 'WhatsApp Templates',
    icon: MessageCircle,
    permission: { module: 'whatsapp', action: 'manage' },
  },
  {
    path: '/notifications',
    label: 'Notifications',
    icon: Bell,
    badgeKey: 'notifications.unread',
    permission: { module: 'leads', action: 'view' },
  },
];

export const teamManagementItems = [
  {
    path: '/team',
    label: 'Users & Roles',
    icon: UsersRound,
    permission: { module: 'users', action: 'view' },
  },
  {
    path: '/team/attendance',
    label: 'Attendance',
    icon: Clock,
    roles: ['admin'],
  },
  {
    path: '/team/destination-assignment',
    label: 'Destination Assignment',
    icon: MapPin,
    roles: ['admin', 'sales_manager'],
  },
  {
    path: '/team/skill-assignment',
    label: 'Skill Assignment',
    icon: Award,
    roles: ['admin', 'sales_manager'],
  },
];

export const mainNavItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    id: 'lead-management',
    label: 'Lead Management',
    icon: Users,
    badgeKey: 'leads.unassigned',
    sections: leadManagementSections,
  },
  {
    id: 'operations-management',
    label: 'Operations Management',
    icon: Briefcase,
    roles: ['admin'],
    permission: { module: 'operations', action: 'view' },
    countKey: 'bookings.pending',
    children: operationsAdminMenuChildren,
  },
  {
    path: '/quotations',
    label: 'Quotations',
    icon: FileText,
    badgeKey: 'quotations.pending',
    permission: { module: 'quotations', action: 'view' },
  },
  {
    path: '/packages',
    label: 'Packages',
    icon: Globe2,
    countKey: 'packages',
    permission: { module: 'packages', action: 'view' },
  },
  {
    path: '/operations-manager/bookings/pending',
    label: 'Bookings',
    icon: Plane,
    roles: ['admin'],
    countKey: 'bookings.pending',
    permission: { module: 'operations', action: 'view' },
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: CreditCard,
    roles: ['admin', 'accountant'],
    permission: { module: 'payments', action: 'view' },
    children: [
      {
        path: '/payments',
        label: 'Payments',
        icon: CreditCard,
        permission: { module: 'payments', action: 'view' },
      },
      {
        path: '/invoices',
        label: 'Invoices',
        icon: Receipt,
        permission: { module: 'payments', action: 'view' },
      },
      {
        path: '/refunds',
        label: 'Refunds',
        icon: RotateCcw,
        permission: { module: 'payments', action: 'view' },
      },
    ],
  },
  {
    path: '/email-activity',
    label: 'Email Activity',
    icon: Mail,
    permission: { module: 'email', action: 'send' },
  },
  {
    id: 'reports-analytics',
    label: 'Reports & Analytics',
    icon: BarChart3,
    children: reportsAnalyticsItems,
    permission: { module: 'reports', action: 'view' },
  },
  {
    id: 'team-management',
    label: 'Team Management',
    icon: UsersRound,
    children: teamManagementItems,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    children: settingsMenuItems,
  },
];
