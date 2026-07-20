const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { requirePermission } = require('../middleware/requirePermission');
const ctrl = require('../controllers/hrController');

const router = express.Router();

router.use(protect);
router.use(authorize('hr_admin'));
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

router.get('/performance', ctrl.listPerformance);
router.post('/performance', requirePermission('hr', 'create'), ctrl.createPerformance);
router.put('/performance/:id', requirePermission('hr', 'edit'), ctrl.updatePerformance);
router.delete('/performance/:id', requirePermission('hr', 'delete'), ctrl.deletePerformance);

router.get('/jobs', ctrl.listJobs);
router.post('/jobs', requirePermission('hr', 'create'), ctrl.createJob);
router.put('/jobs/:id', requirePermission('hr', 'edit'), ctrl.updateJob);
router.delete('/jobs/:id', requirePermission('hr', 'delete'), ctrl.deleteJob);

router.get('/candidates', ctrl.listCandidates);
router.get('/candidates/funnel', ctrl.recruitmentFunnel);
router.post('/candidates', requirePermission('hr', 'create'), ctrl.createCandidate);
router.put('/candidates/:id', requirePermission('hr', 'edit'), ctrl.updateCandidate);
router.delete('/candidates/:id', requirePermission('hr', 'delete'), ctrl.deleteCandidate);

router.get('/interviews', ctrl.listInterviews);
router.post('/interviews', requirePermission('hr', 'create'), ctrl.createInterview);
router.put('/interviews/:id', requirePermission('hr', 'edit'), ctrl.updateInterview);
router.delete('/interviews/:id', requirePermission('hr', 'delete'), ctrl.deleteInterview);

router.get('/incentives', ctrl.listIncentives);
router.post('/incentives', requirePermission('hr', 'create'), ctrl.createIncentive);
router.patch('/incentives/:id/review', requirePermission('hr', 'edit'), ctrl.reviewIncentive);
router.delete('/incentives/:id', requirePermission('hr', 'delete'), ctrl.deleteIncentive);

router.get('/events', ctrl.listEvents);
router.post('/events', requirePermission('hr', 'create'), ctrl.createEvent);
router.put('/events/:id', requirePermission('hr', 'edit'), ctrl.updateEvent);
router.delete('/events/:id', requirePermission('hr', 'delete'), ctrl.deleteEvent);

router.get('/training/courses', ctrl.listCourses);
router.post('/training/courses', requirePermission('hr', 'create'), ctrl.createCourse);
router.delete('/training/courses/:id', requirePermission('hr', 'delete'), ctrl.deleteCourse);
router.get('/training/enrollments', ctrl.listEnrollments);
router.post('/training/enrollments', requirePermission('hr', 'create'), ctrl.enrollEmployee);
router.patch('/training/enrollments/:id', requirePermission('hr', 'edit'), ctrl.updateEnrollment);

router.get('/exits', ctrl.listExits);
router.post('/exits', requirePermission('hr', 'create'), ctrl.createExit);
router.put('/exits/:id', requirePermission('hr', 'edit'), ctrl.updateExit);
router.delete('/exits/:id', requirePermission('hr', 'delete'), ctrl.deleteExit);

router.get('/settings', ctrl.getSettings);
router.put('/settings', requirePermission('hr', 'edit'), ctrl.updateSettings);

router.get('/reports', ctrl.getReports);

module.exports = router;
