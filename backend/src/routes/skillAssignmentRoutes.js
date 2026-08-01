const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  listSkills,
  listUserSkills,
  updateUserSkills,
  getBranchSkillSettings,
  updateBranchSkillSettings,
  listSkillAssignmentLogs,
  getReports,
  detectLeadTypePreview,
  triggerSkillAutoAssign,
} = require('../controllers/skillAssignmentController');

router.use(protect);

router.get('/skills', authorize('admin', 'sales_manager', 'lead_provider'), listSkills);
router.get('/user-skills', authorize('admin', 'sales_manager', 'lead_provider'), listUserSkills);
router.put('/user-skills', authorize('admin', 'sales_manager', 'lead_provider'), updateUserSkills);

router.get('/branch-settings', authorize('admin', 'sales_manager', 'lead_provider'), getBranchSkillSettings);
router.put('/branch-settings', authorize('admin', 'sales_manager', 'lead_provider'), updateBranchSkillSettings);

router.get('/logs', authorize('admin', 'sales_manager', 'lead_provider'), listSkillAssignmentLogs);
router.get('/reports', authorize('admin', 'sales_manager', 'lead_provider'), getReports);
router.post('/detect-lead-type', authorize('admin', 'sales_manager', 'team_leader', 'lead_provider'), detectLeadTypePreview);
router.post('/auto-assign/:leadId', authorize('admin', 'sales_manager', 'lead_provider'), triggerSkillAutoAssign);

module.exports = router;
