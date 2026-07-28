/**
 * Master switch for automatic lead assignment when a lead is created.
 * Manual assignment (admin / sales manager / team leader) remains always available.
 *
 * Runtime value is stored in DB (AssignmentGlobalSettings) and can be toggled from the UI.
 * Env LEAD_AUTO_ASSIGNMENT_ENABLED seeds the default when no DB row exists yet.
 */
const AssignmentGlobalSettings = require('../models/AssignmentGlobalSettings');

const ENV_DEFAULT = process.env.LEAD_AUTO_ASSIGNMENT_ENABLED !== 'false';

let cachedEnabled = null;
let cacheAt = 0;
const CACHE_MS = 3000;

function invalidateLeadAutoAssignmentCache() {
  cachedEnabled = null;
  cacheAt = 0;
}

async function getOrCreateGlobalSettings() {
  let doc = await AssignmentGlobalSettings.findOne({ key: 'global' });
  if (!doc) {
    try {
      doc = await AssignmentGlobalSettings.create({
        key: 'global',
        leadAutoAssignmentEnabled: ENV_DEFAULT,
      });
    } catch (err) {
      // Race on first create — re-read
      doc = await AssignmentGlobalSettings.findOne({ key: 'global' });
      if (!doc) throw err;
    }
  }
  return doc;
}

async function isLeadAutoAssignmentEnabled() {
  if (cachedEnabled !== null && Date.now() - cacheAt < CACHE_MS) {
    return cachedEnabled;
  }
  const doc = await getOrCreateGlobalSettings();
  cachedEnabled = doc.leadAutoAssignmentEnabled === true;
  cacheAt = Date.now();
  return cachedEnabled;
}

async function setLeadAutoAssignmentEnabled(enabled) {
  const doc = await getOrCreateGlobalSettings();
  doc.leadAutoAssignmentEnabled = Boolean(enabled);
  await doc.save();
  cachedEnabled = doc.leadAutoAssignmentEnabled;
  cacheAt = Date.now();
  return cachedEnabled;
}

/** @deprecated Prefer isLeadAutoAssignmentEnabled() — kept for sync status fallbacks */
const LEAD_AUTO_ASSIGNMENT_ENABLED = ENV_DEFAULT;

module.exports = {
  LEAD_AUTO_ASSIGNMENT_ENABLED,
  isLeadAutoAssignmentEnabled,
  setLeadAutoAssignmentEnabled,
  invalidateLeadAutoAssignmentCache,
};
