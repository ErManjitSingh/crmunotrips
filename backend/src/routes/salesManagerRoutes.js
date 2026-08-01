const express = require('express');
const router = express.Router();
const {
  getDashboard,
  listLeads,
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

router.get('/dashboard', managerOnly, getDashboard);
router.get('/leads', managerOnly, listLeads);
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
