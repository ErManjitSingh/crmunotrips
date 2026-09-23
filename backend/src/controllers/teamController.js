const Team = require('../models/Team');
const User = require('../models/User');
const Lead = require('../models/Lead');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { sumConvertedPackageRevenue } = require('../utils/convertedPackageRevenue');

async function computeTeamStats(team) {
  const memberIds = team.members.map((m) => m._id || m);
  const teamLeads = await Lead.find({ assignedTo: { $in: memberIds } }).lean();
  const converted = teamLeads.filter((l) => l.status === 'converted');
  const revenue = await sumConvertedPackageRevenue({ assigneeIds: memberIds });

  return {
    membersCount: team.members.length,
    leadsAssigned: teamLeads.length,
    conversions: converted.length,
    revenue,
  };
}

async function enrichTeam(team) {
  const obj = team.toObject ? team.toObject() : team;
  return { ...obj, stats: await computeTeamStats(obj) };
}

const listTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find()
    .populate('teamLeader', 'name email')
    .populate('members', 'name email')
    .populate('salesManager', 'name email')
    .sort({ createdAt: -1 });

  const enriched = await Promise.all(teams.map(enrichTeam));
  res.json(enriched);
});

const getTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id)
    .populate('teamLeader', 'name email')
    .populate('members', 'name email')
    .populate('salesManager', 'name email');

  if (!team) throw new ApiError(404, 'Team not found');
  res.json(await enrichTeam(team));
});

const createTeam = asyncHandler(async (req, res) => {
  const leader = await User.findById(req.body.teamLeaderId);
  if (!leader) throw new ApiError(404, 'Team leader not found');

  const team = await Team.create({
    name: req.body.name,
    description: req.body.description || '',
    teamLeader: leader._id,
    salesManager: req.user._id,
    members: [],
  });

  const populated = await Team.findById(team._id)
    .populate('teamLeader', 'name email')
    .populate('members', 'name email');

  res.status(201).json(await enrichTeam(populated));
});

const updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new ApiError(404, 'Team not found');

  if (req.body.teamLeaderId) {
    const leader = await User.findById(req.body.teamLeaderId);
    if (!leader) throw new ApiError(404, 'Team leader not found');
    team.teamLeader = leader._id;
  }
  if (req.body.name !== undefined) team.name = req.body.name;
  if (req.body.description !== undefined) team.description = req.body.description;

  await team.save();

  const populated = await Team.findById(team._id)
    .populate('teamLeader', 'name email')
    .populate('members', 'name email');

  res.json(await enrichTeam(populated));
});

const deleteTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new ApiError(404, 'Team not found');
  await team.deleteOne();
  res.json({ message: 'Team deleted' });
});

const listTeamLeaders = asyncHandler(async (req, res) => {
  const leaders = await User.find({ role: 'team_leader', status: 'active' })
    .select('name email')
    .lean();
  res.json(leaders);
});

const listAvailableExecutives = asyncHandler(async (req, res) => {
  const teams = await Team.find().select('members');
  const assigned = new Set(teams.flatMap((t) => t.members.map((m) => m.toString())));

  const executives = await User.find({
    role: 'sales_executive',
    status: 'active',
    _id: { $nin: [...assigned] },
  })
    .select('name email')
    .lean();

  res.json(executives);
});

const addMember = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new ApiError(404, 'Team not found');

  const exec = await User.findById(req.body.executiveId);
  if (!exec) throw new ApiError(404, 'Executive not found');

  const existing = await Team.findOne({ members: exec._id, _id: { $ne: team._id } });
  if (existing) throw new ApiError(400, 'Executive already belongs to a team');

  if (!team.members.some((m) => m.toString() === exec._id.toString())) {
    team.members.push(exec._id);
    await team.save();
  }

  const populated = await Team.findById(team._id)
    .populate('teamLeader', 'name email')
    .populate('members', 'name email');

  res.json(await enrichTeam(populated));
});

const removeMember = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new ApiError(404, 'Team not found');

  team.members = team.members.filter((m) => m.toString() !== req.params.memberId);
  await team.save();

  const populated = await Team.findById(team._id)
    .populate('teamLeader', 'name email')
    .populate('members', 'name email');

  res.json(await enrichTeam(populated));
});

const transferMember = asyncHandler(async (req, res) => {
  const fromTeam = await Team.findById(req.params.id);
  const toTeam = await Team.findById(req.body.targetTeamId);
  if (!fromTeam || !toTeam) throw new ApiError(404, 'Team not found');

  const memberIdx = fromTeam.members.findIndex((m) => m.toString() === req.body.executiveId);
  if (memberIdx === -1) throw new ApiError(404, 'Member not found');

  const [memberId] = fromTeam.members.splice(memberIdx, 1);
  toTeam.members.push(memberId);
  await fromTeam.save();
  await toTeam.save();

  res.json({ message: 'Executive transferred', from: fromTeam.name, to: toTeam.name });
});

const updateTeamLeader = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new ApiError(404, 'Team not found');

  const leader = await User.findById(req.body.teamLeaderId);
  if (!leader) throw new ApiError(404, 'Team leader not found');

  team.teamLeader = leader._id;
  await team.save();

  const populated = await Team.findById(team._id)
    .populate('teamLeader', 'name email')
    .populate('members', 'name email');

  res.json(await enrichTeam(populated));
});

const getTeamPerformance = asyncHandler(async (req, res) => {
  const { buildTeamPerformance } = require('../services/dashboardService');
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';
  const source = typeof req.query.source === 'string' ? req.query.source : '';
  const data = await buildTeamPerformance({
    branchId: req.branchId,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    source: source || undefined,
  });
  res.json(data);
});

module.exports = {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  listTeamLeaders,
  listAvailableExecutives,
  addMember,
  removeMember,
  transferMember,
  updateTeamLeader,
  getTeamPerformance,
};
