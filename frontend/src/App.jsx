import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import PostCallSessionHost from './components/leads/PostCallSessionHost';
import ProtectedRoute from './components/ProtectedRoute';
import HrProtectedRoute from './components/hr/HrProtectedRoute';
import PermissionRoute from './components/PermissionRoute';
import RoleRoute, { RoleDashboardRedirect } from './components/RoleRoute';
import Layout from './components/Layout';
import ComingSoon from './components/ui/ComingSoon';
import {
  Login,
  Register,
  Unauthorized,
  AcceptInvite,
  RoleDashboard,
  Dashboard,
  Leads,
  LeadDetail,
  LeadForm,
  Followups,
  Reminders,
  LeadAnalytics,
  SlaMonitor,
  RecycleBin,
  LeadAuditLog,
  WhatsAppLeads,
  Packages,
  Quotations,
  Reports,
  Team,
  TeamUserProfile,
  AdminAttendancePage,
  DestinationAssignmentPage,
  SkillAssignmentPage,
  Notifications,
  SettingsPage,
  WhatsAppTemplatesPage,
  EmailTemplatesPage,
  AnnouncementsPage,
  EmailActivityPage,
  ReactivatedLeadsPage,
  SalesManagerLayout,
  ManagerDashboard,
  TeamLeadsPage,
  ManagerLeadDetailPage,
  LeadAssignmentPage,
  TeamManagementPage,
  TeamDetailPage,
  TeamMonitoringPage,
  FollowUpMonitoringPage,
  QuotationApprovalPage,
  ManagerQuotationBuilder,
  TeamPerformancePage,
  ManagerReportsPage,
  ManagerCalendarPage,
  ManagerNotificationsPage,
  ManagerProfilePage,
  SalesExecutiveLayout,
  ExecutiveDashboard,
  MyLeadsPage,
  ExecutiveLeadDetailPage,
  ExecutiveFollowUpsPage,
  ExecutiveQuotationsPage,
  ExecutiveQuotationBuilder,
  ExecutiveCustomersPage,
  ExecutiveCalendarPage,
  ExecutiveNotificationsPage,
  ExecutiveProfilePage,
  TeamLeaderLayout,
  LeaderDashboard,
  LeaderTeamLeadsPage,
  LeaderLeadDetailPage,
  LeaderFollowUpsPage,
  ExecutivePerformancePage,
  LeadEscalationsPage,
  LeaderQuotationsPage,
  LeaderQuotationBuilder,
  LeaderReportsPage,
  LeaderCalendarPage,
  LeaderNotificationsPage,
  LeaderProfilePage,
  OperationsManagerLayout,
  OperationsDashboard,
  BookingsListPage,
  BookingDetailPage,
  OperationsHotelsPage,
  OperationsTransportPage,
  OperationsActivitiesPage,
  VendorsPage,
  VouchersPage,
  SupportTicketsPage,
  OperationsReportsPage,
  OperationsCalendarPage,
  OperationsProfilePage,
  TripTrackerPage,
  OperationsTasksPage,
  PaymentsPage,
  InvoicesPage,
  RefundsPage,
  HrLayout,
  HrLogin,
  HrDashboard,
  HrEmployeesPage,
  HrEmployeeProfilePage,
  HrDepartmentsPage,
  HrDesignationsPage,
  HrHolidaysPage,
  HrLeavesPage,
  HrAttendancePage,
  HrAnnouncementsPage,
  HrPayrollPage,
  HrSalaryStructurePage,
  HrDocumentsPage,
  HrAssetsPage,
  HrExpensesPage,
  HrPerformancePage,
  HrIncentivesPage,
  HrJobOpeningsPage,
  HrRecruitmentPage,
  HrInterviewsPage,
  HrEventsPage,
  HrTrainingPage,
  HrExitPage,
  HrReportsPage,
  HrSettingsPage,
} from './routes/lazyRoutes';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
          <PostCallSessionHost />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/hr/login" element={<HrLogin />} />
            <Route path="/register" element={<Register />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/accept-invite/:token" element={<AcceptInvite />} />

            <Route
              path="/sales-manager"
              element={
                <ProtectedRoute allowedRoles={['sales_manager']}>
                  <SalesManagerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ManagerDashboard />} />
              <Route path="leads/:id/view" element={<ManagerLeadDetailPage />} />
              <Route path="leads/:filter" element={<TeamLeadsPage />} />
              <Route path="assignment" element={<LeadAssignmentPage />} />
              <Route path="destination-assignment" element={<DestinationAssignmentPage />} />
              <Route path="skill-assignment" element={<SkillAssignmentPage />} />
              <Route path="teams" element={<TeamManagementPage />} />
              <Route path="teams/:id" element={<TeamDetailPage />} />
              <Route path="follow-ups" element={<FollowUpMonitoringPage />} />
              <Route path="team" element={<TeamPerformancePage />} />
              <Route path="email-activity" element={<EmailActivityPage />} />
              <Route path="quotations/new" element={<ManagerQuotationBuilder />} />
              <Route path="quotations/:status" element={<QuotationApprovalPage />} />
              <Route path="reports" element={<ManagerReportsPage />} />
              <Route path="reactivated-leads" element={<ReactivatedLeadsPage />} />
              <Route path="calendar" element={<ManagerCalendarPage />} />
              <Route path="notifications" element={<ManagerNotificationsPage />} />
              <Route path="profile" element={<ManagerProfilePage />} />
            </Route>

            <Route
              path="/sales-executive"
              element={
                <ProtectedRoute allowedRoles={['sales_executive']}>
                  <SalesExecutiveLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ExecutiveDashboard />} />
              <Route path="whatsapp" element={<WhatsAppLeads />} />
              <Route path="leads/add" element={<LeadForm />} />
              <Route path="leads/:id/edit" element={<LeadForm />} />
              <Route path="leads/:id/view" element={<ExecutiveLeadDetailPage />} />
              <Route path="leads/:filter" element={<MyLeadsPage />} />
              <Route path="follow-ups" element={<ExecutiveFollowUpsPage />} />
              <Route path="email-activity" element={<EmailActivityPage />} />
              <Route path="quotations/new" element={<ExecutiveQuotationBuilder />} />
              <Route path="quotations" element={<ExecutiveQuotationsPage />} />
              <Route path="customers" element={<ExecutiveCustomersPage />} />
              <Route path="calendar" element={<ExecutiveCalendarPage />} />
              <Route path="notifications" element={<ExecutiveNotificationsPage />} />
              <Route path="profile" element={<ExecutiveProfilePage />} />
            </Route>

            <Route
              path="/team-leader"
              element={
                <ProtectedRoute allowedRoles={['team_leader']}>
                  <TeamLeaderLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<LeaderDashboard />} />
              <Route path="leads/:id/view" element={<LeaderLeadDetailPage />} />
              <Route path="leads/:filter" element={<LeaderTeamLeadsPage />} />
              <Route path="leads" element={<LeaderTeamLeadsPage />} />
              <Route path="follow-ups" element={<LeaderFollowUpsPage />} />
              <Route path="email-activity" element={<EmailActivityPage />} />
              <Route path="performance" element={<ExecutivePerformancePage />} />
              <Route path="escalations" element={<LeadEscalationsPage />} />
              <Route path="quotations/new" element={<LeaderQuotationBuilder />} />
              <Route path="quotations/:status" element={<LeaderQuotationsPage />} />
              <Route path="reports" element={<LeaderReportsPage />} />
              <Route path="reactivated-leads" element={<ReactivatedLeadsPage />} />
              <Route path="calendar" element={<LeaderCalendarPage />} />
              <Route path="notifications" element={<LeaderNotificationsPage />} />
              <Route path="profile" element={<LeaderProfilePage />} />
            </Route>

            <Route
              path="/operations-manager"
              element={
                <ProtectedRoute allowedRoles={['operations_manager', 'admin']}>
                  <OperationsManagerLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<OperationsDashboard />} />
              <Route path="bookings/:status" element={<BookingsListPage />} />
              <Route path="booking/:id" element={<BookingDetailPage />} />
              <Route path="trip-tracker" element={<TripTrackerPage />} />
              <Route path="tasks" element={<OperationsTasksPage />} />
              <Route path="hotels" element={<OperationsHotelsPage />} />
              <Route path="transport" element={<OperationsTransportPage />} />
              <Route path="activities" element={<OperationsActivitiesPage />} />
              <Route path="vendors" element={<VendorsPage />} />
              <Route path="vouchers" element={<VouchersPage />} />
              <Route path="support" element={<SupportTicketsPage />} />
              <Route path="calendar" element={<OperationsCalendarPage />} />
              <Route path="reports" element={<OperationsReportsPage />} />
              <Route path="profile" element={<OperationsProfilePage />} />
            </Route>

            <Route
              path="/hr"
              element={
                <HrProtectedRoute>
                  <HrLayout />
                </HrProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<PermissionRoute module="hr"><HrDashboard /></PermissionRoute>} />
              <Route path="employees" element={<PermissionRoute module="hr"><HrEmployeesPage /></PermissionRoute>} />
              <Route path="employees/:id" element={<PermissionRoute module="hr"><HrEmployeeProfilePage /></PermissionRoute>} />
              <Route path="attendance" element={<PermissionRoute module="hr"><HrAttendancePage /></PermissionRoute>} />
              <Route path="leaves" element={<PermissionRoute module="hr"><HrLeavesPage /></PermissionRoute>} />
              <Route path="holidays" element={<PermissionRoute module="hr"><HrHolidaysPage /></PermissionRoute>} />
              <Route path="departments" element={<PermissionRoute module="hr"><HrDepartmentsPage /></PermissionRoute>} />
              <Route path="designations" element={<PermissionRoute module="hr"><HrDesignationsPage /></PermissionRoute>} />
              <Route path="announcements" element={<PermissionRoute module="hr"><HrAnnouncementsPage /></PermissionRoute>} />
              <Route path="payroll" element={<PermissionRoute module="hr"><HrPayrollPage /></PermissionRoute>} />
              <Route path="salary-structure" element={<PermissionRoute module="hr"><HrSalaryStructurePage /></PermissionRoute>} />
              <Route path="incentives" element={<PermissionRoute module="hr"><HrIncentivesPage /></PermissionRoute>} />
              <Route path="performance" element={<PermissionRoute module="hr"><HrPerformancePage /></PermissionRoute>} />
              <Route path="recruitment" element={<PermissionRoute module="hr"><HrRecruitmentPage /></PermissionRoute>} />
              <Route path="job-openings" element={<PermissionRoute module="hr"><HrJobOpeningsPage /></PermissionRoute>} />
              <Route path="interviews" element={<PermissionRoute module="hr"><HrInterviewsPage /></PermissionRoute>} />
              <Route path="assets" element={<PermissionRoute module="hr"><HrAssetsPage /></PermissionRoute>} />
              <Route path="documents" element={<PermissionRoute module="hr"><HrDocumentsPage /></PermissionRoute>} />
              <Route path="expenses" element={<PermissionRoute module="hr"><HrExpensesPage /></PermissionRoute>} />
              <Route path="events" element={<PermissionRoute module="hr"><HrEventsPage /></PermissionRoute>} />
              <Route path="training" element={<PermissionRoute module="hr"><HrTrainingPage /></PermissionRoute>} />
              <Route path="exit" element={<PermissionRoute module="hr"><HrExitPage /></PermissionRoute>} />
              <Route path="reports" element={<PermissionRoute module="hr"><HrReportsPage /></PermissionRoute>} />
              <Route path="settings" element={<PermissionRoute module="hr"><HrSettingsPage /></PermissionRoute>} />
              <Route path="profile" element={<ComingSoon title="My Profile" description="HR profile settings" />} />
            </Route>

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<RoleDashboardRedirect />} />
              <Route path="admin/dashboard" element={<RoleRoute roles={['admin']}><Dashboard /></RoleRoute>} />
              <Route path="accountant/dashboard" element={<RoleRoute roles={['accountant']}><RoleDashboard roleKey="accountant" description="Financial reports and quotation approvals" /></RoleRoute>} />
              <Route path="operations/dashboard" element={<RoleRoute roles={['operations_manager']}><RoleDashboard roleKey="operations_manager" description="Packages, inventory, and operations" /></RoleRoute>} />
              <Route path="leads" element={<PermissionRoute module="leads"><Leads /></PermissionRoute>} />
              <Route path="leads/inbox/new" element={<PermissionRoute module="leads"><Leads /></PermissionRoute>} />
              <Route path="leads/new-leads" element={<PermissionRoute module="leads"><Leads /></PermissionRoute>} />
              <Route path="leads/returned" element={<PermissionRoute module="leads"><Leads /></PermissionRoute>} />
              <Route path="leads/hot" element={<PermissionRoute module="leads"><Leads /></PermissionRoute>} />
              <Route path="leads/unassigned" element={<PermissionRoute module="leads"><Leads /></PermissionRoute>} />
              <Route path="leads/assigned" element={<PermissionRoute module="leads"><Leads /></PermissionRoute>} />
              <Route path="leads/converted" element={<PermissionRoute module="leads"><Leads /></PermissionRoute>} />
              <Route path="leads/lost" element={<PermissionRoute module="leads"><Leads /></PermissionRoute>} />
              <Route path="leads/reactivated" element={<PermissionRoute module="leads"><ReactivatedLeadsPage /></PermissionRoute>} />
              <Route path="leads/analytics" element={<PermissionRoute module="leads"><LeadAnalytics /></PermissionRoute>} />
              <Route path="leads/sla" element={<PermissionRoute module="leads"><SlaMonitor /></PermissionRoute>} />
              <Route path="leads/recycle-bin" element={<PermissionRoute module="leads"><RecycleBin /></PermissionRoute>} />
              <Route path="leads/audit-log" element={<RoleRoute roles={['admin', 'sales_manager']}><LeadAuditLog /></RoleRoute>} />
              <Route path="leads/new" element={<PermissionRoute module="leads" action="create"><LeadForm /></PermissionRoute>} />
              <Route path="leads/:id/edit" element={<PermissionRoute module="leads" action="edit"><LeadForm /></PermissionRoute>} />
              <Route path="leads/:id" element={<PermissionRoute module="leads"><LeadDetail /></PermissionRoute>} />
              <Route path="followups" element={<PermissionRoute module="leads"><Followups /></PermissionRoute>} />
              <Route path="reminders" element={<PermissionRoute module="leads"><Reminders /></PermissionRoute>} />
              <Route path="whatsapp" element={<PermissionRoute module="leads"><WhatsAppLeads /></PermissionRoute>} />
              <Route path="email-activity" element={<PermissionRoute module="email" action="send"><EmailActivityPage /></PermissionRoute>} />
              <Route path="customers" element={<PermissionRoute module="customers"><ComingSoon title="Customers" description="Repeat customers and relationship management" /></PermissionRoute>} />
              <Route path="quotations/*" element={<PermissionRoute module="quotations"><Quotations /></PermissionRoute>} />
              <Route path="packages" element={<PermissionRoute module="packages"><Packages /></PermissionRoute>} />
              <Route path="team/attendance" element={<RoleRoute roles={['admin']}><AdminAttendancePage /></RoleRoute>} />
              <Route path="team/sales-teams" element={<RoleRoute roles={['admin']}><TeamManagementPage /></RoleRoute>} />
              <Route path="team/sales-teams/:id" element={<RoleRoute roles={['admin']}><TeamDetailPage /></RoleRoute>} />
              <Route path="team/sales-targets" element={<Navigate to="/team?tab=performance" replace />} />
              <Route path="team/destination-assignment" element={<RoleRoute roles={['admin', 'sales_manager']}><DestinationAssignmentPage /></RoleRoute>} />
              <Route path="team/skill-assignment" element={<RoleRoute roles={['admin', 'sales_manager']}><SkillAssignmentPage /></RoleRoute>} />
              <Route path="team" element={<PermissionRoute module="users"><Team /></PermissionRoute>} />
              <Route path="team/users/:id" element={<PermissionRoute module="users"><TeamUserProfile /></PermissionRoute>} />
              <Route path="reports" element={<PermissionRoute module="reports"><Reports /></PermissionRoute>} />
              <Route path="payments" element={<RoleRoute roles={['admin', 'accountant']}><PaymentsPage /></RoleRoute>} />
              <Route path="invoices" element={<RoleRoute roles={['admin', 'accountant']}><InvoicesPage /></RoleRoute>} />
              <Route path="refunds" element={<RoleRoute roles={['admin', 'accountant']}><RefundsPage /></RoleRoute>} />
              <Route path="calendar" element={<ComingSoon title="Calendar" description="Travel dates, follow-ups, and team schedule" />} />
              <Route path="notifications" element={<PermissionRoute module="leads"><Notifications /></PermissionRoute>} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/whatsapp-templates" element={<PermissionRoute module="whatsapp" action="manage"><WhatsAppTemplatesPage /></PermissionRoute>} />
              <Route path="settings/email-templates" element={<PermissionRoute module="email" action="manage"><EmailTemplatesPage /></PermissionRoute>} />
              <Route path="settings/announcements" element={<RoleRoute roles={['admin']}><AnnouncementsPage /></RoleRoute>} />
              <Route path="profile" element={<ComingSoon title="My Profile" description="Personal settings and performance" />} />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </NotificationProvider>
        </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
