const asyncHandler = require('../utils/asyncHandler');
const hr = require('../services/hrService');

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
};
