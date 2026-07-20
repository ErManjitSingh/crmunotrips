const asyncHandler = require('../utils/asyncHandler');
const hr = require('../services/hrService');
const hr2 = require('../services/hrPhase2Service');
const talent = require('../services/hrTalentService');
const p4 = require('../services/hrPhase4Service');

const getDashboard = asyncHandler(async (req, res) => {
  const data = await hr.getHrDashboard();
  res.json(data);
});

const listEmployees = asyncHandler(async (req, res) => {
  const data = await hr.listEmployees(req.query);
  res.json(data);
});

const getEmployee = asyncHandler(async (req, res) => {
  const data = await hr.getEmployee(req.params.id);
  res.json(data);
});

const createEmployee = asyncHandler(async (req, res) => {
  const data = await hr.createEmployee(req.body, req.user);
  res.status(201).json(data);
});

const updateEmployee = asyncHandler(async (req, res) => {
  const data = await hr.updateEmployee(req.params.id, req.body);
  res.json(data);
});

const deleteEmployee = asyncHandler(async (req, res) => {
  const data = await hr.deleteEmployee(req.params.id);
  res.json(data);
});

const listDepartments = asyncHandler(async (req, res) => {
  res.json(await hr.listDepartments());
});

const createDepartment = asyncHandler(async (req, res) => {
  res.status(201).json(await hr.createDepartment(req.body));
});

const updateDepartment = asyncHandler(async (req, res) => {
  res.json(await hr.updateDepartment(req.params.id, req.body));
});

const deleteDepartment = asyncHandler(async (req, res) => {
  res.json(await hr.deleteDepartment(req.params.id));
});

const listDesignations = asyncHandler(async (req, res) => {
  res.json(await hr.listDesignations(req.query));
});

const createDesignation = asyncHandler(async (req, res) => {
  res.status(201).json(await hr.createDesignation(req.body));
});

const updateDesignation = asyncHandler(async (req, res) => {
  res.json(await hr.updateDesignation(req.params.id, req.body));
});

const deleteDesignation = asyncHandler(async (req, res) => {
  res.json(await hr.deleteDesignation(req.params.id));
});

const listHolidays = asyncHandler(async (req, res) => {
  res.json(await hr.listHolidays(req.query));
});

const createHoliday = asyncHandler(async (req, res) => {
  res.status(201).json(await hr.createHoliday(req.body));
});

const deleteHoliday = asyncHandler(async (req, res) => {
  res.json(await hr.deleteHoliday(req.params.id));
});

const listLeaves = asyncHandler(async (req, res) => {
  res.json(await hr.listLeaves(req.query));
});

const createLeave = asyncHandler(async (req, res) => {
  res.status(201).json(await hr.createLeave(req.body));
});

const reviewLeave = asyncHandler(async (req, res) => {
  res.json(await hr.reviewLeave(req.params.id, req.body, req.user));
});

const listSalaryStructures = asyncHandler(async (req, res) => {
  res.json(await hr2.listSalaryStructures());
});
const createSalaryStructure = asyncHandler(async (req, res) => {
  res.status(201).json(await hr2.createSalaryStructure(req.body));
});
const updateSalaryStructure = asyncHandler(async (req, res) => {
  res.json(await hr2.updateSalaryStructure(req.params.id, req.body));
});
const deleteSalaryStructure = asyncHandler(async (req, res) => {
  res.json(await hr2.deleteSalaryStructure(req.params.id));
});

const listPayrollRuns = asyncHandler(async (req, res) => {
  res.json(await hr2.listPayrollRuns(req.query));
});
const getPayrollRun = asyncHandler(async (req, res) => {
  res.json(await hr2.getPayrollRun(req.params.id));
});
const createPayrollRun = asyncHandler(async (req, res) => {
  res.status(201).json(await hr2.createPayrollRun(req.body, req.user));
});
const updatePayrollStatus = asyncHandler(async (req, res) => {
  res.json(await hr2.updatePayrollStatus(req.params.id, req.body, req.user));
});
const deletePayrollRun = asyncHandler(async (req, res) => {
  res.json(await hr2.deletePayrollRun(req.params.id));
});

const listDocuments = asyncHandler(async (req, res) => {
  res.json(await hr2.listDocuments(req.query));
});
const createDocument = asyncHandler(async (req, res) => {
  res.status(201).json(await hr2.createDocument(req.body, req.user));
});
const deleteDocument = asyncHandler(async (req, res) => {
  res.json(await hr2.deleteDocument(req.params.id));
});

const listAssets = asyncHandler(async (req, res) => {
  res.json(await hr2.listAssets(req.query));
});
const createAsset = asyncHandler(async (req, res) => {
  res.status(201).json(await hr2.createAsset(req.body));
});
const assignAsset = asyncHandler(async (req, res) => {
  res.json(await hr2.assignAsset(req.params.id, req.body, req.user));
});
const returnAsset = asyncHandler(async (req, res) => {
  res.json(await hr2.returnAsset(req.params.id, req.body, req.user));
});
const deleteAsset = asyncHandler(async (req, res) => {
  res.json(await hr2.deleteAsset(req.params.id));
});

const listExpenses = asyncHandler(async (req, res) => {
  res.json(await hr2.listExpenses(req.query));
});
const createExpense = asyncHandler(async (req, res) => {
  res.status(201).json(await hr2.createExpense(req.body, req.user));
});
const reviewExpense = asyncHandler(async (req, res) => {
  res.json(await hr2.reviewExpense(req.params.id, req.body, req.user));
});
const deleteExpense = asyncHandler(async (req, res) => {
  res.json(await hr2.deleteExpense(req.params.id));
});

const listPerformance = asyncHandler(async (req, res) => {
  res.json(await talent.listPerformance(req.query));
});
const createPerformance = asyncHandler(async (req, res) => {
  res.status(201).json(await talent.createPerformance(req.body, req.user));
});
const updatePerformance = asyncHandler(async (req, res) => {
  res.json(await talent.updatePerformance(req.params.id, req.body));
});
const deletePerformance = asyncHandler(async (req, res) => {
  res.json(await talent.deletePerformance(req.params.id));
});

const listJobs = asyncHandler(async (req, res) => {
  res.json(await talent.listJobs(req.query));
});
const createJob = asyncHandler(async (req, res) => {
  res.status(201).json(await talent.createJob(req.body, req.user));
});
const updateJob = asyncHandler(async (req, res) => {
  res.json(await talent.updateJob(req.params.id, req.body));
});
const deleteJob = asyncHandler(async (req, res) => {
  res.json(await talent.deleteJob(req.params.id));
});

const listCandidates = asyncHandler(async (req, res) => {
  res.json(await talent.listCandidates(req.query));
});
const createCandidate = asyncHandler(async (req, res) => {
  res.status(201).json(await talent.createCandidate(req.body));
});
const updateCandidate = asyncHandler(async (req, res) => {
  res.json(await talent.updateCandidate(req.params.id, req.body));
});
const deleteCandidate = asyncHandler(async (req, res) => {
  res.json(await talent.deleteCandidate(req.params.id));
});
const recruitmentFunnel = asyncHandler(async (req, res) => {
  res.json(await talent.recruitmentFunnel());
});

const listInterviews = asyncHandler(async (req, res) => {
  res.json(await talent.listInterviews(req.query));
});
const createInterview = asyncHandler(async (req, res) => {
  res.status(201).json(await talent.createInterview(req.body, req.user));
});
const updateInterview = asyncHandler(async (req, res) => {
  res.json(await talent.updateInterview(req.params.id, req.body));
});
const deleteInterview = asyncHandler(async (req, res) => {
  res.json(await talent.deleteInterview(req.params.id));
});

const listIncentives = asyncHandler(async (req, res) => {
  res.json(await talent.listIncentives(req.query));
});
const createIncentive = asyncHandler(async (req, res) => {
  res.status(201).json(await talent.createIncentive(req.body, req.user));
});
const reviewIncentive = asyncHandler(async (req, res) => {
  res.json(await talent.reviewIncentive(req.params.id, req.body, req.user));
});
const deleteIncentive = asyncHandler(async (req, res) => {
  res.json(await talent.deleteIncentive(req.params.id));
});

const listEvents = asyncHandler(async (req, res) => {
  res.json(await p4.listEvents(req.query));
});
const createEvent = asyncHandler(async (req, res) => {
  res.status(201).json(await p4.createEvent(req.body, req.user));
});
const updateEvent = asyncHandler(async (req, res) => {
  res.json(await p4.updateEvent(req.params.id, req.body));
});
const deleteEvent = asyncHandler(async (req, res) => {
  res.json(await p4.deleteEvent(req.params.id));
});

const listCourses = asyncHandler(async (req, res) => {
  res.json(await p4.listCourses(req.query));
});
const createCourse = asyncHandler(async (req, res) => {
  res.status(201).json(await p4.createCourse(req.body));
});
const deleteCourse = asyncHandler(async (req, res) => {
  res.json(await p4.deleteCourse(req.params.id));
});
const listEnrollments = asyncHandler(async (req, res) => {
  res.json(await p4.listEnrollments(req.query));
});
const enrollEmployee = asyncHandler(async (req, res) => {
  res.status(201).json(await p4.enrollEmployee(req.body));
});
const updateEnrollment = asyncHandler(async (req, res) => {
  res.json(await p4.updateEnrollment(req.params.id, req.body));
});

const listExits = asyncHandler(async (req, res) => {
  res.json(await p4.listExits(req.query));
});
const createExit = asyncHandler(async (req, res) => {
  res.status(201).json(await p4.createExit(req.body, req.user));
});
const updateExit = asyncHandler(async (req, res) => {
  res.json(await p4.updateExit(req.params.id, req.body));
});
const deleteExit = asyncHandler(async (req, res) => {
  res.json(await p4.deleteExit(req.params.id));
});

const getSettings = asyncHandler(async (req, res) => {
  res.json(await p4.getSettings());
});
const updateSettings = asyncHandler(async (req, res) => {
  res.json(await p4.updateSettings(req.body));
});

const getReports = asyncHandler(async (req, res) => {
  res.json(await p4.getReportsSummary());
});

module.exports = {
  getDashboard,
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  listDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
  listHolidays,
  createHoliday,
  deleteHoliday,
  listLeaves,
  createLeave,
  reviewLeave,
  listSalaryStructures,
  createSalaryStructure,
  updateSalaryStructure,
  deleteSalaryStructure,
  listPayrollRuns,
  getPayrollRun,
  createPayrollRun,
  updatePayrollStatus,
  deletePayrollRun,
  listDocuments,
  createDocument,
  deleteDocument,
  listAssets,
  createAsset,
  assignAsset,
  returnAsset,
  deleteAsset,
  listExpenses,
  createExpense,
  reviewExpense,
  deleteExpense,
  listPerformance,
  createPerformance,
  updatePerformance,
  deletePerformance,
  listJobs,
  createJob,
  updateJob,
  deleteJob,
  listCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  recruitmentFunnel,
  listInterviews,
  createInterview,
  updateInterview,
  deleteInterview,
  listIncentives,
  createIncentive,
  reviewIncentive,
  deleteIncentive,
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  listCourses,
  createCourse,
  deleteCourse,
  listEnrollments,
  enrollEmployee,
  updateEnrollment,
  listExits,
  createExit,
  updateExit,
  deleteExit,
  getSettings,
  updateSettings,
  getReports,
};
