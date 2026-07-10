const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');
const {
  notifyFollowUpReminder,
  notifyFollowUpMissed,
} = require('./notificationService');
const { processFollowUpEscalations } = require('./escalationService');
const { processSlaBreaches } = require('./slaService');
const { startOfDay } = require('../utils/queryHelpers');

const REMINDER_WINDOW_MS = 15 * 60 * 1000;
const TICK_MS = 60 * 1000;
const BATCH_LIMIT = 100;

async function loadNotifiedFollowUpIds(type, followUpIds) {
  if (!followUpIds.length) return new Set();
  const idStrings = followUpIds.flatMap((id) => {
    const value = id?.toString?.() || `${id}`;
    return [id, value];
  });
  const rows = await Notification.find({
    type,
    'meta.followUpId': { $in: idStrings },
  })
    .select('meta.followUpId')
    .lean();
  return new Set(rows.map((row) => `${row.meta?.followUpId}`));
}

async function processFollowUpReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MS);

  const dueSoon = await FollowUp.find({
    status: 'pending',
    scheduledAt: { $gte: now, $lte: windowEnd },
  })
    .populate('lead', 'name assignedTo')
    .populate('assignedTo', 'name _id')
    .sort({ scheduledAt: 1 })
    .limit(BATCH_LIMIT)
    .lean();

  const notified = await loadNotifiedFollowUpIds(
    NOTIFICATION_TYPES.FOLLOWUP_REMINDER,
    dueSoon.map((fu) => fu._id)
  );

  for (const fu of dueSoon) {
    const userId = fu.assignedTo?._id || fu.lead?.assignedTo;
    if (!userId) continue;
    const followUpIdStr = fu._id?.toString?.() || `${fu._id}`;
    if (notified.has(followUpIdStr)) continue;
    await notifyFollowUpReminder(fu, fu.lead);
    notified.add(followUpIdStr);
  }
}

async function processMissedFollowUps() {
  const todayStart = startOfDay();

  await FollowUp.updateMany(
    { status: 'pending', scheduledAt: { $lt: todayStart } },
    { status: 'missed' }
  );

  const missed = await FollowUp.find({
    status: 'missed',
    scheduledAt: { $lt: todayStart, $gte: new Date(todayStart.getTime() - 14 * 24 * 60 * 60 * 1000) },
  })
    .populate('lead', 'name assignedTo')
    .populate('assignedTo', 'name _id')
    .sort({ scheduledAt: 1 })
    .limit(BATCH_LIMIT)
    .lean();

  const notified = await loadNotifiedFollowUpIds(
    NOTIFICATION_TYPES.FOLLOWUP_MISSED,
    missed.map((fu) => fu._id)
  );

  for (const fu of missed) {
    const followUpIdStr = fu._id?.toString?.() || `${fu._id}`;
    if (notified.has(followUpIdStr)) continue;
    await notifyFollowUpMissed(fu, fu.lead);
    notified.add(followUpIdStr);
  }
}

function startNotificationScheduler() {
  const tick = async () => {
    try {
      await processFollowUpReminders();
      await processMissedFollowUps();
      await processFollowUpEscalations();
      await processSlaBreaches();
    } catch (err) {
      console.error('[NotificationScheduler]', err.message);
    }
  };

  tick();
  const handle = setInterval(tick, TICK_MS);
  console.log('[NotificationScheduler] Started (reminders, missed & escalations)');
  return () => clearInterval(handle);
}

module.exports = { startNotificationScheduler };
