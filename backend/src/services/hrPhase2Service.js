const HrEmployee = require('../models/hr/HrEmployee');
const HrSalaryStructure = require('../models/hr/HrSalaryStructure');
const HrPayrollRun = require('../models/hr/HrPayrollRun');
const HrDocument = require('../models/hr/HrDocument');
const HrAsset = require('../models/hr/HrAsset');
const HrExpense = require('../models/hr/HrExpense');
const ApiError = require('../utils/apiError');

const EMP_POP = [
  { path: 'departmentId', select: 'name' },
  { path: 'designationId', select: 'name' },
];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function defaultComponents(ctc) {
  const basic = round2(ctc * 0.5);
  const hra = round2(ctc * 0.4);
  const special = round2(ctc - basic - hra);
  const pf = round2(basic * 0.12);
  return {
    components: [
      { key: 'basic', label: 'Basic', type: 'earning', amount: basic },
      { key: 'hra', label: 'HRA', type: 'earning', amount: hra },
      { key: 'special', label: 'Special Allowance', type: 'earning', amount: special },
      { key: 'pf', label: 'PF', type: 'deduction', amount: pf },
    ],
    basic,
    allowances: round2(hra + special),
    bonuses: 0,
    incentives: 0,
    deductions: pf,
    tax: 0,
    pf,
    esic: 0,
    advance: 0,
    loans: 0,
    gross: round2(basic + hra + special),
    net: round2(basic + hra + special - pf),
  };
}

function applyStructure(ctc, structure) {
  if (!structure?.components?.length) return defaultComponents(ctc);
  const baseMap = { ctc: ctc, basic: round2(ctc * 0.5) };
  const components = [];
  let earnings = 0;
  let deductions = 0;
  let basic = 0;
  let allowances = 0;
  let pf = 0;
  let esic = 0;
  let tax = 0;

  for (const c of structure.components) {
    let amount = 0;
    if (c.calcType === 'percent') {
      const base = baseMap[c.percentOf] ?? baseMap.basic;
      amount = round2((base * (Number(c.amount) || 0)) / 100);
    } else {
      amount = round2(c.amount);
    }
    if (c.key === 'basic') {
      basic = amount;
      baseMap.basic = amount;
    }
    components.push({ key: c.key, label: c.label, type: c.type, amount });
    if (c.type === 'earning') {
      earnings += amount;
      if (c.key !== 'basic') allowances += amount;
    } else {
      deductions += amount;
      if (c.key === 'pf') pf = amount;
      if (c.key === 'esic') esic = amount;
      if (c.key === 'tax') tax = amount;
    }
  }

  if (!basic && earnings) {
    basic = round2(earnings * 0.5);
  }

  return {
    components,
    basic,
    allowances: round2(allowances),
    bonuses: 0,
    incentives: 0,
    deductions: round2(deductions),
    tax,
    pf,
    esic,
    advance: 0,
    loans: 0,
    gross: round2(earnings),
    net: round2(earnings - deductions),
  };
}

/* ─── Salary structures ─── */
async function listSalaryStructures() {
  return HrSalaryStructure.find({ isDeleted: { $ne: true } }).sort({ isDefault: -1, name: 1 }).lean();
}

async function createSalaryStructure(body) {
  if (!body?.name?.trim()) throw new ApiError(400, 'Name is required');
  if (body.isDefault) {
    await HrSalaryStructure.updateMany({ isDeleted: { $ne: true } }, { $set: { isDefault: false } });
  }
  return HrSalaryStructure.create({
    name: body.name.trim(),
    code: body.code || '',
    description: body.description || '',
    components: body.components || [],
    isDefault: Boolean(body.isDefault),
    status: body.status || 'active',
  });
}

async function updateSalaryStructure(id, body) {
  const row = await HrSalaryStructure.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Salary structure not found');
  if (body.isDefault) {
    await HrSalaryStructure.updateMany(
      { _id: { $ne: id }, isDeleted: { $ne: true } },
      { $set: { isDefault: false } }
    );
  }
  ['name', 'code', 'description', 'components', 'isDefault', 'status'].forEach((k) => {
    if (body[k] !== undefined) row[k] = body[k];
  });
  await row.save();
  return row;
}

async function deleteSalaryStructure(id) {
  const row = await HrSalaryStructure.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, status: 'inactive' } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Salary structure not found');
  return { success: true };
}

/* ─── Payroll ─── */
async function listPayrollRuns(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.year) filter.year = Number(query.year);
  if (query.status) filter.status = query.status;
  return HrPayrollRun.find(filter).sort({ year: -1, month: -1 }).lean();
}

async function getPayrollRun(id) {
  const row = await HrPayrollRun.findOne({ _id: id, isDeleted: { $ne: true } }).lean();
  if (!row) throw new ApiError(404, 'Payroll run not found');
  return row;
}

async function createPayrollRun(body, user) {
  const month = Number(body.month);
  const year = Number(body.year);
  if (!month || !year) throw new ApiError(400, 'Month and year are required');

  const existing = await HrPayrollRun.findOne({
    month,
    year,
    isDeleted: { $ne: true },
    status: { $in: ['draft', 'processing', 'processed', 'paid'] },
  });
  if (existing) throw new ApiError(409, `Payroll for ${month}/${year} already exists`);

  const structure =
    (await HrSalaryStructure.findOne({ isDeleted: { $ne: true }, isDefault: true, status: 'active' }).lean()) ||
    (await HrSalaryStructure.findOne({ isDeleted: { $ne: true }, status: 'active' }).sort({ createdAt: 1 }).lean());

  const employees = await HrEmployee.find({ isDeleted: { $ne: true }, status: 'active' })
    .populate(EMP_POP)
    .lean({ virtuals: true });

  const slips = employees.map((emp) => {
    const ctc = Number(emp.salary) || 0;
    const calc = applyStructure(ctc, structure);
    return {
      employeeId: emp._id,
      employeeCode: emp.employeeCode || '',
      name: [emp.firstName, emp.lastName].filter(Boolean).join(' '),
      department: emp.departmentId?.name || '',
      designation: emp.designationId?.name || '',
      ...calc,
    };
  });

  const totals = slips.reduce(
    (acc, s) => {
      acc.employees += 1;
      acc.gross += s.gross;
      acc.deductions += s.deductions;
      acc.net += s.net;
      return acc;
    },
    { employees: 0, gross: 0, deductions: 0, net: 0 }
  );
  totals.gross = round2(totals.gross);
  totals.deductions = round2(totals.deductions);
  totals.net = round2(totals.net);

  return HrPayrollRun.create({
    month,
    year,
    status: 'draft',
    slips,
    totals,
    notes: body.notes || '',
    processedBy: user?._id || null,
  });
}

async function updatePayrollStatus(id, body, user) {
  const row = await HrPayrollRun.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Payroll run not found');
  const next = body.status;
  if (!['draft', 'processing', 'processed', 'paid'].includes(next)) {
    throw new ApiError(400, 'Invalid status');
  }
  row.status = next;
  if (next === 'processed' || next === 'paid') {
    row.processedAt = new Date();
    row.processedBy = user?._id || row.processedBy;
  }
  await row.save();
  return row;
}

async function deletePayrollRun(id) {
  const row = await HrPayrollRun.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true }, status: { $in: ['draft', 'processing'] } },
    { $set: { isDeleted: true } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Draft payroll not found or already processed');
  return { success: true };
}

async function countPendingPayroll() {
  return HrPayrollRun.countDocuments({
    isDeleted: { $ne: true },
    status: { $in: ['draft', 'processing'] },
  });
}

/* ─── Documents ─── */
async function listDocuments(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.employeeId) filter.employeeId = query.employeeId;
  if (query.docType) filter.docType = query.docType;
  if (query.expiringSoon === 'true') {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    filter.expiryDate = { $gte: now, $lte: in30 };
  }
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 40));
  const [rows, total] = await Promise.all([
    HrDocument.find(filter)
      .populate({ path: 'employeeId', select: 'firstName lastName employeeCode' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    HrDocument.countDocuments(filter),
  ]);
  return { rows, total, page, limit };
}

async function createDocument(body, user) {
  if (!body?.employeeId || !body?.title?.trim()) throw new ApiError(400, 'Employee and title required');
  const emp = await HrEmployee.findOne({ _id: body.employeeId, isDeleted: { $ne: true } });
  if (!emp) throw new ApiError(404, 'Employee not found');
  return HrDocument.create({
    employeeId: body.employeeId,
    docType: body.docType || 'other',
    title: body.title.trim(),
    fileUrl: body.fileUrl || '',
    fileName: body.fileName || '',
    expiryDate: body.expiryDate || null,
    notes: body.notes || '',
    uploadedBy: user?._id || null,
  });
}

async function deleteDocument(id) {
  const row = await HrDocument.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Document not found');
  return { success: true };
}

/* ─── Assets ─── */
async function listAssets(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.search) {
    const q = String(query.search).trim();
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { assetCode: { $regex: q, $options: 'i' } },
      { serialNumber: { $regex: q, $options: 'i' } },
    ];
  }
  return HrAsset.find(filter)
    .populate({ path: 'assignedTo', select: 'firstName lastName employeeCode' })
    .sort({ createdAt: -1 })
    .lean();
}

async function createAsset(body) {
  if (!body?.name?.trim()) throw new ApiError(400, 'Asset name is required');
  return HrAsset.create({
    name: body.name.trim(),
    category: body.category || 'other',
    serialNumber: body.serialNumber || '',
    brand: body.brand || '',
    purchaseDate: body.purchaseDate || null,
    purchaseValue: Number(body.purchaseValue) || 0,
    notes: body.notes || '',
    status: 'available',
  });
}

async function assignAsset(id, body, user) {
  const asset = await HrAsset.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!asset) throw new ApiError(404, 'Asset not found');
  if (!body?.employeeId) throw new ApiError(400, 'Employee is required');
  const emp = await HrEmployee.findOne({ _id: body.employeeId, isDeleted: { $ne: true } });
  if (!emp) throw new ApiError(404, 'Employee not found');
  asset.assignedTo = emp._id;
  asset.assignedAt = new Date();
  asset.status = 'assigned';
  asset.history.push({
    action: 'assigned',
    employeeId: emp._id,
    note: body.note || '',
    by: user?._id || null,
  });
  await asset.save();
  return asset.populate({ path: 'assignedTo', select: 'firstName lastName employeeCode' });
}

async function returnAsset(id, body, user) {
  const asset = await HrAsset.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!asset) throw new ApiError(404, 'Asset not found');
  const prev = asset.assignedTo;
  asset.history.push({
    action: body?.lost ? 'lost' : 'returned',
    employeeId: prev,
    note: body?.note || '',
    by: user?._id || null,
  });
  asset.assignedTo = null;
  asset.assignedAt = null;
  asset.status = body?.lost ? 'lost' : 'available';
  await asset.save();
  return asset;
}

async function deleteAsset(id) {
  const row = await HrAsset.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Asset not found');
  return { success: true };
}

/* ─── Expenses ─── */
async function listExpenses(query = {}) {
  const filter = { isDeleted: { $ne: true } };
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.employeeId) filter.employeeId = query.employeeId;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 40));
  const [rows, total] = await Promise.all([
    HrExpense.find(filter)
      .populate({ path: 'employeeId', select: 'firstName lastName employeeCode' })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    HrExpense.countDocuments(filter),
  ]);
  return { rows, total, page, limit };
}

async function createExpense(body, user) {
  if (!body?.employeeId || !body?.title?.trim() || body.amount == null || !body.expenseDate) {
    throw new ApiError(400, 'Employee, title, amount and date are required');
  }
  return HrExpense.create({
    employeeId: body.employeeId,
    category: body.category || 'other',
    title: body.title.trim(),
    amount: Number(body.amount) || 0,
    expenseDate: body.expenseDate,
    description: body.description || '',
    receiptUrl: body.receiptUrl || '',
    createdBy: user?._id || null,
  });
}

async function reviewExpense(id, body, user) {
  const row = await HrExpense.findOne({ _id: id, isDeleted: { $ne: true } });
  if (!row) throw new ApiError(404, 'Expense not found');
  if (!['approved', 'rejected', 'reimbursed'].includes(body.status)) {
    throw new ApiError(400, 'Invalid status');
  }
  row.status = body.status;
  row.comments = body.comments || row.comments;
  row.reviewedBy = user?._id || null;
  row.reviewedAt = new Date();
  await row.save();
  return row.populate({ path: 'employeeId', select: 'firstName lastName employeeCode' });
}

async function deleteExpense(id) {
  const row = await HrExpense.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true }, status: 'pending' },
    { $set: { isDeleted: true } },
    { new: true }
  );
  if (!row) throw new ApiError(404, 'Pending expense not found');
  return { success: true };
}

module.exports = {
  listSalaryStructures,
  createSalaryStructure,
  updateSalaryStructure,
  deleteSalaryStructure,
  listPayrollRuns,
  getPayrollRun,
  createPayrollRun,
  updatePayrollStatus,
  deletePayrollRun,
  countPendingPayroll,
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
