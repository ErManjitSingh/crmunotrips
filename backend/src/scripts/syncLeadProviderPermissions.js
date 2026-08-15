/**
 * Sync lead_provider Role.permissions from config (no password / user changes).
 * Run: node src/scripts/syncLeadProviderPermissions.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../config/db');
const Role = require('../models/Role');
const { ROLE_PERMISSIONS } = require('../config/permissions');
const { ROLE_LABELS } = require('../config/roles');

async function run() {
  await connectDB();
  const perms = ROLE_PERMISSIONS.lead_provider;
  let role = await Role.findOne({ slug: 'lead_provider' });
  if (!role) {
    role = await Role.create({
      name: ROLE_LABELS.lead_provider,
      slug: 'lead_provider',
      description: 'Create and manage leads; create users; configure auto lead assignment',
      isSystem: true,
      permissions: perms,
    });
    console.log('Created lead_provider role with users.create');
  } else {
    role.name = ROLE_LABELS.lead_provider;
    role.permissions = perms;
    role.isSystem = true;
    role.description = 'Create and manage leads; create users; configure auto lead assignment';
    await role.save();
    console.log('Synced lead_provider permissions', {
      usersCreate: Boolean(role.permissions?.users?.create),
    });
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
