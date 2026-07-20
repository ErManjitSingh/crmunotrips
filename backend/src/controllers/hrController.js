const asyncHandler = require('../utils/asyncHandler');
const hr = require('../services/hrService');
const hr2 = require('../services/hrPhase2Service');

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
};
