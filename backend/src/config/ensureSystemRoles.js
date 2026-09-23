const Role = require('../models/Role');
const { ROLE_LABELS } = require('./roles');
const { ROLE_PERMISSIONS } = require('./permissions');

/**
 * System roles added AFTER a database was first seeded. The user-creation flow picks a role by its
 * Role document (POST /users takes `roleId`), so a role that is only in config/roles.js is
 * invisible in every role dropdown until its document exists. Older roles reached existing
 * databases through one-off scripts; this does it at boot instead.
 *
 * Insert-only and idempotent: `$setOnInsert` under an upsert on the unique slug, so an existing
 * Role document — its name, description and any permissions an admin has edited — is never touched,
 * and two servers starting together cannot create duplicates. Deliberately limited to the slugs
 * listed here, not every role in ROLES.
 */
const ROLES_ADDED_AFTER_INITIAL_SEED = ['cold_calling'];

async function ensureSystemRoles(slugs = ROLES_ADDED_AFTER_INITIAL_SEED) {
  const created = [];
  for (const slug of slugs) {
    const name = ROLE_LABELS[slug];
    const permissions = ROLE_PERMISSIONS[slug];
    if (!name || !permissions) throw new Error(`ensureSystemRoles: "${slug}" is not a configured role`);

    const result = await Role.updateOne(
      { slug },
      {
        $setOnInsert: {
          name,
          slug,
          description: `${name} system role`,
          isSystem: true,
          userCount: 0,
          permissions,
        },
      },
      { upsert: true }
    );
    if (result.upsertedCount) created.push(slug);
  }
  return created;
}

module.exports = { ensureSystemRoles, ROLES_ADDED_AFTER_INITIAL_SEED };
