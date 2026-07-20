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

router.get('/salary-structures', ctrl.listSalaryStructures);
router.post('/salary-structures', requirePermission('hr', 'create'), ctrl.createSalaryStructure);
router.put('/salary-structures/:id', requirePermission('hr', 'edit'), ctrl.updateSalaryStructure);
router.delete('/salary-structures/:id', requirePermission('hr', 'delete'), ctrl.deleteSalaryStructure);

router.get('/payroll', ctrl.listPayrollRuns);
router.post('/payroll', requirePermission('hr', 'create'), ctrl.createPayrollRun);
router.get('/payroll/:id', ctrl.getPayrollRun);
router.patch('/payroll/:id/status', requirePermission('hr', 'edit'), ctrl.updatePayrollStatus);
router.delete('/payroll/:id', requirePermission('hr', 'delete'), ctrl.deletePayrollRun);

router.get('/documents', ctrl.listDocuments);
router.post('/documents', requirePermission('hr', 'create'), ctrl.createDocument);
router.delete('/documents/:id', requirePermission('hr', 'delete'), ctrl.deleteDocument);

router.get('/assets', ctrl.listAssets);
router.post('/assets', requirePermission('hr', 'create'), ctrl.createAsset);
router.post('/assets/:id/assign', requirePermission('hr', 'edit'), ctrl.assignAsset);
router.post('/assets/:id/return', requirePermission('hr', 'edit'), ctrl.returnAsset);
router.delete('/assets/:id', requirePermission('hr', 'delete'), ctrl.deleteAsset);

router.get('/expenses', ctrl.listExpenses);
router.post('/expenses', requirePermission('hr', 'create'), ctrl.createExpense);
router.patch('/expenses/:id/review', requirePermission('hr', 'edit'), ctrl.reviewExpense);
router.delete('/expenses/:id', requirePermission('hr', 'delete'), ctrl.deleteExpense);

module.exports = router;
