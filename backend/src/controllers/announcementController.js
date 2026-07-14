const Announcement = require('../models/Announcement');
const asyncHandler = require('../utils/asyncHandler');
const { ANNOUNCEMENT_TYPES, PRIORITIES, AUDIENCE_ROLES } = require('../models/Announcement');
const cacheService = require('../services/cacheService');

const FEED_TTL_MS = 20_000;
const PRIORITY_RANK = { urgent: 4, high: 3, normal: 2, low: 1 };

const FEED_FIELDS = {
  title: 1,
  description: 1,
  bodyHtml: 1,
  type: 1,
  priority: 1,
  badge: 1,
  tags: 1,
  publishAt: 1,
  expiresAt: 1,
  pinToDashboard: 1,
  enablePopup: 1,
  ctaText: 1,
  ctaUrl: 1,
  secondaryCtaText: 1,
  secondaryCtaUrl: 1,
  progressLabel: 1,
  progressPercent: 1,
  audienceRoles: 1,
  branchIds: 1,
  customUserIds: 1,
  active: 1,
  dismissals: 1,
  reads: 1,
  popupSeen: 1,
};

function feedCacheKey(userId) {
  return `announcement:feed:${userId}`;
}

async function bustAnnouncementCache() {
  await cacheService.invalidate('announcement:');
}

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
  const uid = String(userId);
  const isRead = (announcement.reads || []).some((r) => String(r.user) === uid);
  const popupAlreadySeen = (announcement.popupSeen || []).some((r) => String(r.user) === uid);

  return {
    _id: announcement._id,
    title: announcement.title,
    description: announcement.description,
    bodyHtml: announcement.bodyHtml || '',
    type: announcement.type,
    priority: announcement.priority,
    badge: announcement.badge || '',
    tags: announcement.tags || [],
    publishAt: announcement.publishAt,
    expiresAt: announcement.expiresAt,
    pinToDashboard: !!announcement.pinToDashboard,
    enablePopup: !!announcement.enablePopup,
    ctaText: announcement.ctaText,
    ctaUrl: announcement.ctaUrl || '',
    secondaryCtaText: announcement.secondaryCtaText,
    secondaryCtaUrl: announcement.secondaryCtaUrl || '',
    progressLabel: announcement.progressLabel,
    progressPercent: announcement.progressPercent ?? null,
    isRead,
    popupAlreadySeen,
  };
}

function slimCard(item) {
  if (!item) return null;
  const { bodyHtml, ...rest } = item;
  return rest;
}

function sortVisible(a, b) {
  if (!!a.pinToDashboard !== !!b.pinToDashboard) return a.pinToDashboard ? -1 : 1;
  const pr = (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0);
  if (pr) return pr;
  return new Date(b.publishAt || 0) - new Date(a.publishAt || 0);
}

async function buildFeed(user) {
  const now = new Date();
  const raw = await Announcement.find({
    active: true,
    $and: [
      { $or: [{ publishAt: null }, { publishAt: { $lte: now } }] },
      { $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }] },
    ],
  })
    .select(FEED_FIELDS)
    .sort({ pinToDashboard: -1, publishAt: -1 })
    .limit(40)
    .lean();

  const visible = raw
    .filter((a) => isActiveNow(a, now))
    .filter((a) => matchesAudience(a, user))
    .filter((a) => !isDismissed(a, user._id, now))
    .map((a) => decorateForUser(a, user._id))
    .sort(sortVisible);

  const pinnedHero = visible.find((a) => a.pinToDashboard) || visible[0] || null;
  const carousel = visible
    .filter((a) => !pinnedHero || String(a._id) !== String(pinnedHero._id))
    .slice(0, 8)
    .map(slimCard);
  const popup = visible.find((a) => a.enablePopup && !a.popupAlreadySeen) || null;

  return {
    hero: pinnedHero,
    carousel,
    popup: popup ? slimCard(popup) : null,
    unreadCount: visible.filter((a) => !a.isRead).length,
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
  await bustAnnouncementCache();
  res.status(201).json(item);
});

const updateOne = asyncHandler(async (req, res) => {
  const item = await Announcement.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!item) return res.status(404).json({ message: 'Announcement not found' });
  await bustAnnouncementCache();
  res.json(item);
});

const deleteOne = asyncHandler(async (req, res) => {
  const item = await Announcement.findByIdAndDelete(req.params.id);
  if (!item) return res.status(404).json({ message: 'Announcement not found' });
  await bustAnnouncementCache();
  res.json({ ok: true });
});

const getFeed = asyncHandler(async (req, res) => {
  const key = feedCacheKey(req.user._id);
  const payload = await cacheService.getOrSet(key, () => buildFeed(req.user), FEED_TTL_MS);
  res.json(payload);
});

const dismissOne = asyncHandler(async (req, res) => {
  const remindLaterHours = Number(req.body?.remindLaterHours || 0);
  const remindAt = remindLaterHours > 0 ? new Date(Date.now() + remindLaterHours * 3600 * 1000) : null;
  const userId = req.user._id;

  const pulled = await Announcement.updateOne(
    { _id: req.params.id },
    { $pull: { dismissals: { user: userId } } }
  );
  if (!pulled.matchedCount) return res.status(404).json({ message: 'Announcement not found' });

  await Promise.all([
    Announcement.updateOne(
      { _id: req.params.id },
      { $push: { dismissals: { user: userId, at: new Date(), remindAt } } }
    ),
    cacheService.invalidate(feedCacheKey(userId)),
  ]);

  res.json({ ok: true });
});

const markRead = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const result = await Announcement.updateOne(
    { _id: req.params.id, 'reads.user': { $ne: userId } },
    { $push: { reads: { user: userId, at: new Date() } } }
  );
  if (!result.matchedCount) {
    const exists = await Announcement.exists({ _id: req.params.id });
    if (!exists) return res.status(404).json({ message: 'Announcement not found' });
  }
  await cacheService.invalidate(feedCacheKey(userId));
  res.json({ ok: true });
});

const markPopupSeen = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const result = await Announcement.updateOne(
    { _id: req.params.id, 'popupSeen.user': { $ne: userId } },
    { $push: { popupSeen: { user: userId, at: new Date() } } }
  );
  if (!result.matchedCount) {
    const exists = await Announcement.exists({ _id: req.params.id });
    if (!exists) return res.status(404).json({ message: 'Announcement not found' });
  }
  await cacheService.invalidate(feedCacheKey(userId));
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

  await bustAnnouncementCache();
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
