/**
 * Upsert HR Admin role + user + default departments on existing databases (no data wipe).
 * Run: node src/scripts/seedHrAdmin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Role = require('../models/Role');
const Branch = require('../models/Branch');
const HrDepartment = require('../models/hr/HrDepartment');
const HrDesignation = require('../models/hr/HrDesignation');
const { ROLE_PERMISSIONS } = require('../config/permissions');
const { ROLE_LABELS } = require('../config/roles');

const PASSWORD = process.env.SEED_PASSWORD || '123456';
const HR_EMAIL = 'hr@unotrips.com';

const DEFAULT_DEPARTMENTS = [
  { name: 'Sales', code: 'SALES' },
  { name: 'Accounts', code: 'ACCOUNTS' },
  { name: 'Operations', code: 'OPS' },
  { name: 'IT', code: 'IT' },
  { name: 'HR', code: 'HR' },
];

const DEFAULT_DESIGNATIONS = [
  { name: 'Sales Executive', code: 'SE', department: 'Sales', level: 1 },
  { name: 'Team Leader', code: 'TL', department: 'Sales', level: 2 },
  { name: 'Sales Manager', code: 'SM', department: 'Sales', level: 3 },
  { name: 'Accountant', code: 'ACC', department: 'Accounts', level: 1 },
  { name: 'Accounts Manager', code: 'AM', department: 'Accounts', level: 2 },
  { name: 'Operations Executive', code: 'OE', department: 'Operations', level: 1 },
  { name: 'Operations Manager', code: 'OM', department: 'Operations', level: 2 },
  { name: 'Software Engineer', code: 'SWE', department: 'IT', level: 1 },
  { name: 'IT Manager', code: 'ITM', department: 'IT', level: 2 },
  { name: 'HR Executive', code: 'HRE', department: 'HR', level: 1 },
  { name: 'HR Manager', code: 'HRM', department: 'HR', level: 2 },
];

async function seedDefaultDepartments() {
  const deptMap = {};
  for (const dept of DEFAULT_DEPARTMENTS) {
    let row = await HrDepartment.findOne({
      name: { $regex: new RegExp(`^${dept.name}$`, 'i') },
      isDeleted: { $ne: true },
    });
    if (row) {
      row.code = dept.code;
      row.status = 'active';
      await row.save();
    } else {
      row = await HrDepartment.create({
        name: dept.name,
        code: dept.code,
        status: 'active',
      });
    }
    deptMap[dept.name] = row._id;
  }
  console.log('Seeded departments:', DEFAULT_DEPARTMENTS.map((d) => d.name).join(', '));
  return deptMap;
}

async function seedDefaultDesignations(deptMap) {
  for (const d of DEFAULT_DESIGNATIONS) {
    const departmentId = deptMap[d.department] || null;
    const existing = await HrDesignation.findOne({
      name: { $regex: new RegExp(`^${d.name}$`, 'i') },
      isDeleted: { $ne: true },
    });
    if (existing) {
      existing.code = d.code;
      existing.level = d.level;
      existing.departmentId = departmentId;
      existing.status = 'active';
      await existing.save();
    } else {
      await HrDesignation.create({
        name: d.name,
        code: d.code,
        level: d.level,
        departmentId,
        status: 'active',
      });
    }
  }
  console.log('Seeded designations:', DEFAULT_DESIGNATIONS.length);
}

async function seedHrAdmin() {
  await connectDB();

  const adminRole = await Role.findOne({ slug: 'admin' });
  if (adminRole) {
    adminRole.permissions = ROLE_PERMISSIONS.admin;
    await adminRole.save();
    console.log('Updated admin role — HR permissions removed');
  }

  let hrRole = await Role.findOne({ slug: 'hr_admin' });
  if (hrRole) {
    hrRole.name = ROLE_LABELS.hr_admin;
    hrRole.permissions = ROLE_PERMISSIONS.hr_admin;
    hrRole.isSystem = true;
    await hrRole.save();
  } else {
    hrRole = await Role.create({
      name: ROLE_LABELS.hr_admin,
      slug: 'hr_admin',
      description: 'HR Management portal access',
      isSystem: true,
      permissions: ROLE_PERMISSIONS.hr_admin,
    });
    console.log('Created hr_admin role');
  }

  const branch = await Branch.findOne({ status: 'active' }).sort({ createdAt: 1 });
  let hrUser = await User.findOne({ email: HR_EMAIL });
  if (hrUser) {
    hrUser.role = 'hr_admin';
    hrUser.roleId = hrRole._id;
    hrUser.department = 'Human Resources';
    if (!hrUser.branchId && branch) hrUser.branchId = branch._id;
    await hrUser.save();
    console.log('Updated existing HR user:', HR_EMAIL);
  } else {
    hrUser = await User.create({
      name: 'HR Admin',
      email: HR_EMAIL,
      password: PASSWORD,
      role: 'hr_admin',
      roleId: hrRole._id,
      department: 'Human Resources',
      branchId: branch?._id,
    });
    console.log('Created HR user:', HR_EMAIL);
  }

  const deptMap = await seedDefaultDepartments();
  await seedDefaultDesignations(deptMap);

  console.log('\nHR Portal login:');
  console.log('  URL:', '/hr/login');
  console.log('  Email:', HR_EMAIL);
  console.log('  Password:', PASSWORD);

  await mongoose.disconnect();
}

seedHrAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
