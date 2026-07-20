/**
 * Upsert HR Admin role + user on existing databases (no data wipe).
 * Run: node src/scripts/seedHrAdmin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Role = require('../models/Role');
const Branch = require('../models/Branch');
const { ROLE_PERMISSIONS } = require('../config/permissions');
const { ROLE_LABELS } = require('../config/roles');

const PASSWORD = process.env.SEED_PASSWORD || '123456';
const HR_EMAIL = 'hr@unotrips.com';

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
