import {
  Users,
  Sparkles,
  CalendarDays,
  Inbox,
  UserCheck,
  CalendarClock,
  Bell,
  Flame,
  RefreshCw,
  MessageCircle,
  Trophy,
  XCircle,
  BarChart2,
  Timer,
  Shield,
  Archive,
  Undo2,
} from 'lucide-react';

const leadPerm = { module: 'leads', action: 'view' };
const analyticsRoles = ['admin', 'sales_manager', 'team_leader'];
const systemRoles = ['admin', 'sales_manager'];
const followupRoles = ['admin', 'sales_manager', 'team_leader', 'sales_executive'];

/** Grouped Lead Management sidebar — HubSpot-style sections */
export const leadManagementSections = [
  {
    id: 'leads',
    label: 'Leads',
    defaultOpen: true,
    items: [
      {
        path: '/leads',
        label: 'All Leads',
        icon: Users,
        permission: leadPerm,
        countKey: 'leads.all',
      },
      {
        path: '/whatsapp',
        label: 'WhatsApp Leads',
        icon: MessageCircle,
        permission: { module: 'whatsapp', action: 'use' },
      },
      {
        path: '/leads/returned',
        label: 'Returned Leads',
        icon: Undo2,
        badgeKey: 'leads.returned',
        permission: leadPerm,
      },
      {
        path: '/leads/inbox/new',
        label: 'New Leads',
        icon: Sparkles,
        badgeKey: 'leads.statusNew',
        permission: leadPerm,
      },
      {
        path: '/leads/new-leads',
        label: "Today's Leads",
        icon: CalendarDays,
        badgeKey: 'leads.new',
        accent: 'blue',
        permission: leadPerm,
      },
      {
        path: '/leads/unassigned',
        label: 'Unassigned Leads',
        icon: Inbox,
        badgeKey: 'leads.unassigned',
        permission: leadPerm,
      },
      {
        path: '/leads/assigned',
        label: 'Assigned Leads',
        icon: UserCheck,
        countKey: 'leads.assigned',
        permission: leadPerm,
      },
      {
        path: '/leads/hot',
        label: 'Hot Leads',
        icon: Flame,
        badgeKey: 'leads.hot',
        accent: 'orange',
        permission: leadPerm,
      },
    ],
  },
  {
    id: 'followups',
    label: 'Followups',
    defaultOpen: true,
    roles: followupRoles,
    items: [
      {
        path: '/followups',
        label: 'Follow Ups',
        icon: CalendarClock,
        badgeKey: 'followups.due',
        roles: followupRoles,
        permission: leadPerm,
      },
      {
        path: '/reminders',
        label: 'Reminder Center',
        icon: Bell,
        badgeKey: 'reminders.overdue',
        roles: followupRoles,
        permission: leadPerm,
      },
    ],
  },
  {
    id: 'recovery',
    label: 'Recovery',
    defaultOpen: false,
    items: [
      {
        path: '/leads/reactivated',
        label: 'Reactivated Leads',
        icon: RefreshCw,
        permission: leadPerm,
      },
    ],
  },
  {
    id: 'results',
    label: 'Results',
    defaultOpen: false,
    items: [
      {
        path: '/leads/converted',
        label: 'Converted Leads',
        icon: Trophy,
        accent: 'green',
        permission: leadPerm,
      },
      {
        path: '/leads/lost',
        label: 'Lost Leads',
        icon: XCircle,
        accent: 'red',
        permission: leadPerm,
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    defaultOpen: false,
    items: [
      {
        path: '/leads/analytics',
        label: 'Lead Analytics',
        icon: BarChart2,
        roles: analyticsRoles,
        permission: leadPerm,
      },
      {
        path: '/leads/sla',
        label: 'SLA Monitor',
        icon: Timer,
        roles: analyticsRoles,
        permission: leadPerm,
      },
      {
        path: '/leads/audit-log',
        label: 'Audit Log',
        icon: Shield,
        roles: systemRoles,
        permission: leadPerm,
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    defaultOpen: false,
    items: [
      {
        path: '/leads/recycle-bin',
        label: 'Recycle Bin',
        icon: Archive,
        roles: systemRoles,
        permission: leadPerm,
      },
    ],
  },
];
