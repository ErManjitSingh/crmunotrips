const User = require('../models/User');
const Role = require('../models/Role');
const Lead = require('../models/Lead');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { ROLE_LABELS, ROLES } = require('../config/roles');
const { logActivity, getClientIp } = require('../services/activityService');
const crypto = require('crypto');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

/** Roles lead providers may not assign when creating/inviting users. */
const LEAD_PROVIDER_BLOCKED_ROLE_SLUGS = new Set(['admin', 'hr_admin', 'lead_provider']);

function assertActorCanAssignRole(actorRole, roleSlug) {
  if (actorRole === 'admin') return;
  if (actorRole === 'lead_provider' && LEAD_PROVIDER_BLOCKED_ROLE_SLUGS.has(roleSlug)) {
    throw new ApiError(403, 'Lead providers cannot create admin or privileged users');
  }
}

function resolveCreatedUserBranchId(req, bodyBranchId) {
  if (req.user.role === 'admin' || req.user.role === 'lead_provider') {
    return bodyBranchId || req.branchId || req.user.branchId || null;
  }
  return req.user.branchId || null;
}

async function attachLeadCounts(users) {
  if (!users.length) return users;
  const ids = users.map((u) => u._id);
  const rows = await Lead.aggregate([
    { $match: { assignedTo: { $in: ids } } },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(rows.map((r) => [r._id.toString(), r.count]));
  return users.map((u) => ({
    ...u,
    assignedLeads: countMap[u._id.toString()] || 0,
  }));
}

const listUsers = asyncHandler(async (req, res) => {
  const { status, roleId, department, search } = req.query;
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
  const filter = {};
  if (req.branchId) filter.branchId = req.branchId;

  if (status) filter.status = status;
  if (roleId) filter.roleId = roleId;
  if (department) filter.department = department;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total, active, disabled] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
    User.countDocuments({ ...filter, status: 'active' }),
    User.countDocuments({ ...filter, status: 'disabled' }),
  ]);

  const withCounts = await attachLeadCounts(users);
  const rows = withCounts.map((u) => ({
    ...u,
    roleName: ROLE_LABELS[u.role] || u.role,
  }));

  res.json({
    ...paginatedResponse(rows, { page, limit, total }),
    stats: {
      total,
      active,
      disabled,
    },
  });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password').lean();
  if (!user) throw new ApiError(404, 'User not found');
  res.json({ ...user, roleName: ROLE_LABELS[user.role] || user.role });
});

const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password').lean();
  if (!user) throw new ApiError(404, 'User not found');

  const assignedLeads = await Lead.countDocuments({ assignedTo: user._id });
  const converted = await Lead.countDocuments({ assignedTo: user._id, status: 'converted' });

  res.json({
    ...user,
    roleName: ROLE_LABELS[user.role] || user.role,
    stats: { assignedLeads, converted },
  });
});

const createUser = asyncHandler(async (req, res) => {
  const { name, email, phone, roleId, department, status, password, branchId } = req.body;
  if (!name?.trim() || !email?.trim()) {
    throw new ApiError(400, 'Name and email are required');
  }
  if (!roleId) throw new ApiError(400, 'Role is required');

  const role = await Role.findById(roleId);
  if (!role) throw new ApiError(400, 'Invalid role');
  if (!ROLES.includes(role.slug)) {
    throw new ApiError(400, 'Role is not a valid system role');
  }
  assertActorCanAssignRole(req.user.role, role.slug);

  const normalizedEmail = email.toLowerCase().trim();
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) throw new ApiError(400, 'User with this email already exists');

  const plainPassword = password?.trim();
  if (!plainPassword || plainPassword.length < 6) {
    throw new ApiError(400, 'Password is required (minimum 6 characters)');
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    phone: phone?.trim() || '',
    role: role.slug,
    roleId: role._id,
    department: department || 'Sales',
    status: status || 'active',
    password: plainPassword,
    branchId: resolveCreatedUserBranchId(req, branchId),
  });

  await logActivity({
    type: 'user_action',
    user: req.user.name,
    userId: req.user._id,
    action: 'Created user',
    target: user.name,
    ip: getClientIp(req),
    branchId: user.branchId || req.branchId || null,
  });

  const obj = user.toObject();
  delete obj.password;
  res.status(201).json({ ...obj, roleName: ROLE_LABELS[obj.role] || obj.role });
});

const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  if (String(user._id) === String(req.user._id)) {
    throw new ApiError(400, 'You cannot change your own account status');
  }

  if (user.status === 'invited') {
    throw new ApiError(400, 'Invited users must accept the invite before you can activate them');
  }

  const requestedStatus = req.body?.status;
  let nextStatus;
  if (requestedStatus === 'active' || requestedStatus === 'disabled') {
    nextStatus = requestedStatus;
  } else {
    nextStatus = user.status === 'active' ? 'disabled' : 'active';
  }

  if (nextStatus === user.status) {
    const obj = user.toObject();
    delete obj.password;
    return res.json({ ...obj, roleName: ROLE_LABELS[obj.role] || obj.role });
  }

  user.status = nextStatus;
  await user.save();

  await logActivity({
    type: 'user_action',
    user: req.user.name,
    userId: req.user._id,
    action: nextStatus === 'active' ? 'Activated user' : 'Deactivated user',
    target: user.name,
    ip: getClientIp(req),
    branchId: user.branchId || req.branchId || null,
  });

  const obj = user.toObject();
  delete obj.password;
  res.json({ ...obj, roleName: ROLE_LABELS[obj.role] || obj.role });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  if (String(user._id) === String(req.user._id) && req.body.status && req.body.status !== user.status) {
    throw new ApiError(400, 'You cannot change your own account status');
  }

  if (req.body.roleId) {
    const role = await Role.findById(req.body.roleId);
    if (!role) throw new ApiError(400, 'Invalid role');
    user.roleId = role._id;
    user.role = role.slug;
  }

  const { roleId, roleName, password, ...rest } = req.body;
  if (req.user.role !== 'admin') delete rest.branchId;
  Object.assign(user, rest);
  if (password?.trim()) {
    if (password.trim().length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
    user.password = password.trim();
  }
  await user.save();

  await logActivity({
    type: 'user_action',
    user: req.user.name,
    userId: req.user._id,
    action:
      req.body.status === 'disabled'
        ? 'Deactivated user'
        : req.body.status === 'active'
          ? 'Activated user'
          : 'Updated user',
    target: user.name,
    ip: getClientIp(req),
    branchId: user.branchId || req.branchId || null,
  });

  const obj = user.toObject();
  delete obj.password;
  res.json({ ...obj, roleName: ROLE_LABELS[obj.role] || obj.role });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');
  await user.deleteOne();

  await logActivity({
    type: 'user_action',
    user: req.user.name,
    userId: req.user._id,
    action: 'Deleted user',
    target: user.name,
    ip: getClientIp(req),
    branchId: user.branchId || req.branchId || null,
  });

  res.json({ message: 'User deleted' });
});

const inviteUser = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.body.roleId);
  if (!role) throw new ApiError(400, 'Invalid role');
  assertActorCanAssignRole(req.user.role, role.slug);

  const token = `inv-${crypto.randomBytes(16).toString('hex')}`;
  const invitePassword = crypto.randomBytes(8).toString('hex');

  const user = await User.create({
    name: req.body.name || req.body.email.split('@')[0],
    email: req.body.email.toLowerCase().trim(),
    phone: req.body.phone || '',
    password: invitePassword,
    role: role.slug,
    roleId: role._id,
    department: req.body.department || 'Sales',
    status: 'invited',
    branchId: resolveCreatedUserBranchId(req, req.body.branchId),
    inviteToken: token,
    inviteExpiresAt: new Date(Date.now() + 7 * 86400000),
  });

  await logActivity({
    type: 'user_action',
    user: req.user.name,
    userId: req.user._id,
    action: 'Invited user',
    target: user.email,
    ip: getClientIp(req),
    branchId: user.branchId || req.branchId || null,
  });

  const obj = user.toObject();
  delete obj.password;
  res.status(201).json({ user: obj, inviteToken: token, message: 'Invitation sent successfully' });
});

const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  const temporaryPassword = crypto.randomBytes(4).toString('hex');
  user.password = temporaryPassword;
  user.status = user.status === 'invited' ? 'active' : user.status;
  await user.save();

  await logActivity({
    type: 'user_action',
    user: req.user.name,
    userId: req.user._id,
    action: 'Reset password',
    target: user.name,
    ip: getClientIp(req),
    branchId: user.branchId || req.branchId || null,
  });

  res.json({
    message: 'Password reset successfully',
    temporaryPassword,
  });
});

module.exports = {
  listUsers,
  getUser,
  getUserProfile,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
  inviteUser,
  resetPassword,
};
