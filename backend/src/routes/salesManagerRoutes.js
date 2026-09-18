const express = require('express');
const router = express.Router();
const {
  getDashboard,
  listLeads,
  getListKpis,
  getLeadDetail,
  getLeadQuotationsList,
  getLeadNotesList,
  assignLeads,
  listExecutives,
  listFollowUps,
  listQuotations,
  createQuotation,
  updateQuotation,
  listNotifications,
  getReports,
  getCalendar,
} = require('../controllers/salesManagerController');
const {
  getTimeline,
  getSummary,
  getTeamOverviewHandler,
  getAnalyticsHandler,
  getHourDetail,
} = require('../controllers/callReportController');
const {
  getTimeline: getActivityTimeline,
  getSummary: getActivitySummary,
  getModuleUsageHandler,
  getTeamOverviewHandler: getActivityTeamOverviewHandler,
  getAnalyticsHandler: getActivityAnalyticsHandler,
  getLoginSessionsHandler,
} = require('../controllers/executiveActivityController');
const {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  listTeamLeaders,
  listAvailableExecutives,
  addMember,
  removeMember,
  transferMember,
  updateTeamLeader,
} = require('../controllers/teamController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(protect);

const managerOnly = authorize('sales_manager', 'admin');
const teamAccess = authorize('sales_manager', 'admin', 'lead_provider');
/**
 * Call Report / Executive Activity endpoints that take an `executiveId` — also open to
 * sales_executive so they can view the same report for themselves. Each handler derives the
 * scoped id server-side via resolveScopedExecutiveId(), which always overrides `executiveId` with
 * the authenticated user's own id for that role, so this does not grant access to anyone else's
 * data. Team-overview endpoints (no per-executive scoping) intentionally stay `managerOnly`.
 */
const managerOrExecutiveSelf = authorize('sales_manager', 'admin', 'sales_executive');

router.get('/dashboard', managerOnly, getDashboard);
router.get('/leads', managerOnly, listLeads);
router.get('/leads/list-kpis', managerOnly, getListKpis);
router.get('/leads/:id/quotations', managerOnly, getLeadQuotationsList);
router.get('/leads/:id/notes-list', managerOnly, getLeadNotesList);
router.get('/leads/:id', managerOnly, getLeadDetail);
router.post('/assign', managerOnly, assignLeads);
router.get('/executives', teamAccess, listExecutives);
router.get('/followups', managerOnly, listFollowUps);
router.get('/quotations/:segment?', managerOnly, listQuotations);
router.post('/quotations', managerOnly, createQuotation);
router.put('/quotations/:id', managerOnly, updateQuotation);
router.get('/notifications', managerOnly, listNotifications);
router.get('/reports', managerOnly, getReports);
router.get('/calendar', managerOnly, getCalendar);

router.get('/call-report/timeline', managerOrExecutiveSelf, getTimeline);
router.get('/call-report/summary', managerOrExecutiveSelf, getSummary);
router.get('/call-report/team-overview', managerOnly, getTeamOverviewHandler);
router.get('/call-report/analytics', managerOrExecutiveSelf, getAnalyticsHandler);
router.get('/call-report/hour-detail', managerOrExecutiveSelf, getHourDetail);

router.get('/call-report/activity/timeline', managerOrExecutiveSelf, getActivityTimeline);
router.get('/call-report/activity/summary', managerOrExecutiveSelf, getActivitySummary);
router.get('/call-report/activity/module-usage', managerOrExecutiveSelf, getModuleUsageHandler);
router.get('/call-report/activity/team-overview', managerOnly, getActivityTeamOverviewHandler);
router.get('/call-report/activity/analytics', managerOrExecutiveSelf, getActivityAnalyticsHandler);
router.get('/call-report/activity/login-sessions', managerOrExecutiveSelf, getLoginSessionsHandler);

router.get('/teams/leaders', teamAccess, listTeamLeaders);
router.get('/teams/available-executives', teamAccess, listAvailableExecutives);
router.post('/teams/:id/members', teamAccess, addMember);
router.delete('/teams/:id/members/:memberId', teamAccess, removeMember);
router.put('/teams/:id/transfer', teamAccess, transferMember);
router.put('/teams/:id/leader', teamAccess, updateTeamLeader);
router.get('/teams', teamAccess, listTeams);
router.post('/teams', managerOnly, createTeam);
router.get('/teams/:id', teamAccess, getTeam);
router.put('/teams/:id', teamAccess, updateTeam);
router.delete('/teams/:id', teamAccess, deleteTeam);

module.exports = router;
