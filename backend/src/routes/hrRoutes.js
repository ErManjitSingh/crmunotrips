const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { requirePermission } = require('../middleware/requirePermission');
const ctrl = require('../controllers/hrController');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));
router.use(requirePermission('hr', 'view'));

router.get('/dashboard', ctrl.getDashboard);

router.get('/employees', ctrl.listEmployees);
router.post('/employees', requirePermission('hr', 'create'), ctrl.createEmployee);
router.get('/employees/:id', ctrl.getEmployee);
router.put('/employees/:id', requirePermission('hr', 'edit'), ctrl.updateEmployee);
router.delete('/employees/:id', requirePermission('hr', 'delete'), ctrl.deleteEmployee);

router.get('/departments', ctrl.listDepartments);
router.post('/departments', requirePermission('hr', 'create'), ctrl.createDepartment);
router.put('/departments/:id', requirePermission('hr', 'edit'), ctrl.updateDepartment);
router.delete('/departments/:id', requirePermission('hr', 'delete'), ctrl.deleteDepartment);

router.get('/designations', ctrl.listDesignations);
router.post('/designations', requirePermission('hr', 'create'), ctrl.createDesignation);
router.put('/designations/:id', requirePermission('hr', 'edit'), ctrl.updateDesignation);
router.delete('/designations/:id', requirePermission('hr', 'delete'), ctrl.deleteDesignation);

router.get('/holidays', ctrl.listHolidays);
router.post('/holidays', requirePermission('hr', 'create'), ctrl.createHoliday);
router.delete('/holidays/:id', requirePermission('hr', 'delete'), ctrl.deleteHoliday);

router.get('/leaves', ctrl.listLeaves);
router.post('/leaves', requirePermission('hr', 'create'), ctrl.createLeave);
router.patch('/leaves/:id/review', requirePermission('hr', 'edit'), ctrl.reviewLeave);

module.exports = router;
