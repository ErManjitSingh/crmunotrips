const Announcement = require('../models/Announcement');
const asyncHandler = require('../utils/asyncHandler');
const { ANNOUNCEMENT_TYPES, PRIORITIES, AUDIENCE_ROLES } = require('../models/Announcement');

function isActiveNow(announcement, now = new Date()) {
  if (!announcement.active) return false;
  if (announcement.publishAt && new Date(announcement.publishAt) > now) return false;
  if (announcement.expiresAt && new Date(announcement.expiresAt) < now) return false;
  return true;
}

function matchesAudience(announcement, user) {
  const role = user?.role;
  const userId = String(user?._id || '');
  const branchId = user?.branchId ? String(user.branchId) : null;

  if (Array.isArray(announcement.customUserIds) && announcement.customUserIds.length) {
    if (announcement.customUserIds.some((id) => String(id) === userId)) return true;
  }

  if (Array.isArray(announcement.audienceRoles) && announcement.audienceRoles.length) {
    if (!announcement.audienceRoles.includes(role)) return false;
  }

  if (Array.isArray(announcement.branchIds) && announcement.branchIds.length) {
    if (!branchId) return false;
    if (!announcement.branchIds.some((id) => String(id) === branchId)) return false;
  }

  return true;
}

function isDismissed(announcement, userId, now = new Date()) {
  const row = (announcement.dismissals || []).find((d) => String(d.user) === String(userId));
  if (!row) return false;
  if (row.remindAt && new Date(row.remindAt) <= now) return false;
  return true;
}

function decorateForUser(announcement, userId) {
  const obj = typeof announcement.toObject === 'function' ? announcement.toObject() : { ...announcement };
  const uid = String(userId);
  const isRead = (obj.reads || []).some((r) => String(r.user) === uid);
  const popupAlreadySeen = (obj.popupSeen || []).some((r) => String(r.user) === uid);
  delete obj.dismissals;
  delete obj.reads;
  delete obj.popupSeen;
  return {
    ...obj,
    isRead,
    isDismissed: isDismissed(announcement, uid),
    popupAlreadySeen,
  };
}

const listAll = asyncHandler(async (req, res) => {
  const items = await Announcement.find()
    .populate('createdBy', 'name email')
    .sort({ pinToDashboard: -1, publishAt: -1, createdAt: -1 })
    .lean();
  res.json({ items, meta: { types: ANNOUNCEMENT_TYPES, priorities: PRIORITIES, roles: AUDIENCE_ROLES } });
});

const createOne = asyncHandler(async (req, res) => {
  const payload = { ...req.body, createdBy: req.user._id };
  if (!payload.audienceRoles?.length) payload.audienceRoles = ['sales_executive'];
  const item = await Announcement.create(payload);
  res.status(201).json(item);
});

const updateOne = asyncHandler(async (req, res) => {
  const item = await Announcement.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!item) return res.status(404).json({ message: 'Announcement not found' });
  res.json(item);
});

const deleteOne = asyncHandler(async (req, res) => {
  const item = await Announcement.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: 'Announcement not found' });
  res.json({ ok: true });
});

const getFeed = asyncHandler(async (req, res) => {
  const now = new Date();
  const raw = await Announcement.find({ active: true })
    .sort({ pinToDashboard: -1, priority: -1, publishAt: -1 })
    .lean();

  const visible = raw
    .filter((a) => isActiveNow(a, now))
    .filter((a) => matchesAudience(a, req.user))
    .filter((a) => !isDismissed(a, req.user._id, now))
    .map((a) => decorateForUser(a, req.user._id));

  const pinnedHero = visible.find((a) => a.pinToDashboard) || visible[0] || null;
  const carousel = visible.filter((a) => !pinnedHero || String(a._id) !== String(pinnedHero._id)).slice(0, 12);
  const popup = visible.find((a) => a.enablePopup && !a.popupAlreadySeen) || null;

  const highlights = {
    activeIncentive: visible.find((a) => ['incentive', 'offer', 'promotion'].includes(a.type)) || null,
    runningContest: visible.find((a) => a.type === 'contest') || null,
    latestAnnouncement: visible[0] || null,
    holiday: visible.find((a) => ['holiday', 'festival'].includes(a.type)) || null,
    target: visible.find((a) => a.type === 'target') || null,
  };

  res.json({
    hero: pinnedHero,
    carousel,
    popup,
    highlights,
    unreadCount: visible.filter((a) => !a.isRead).length,
  });
});

const dismissOne = asyncHandler(async (req, res) => {
  const remindLaterHours = Number(req.body?.remindLaterHours || 0);
  const remindAt = remindLaterHours > 0 ? new Date(Date.now() + remindLaterHours * 3600 * 1000) : null;
  const item = await Announcement.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Announcement not found' });

  item.dismissals = (item.dismissals || []).filter((d) => String(d.user) !== String(req.user._id));
  item.dismissals.push({ user: req.user._id, at: new Date(), remindAt });
  await item.save();
  res.json({ ok: true });
});

const markRead = asyncHandler(async (req, res) => {
  const item = await Announcement.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Announcement not found' });
  if (!(item.reads || []).some((r) => String(r.user) === String(req.user._id))) {
    item.reads.push({ user: req.user._id, at: new Date() });
    await item.save();
  }
  res.json({ ok: true });
});

const markPopupSeen = asyncHandler(async (req, res) => {
  const item = await Announcement.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Announcement not found' });
  if (!(item.popupSeen || []).some((r) => String(r.user) === String(req.user._id))) {
    item.popupSeen.push({ user: req.user._id, at: new Date() });
    await item.save();
  }
  res.json({ ok: true });
});

const seedDemo = asyncHandler(async (req, res) => {
  const existing = await Announcement.countDocuments({ active: true });
  if (existing > 0 && !req.query.force) {
    return res.json({ ok: true, seeded: false, message: 'Announcements already exist' });
  }

  const now = new Date();
  const ends = new Date(now.getTime() + 8 * 24 * 3600 * 1000);

  await Announcement.create([
    {
      title: 'July Mega Sales Campaign',
      description:
        'Complete 10 confirmed bookings this month and win ₹15,000 bonus + International Trip Voucher.',
      bodyHtml:
        '<p>Hit 10 confirmed bookings before month end to unlock the mega bonus and travel voucher.</p>',
      type: 'contest',
      priority: 'urgent',
      badge: '🔥 Limited Offer',
      tags: ['Travel Contest', 'Bonus', 'Limited Time', 'Highest Priority'],
      audienceRoles: ['sales_executive'],
      publishAt: now,
      expiresAt: ends,
      pinToDashboard: true,
      enablePopup: true,
      ctaText: 'View Details',
      ctaUrl: '/sales-executive/dashboard',
      secondaryCtaText: 'Participate Now',
      progressLabel: 'Campaign Progress',
      progressPercent: 72,
      createdBy: req.user._id,
    },
    {
      title: 'Monthly Target Reminder',
      description: 'You are close to your monthly conversion target. Push hot leads today.',
      type: 'target',
      priority: 'high',
      badge: '🎯 Target',
      tags: ['Target'],
      audienceRoles: ['sales_executive'],
      publishAt: now,
      expiresAt: ends,
      pinToDashboard: false,
      createdBy: req.user._id,
    },
    {
      title: 'Holiday Notice — Independence Day',
      description: 'Office remains closed on 15 Aug. Follow-ups due that day should be preponed.',
      type: 'holiday',
      priority: 'normal',
      badge: '🎉 Holiday',
      tags: ['Holiday'],
      audienceRoles: ['sales_executive', 'sales_manager', 'team_leader'],
      publishAt: now,
      expiresAt: ends,
      createdBy: req.user._id,
    },
    {
      title: 'CRM Update — Quotation Builder',
      description: 'New hotel search and day-wise itinerary polish is live in quotation builder.',
      type: 'update',
      priority: 'normal',
      badge: '📢 Update',
      tags: ['CRM'],
      audienceRoles: ['sales_executive'],
      publishAt: now,
      createdBy: req.user._id,
    },
  ]);

  res.json({ ok: true, seeded: true });
});

module.exports = {
  listAll,
  createOne,
  updateOne,
  deleteOne,
  getFeed,
  dismissOne,
  markRead,
  markPopupSeen,
  seedDemo,
};
