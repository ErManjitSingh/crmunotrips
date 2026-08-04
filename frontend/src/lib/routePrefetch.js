const prefetched = new Set();

const routeLoaders = {
  "/dashboard": () => import("../pages/Dashboard"),
  "/admin/dashboard": () => import("../pages/Dashboard"),
  "/lead-provider/dashboard": () => import("../pages/Dashboard"),
  "/leads": () => import("../pages/Leads"),
  "/leads/new-leads": () => import("../pages/Leads"),
  "/leads/unassigned": () => import("../pages/Leads"),
  "/leads/assigned": () => import("../pages/Leads"),
  "/leads/converted": () => import("../pages/Leads"),
  "/leads/lost": () => import("../pages/Leads"),
  "/followups": () => import("../pages/Followups"),
  "/quotations": () => import("../pages/Quotations"),
  "/reports": () => import("../pages/Reports"),
  "/packages": () => import("../pages/Packages"),
  "/payments": () => import("../components/payments/PaymentsPage"),
  "/sales-manager/dashboard": () =>
    import("../components/sales-manager/ManagerDashboard"),
  "/sales-manager/leads": () =>
    import("../components/sales-manager/TeamLeadsPage"),
  "/sales-manager/follow-ups": () =>
    import("../components/sales-manager/FollowUpMonitoringPage"),
  "/sales-manager/quotations": () =>
    import("../components/sales-manager/QuotationApprovalPage"),
  "/sales-executive/dashboard": () =>
    import("../components/sales-executive/ExecutiveDashboard"),
  "/sales-executive/leads": () =>
    import("../components/sales-executive/MyLeadsPage"),
  "/sales-executive/follow-ups": () =>
    import("../components/sales-executive/ExecutiveFollowUpsPage"),
  "/sales-executive/quotations": () =>
    import("../components/sales-executive/ExecutiveQuotationsPage"),
  "/sales-executive/customers": () =>
    import("../components/sales-executive/ExecutiveCustomersPage"),
  "/sales-executive/calendar": () =>
    import("../components/sales-executive/ExecutiveCalendarPage"),
  "/team-leader/dashboard": () =>
    import("../components/team-leader/LeaderDashboard"),
  "/team-leader/leads": () =>
    import("../components/team-leader/LeaderTeamLeadsPage"),
  "/team-leader/follow-ups": () =>
    import("../components/team-leader/LeaderFollowUpsPage"),
  "/team-leader/quotations": () =>
    import("../components/team-leader/LeaderQuotationsPage"),
  "/operations-manager/dashboard": () =>
    import("../components/operations-manager/OperationsDashboard"),
  "/operations-manager/bookings": () =>
    import("../components/operations-manager/bookings/BookingsListPage"),
  "/operations-manager/hotels": () =>
    import("../components/operations-manager/hotels/OperationsHotelsPage"),
};

function resolveLoader(path) {
  if (!path) return null;
  if (routeLoaders[path]) return routeLoaders[path];
  const match = Object.keys(routeLoaders)
    .filter((key) => path.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return match ? routeLoaders[match] : null;
}

export function prefetchRoute(path) {
  const loader = resolveLoader(path);
  if (!loader || prefetched.has(path)) return;
  prefetched.add(path);
  loader().catch(() => prefetched.delete(path));
}
