/**
 * Upsert Lead Provider role + user (no data wipe).
 * Run: node src/scripts/seedLeadProvider.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const User = require('../models/User');
const Role = require('../models/Role');
const Branch = require('../models/Branch');
const { ROLE_PERMISSIONS } = require('../config/permissions');
const { ROLE_LABELS } = require('../config/roles');

const EMAIL = process.env.LEAD_PROVIDER_EMAIL || 'leads@unotrips.com';
const PASSWORD = process.env.LEAD_PROVIDER_PASSWORD || 'LeadGive@2026';
const NAME = process.env.LEAD_PROVIDER_NAME || 'Lead Provider';

async function run() {
  await connectDB();

  let role = await Role.findOne({ slug: 'lead_provider' });
  if (role) {
    role.name = ROLE_LABELS.lead_provider;
    role.permissions = ROLE_PERMISSIONS.lead_provider;
    role.isSystem = true;
    role.description = 'Create and manage leads; configure auto lead assignment';
    await role.save();
    console.log('Updated lead_provider role');
  } else {
    role = await Role.create({
      name: ROLE_LABELS.lead_provider,
      slug: 'lead_provider',
      description: 'Create and manage leads; configure auto lead assignment',
      isSystem: true,
      permissions: ROLE_PERMISSIONS.lead_provider,
    });
    console.log('Created lead_provider role');
  }

  const branch = await Branch.findOne({ status: 'active' }).sort({ createdAt: 1 });
  let user = await User.findOne({ email: EMAIL });
  if (user) {
    user.name = NAME;
    user.role = 'lead_provider';
    user.roleId = role._id;
    user.department = 'Lead Intake';
    user.status = 'active';
    user.password = PASSWORD;
    if (!user.branchId && branch) user.branchId = branch._id;
    await user.save();
    console.log('Updated existing user:', EMAIL);
  } else {
    user = await User.create({
      name: NAME,
      email: EMAIL,
      password: PASSWORD,
      role: 'lead_provider',
      roleId: role._id,
      department: 'Lead Intake',
      branchId: branch?._id,
      status: 'active',
    });
    console.log('Created user:', EMAIL);
  }

  console.log('\nLead Provider login:');
  console.log('  URL: https://app.unotrips.com/login');
  console.log('  Email (username):', EMAIL);
  console.log('  Password:', PASSWORD);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
