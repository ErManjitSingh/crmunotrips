/**
 * Master switch for automatic lead assignment when a lead is created.
 * Manual assignment (admin / sales manager / team leader) remains always available.
 *
 * Default: ON. Set LEAD_AUTO_ASSIGNMENT_ENABLED=false in .env to disable auto-assign.
 */
const LEAD_AUTO_ASSIGNMENT_ENABLED = process.env.LEAD_AUTO_ASSIGNMENT_ENABLED !== 'false';

module.exports = { LEAD_AUTO_ASSIGNMENT_ENABLED };
