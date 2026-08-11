const User = require('../models/User');
const Branch = require('../models/Branch');
const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const Booking = require('../models/Booking');
const Attendance = require('../models/Attendance');
const ActivityLog = require('../models/ActivityLog');
const LeadActivity = require('../models/LeadActivity');
const AuditLog = require('../models/AuditLog');
const CallNote = require('../models/CallNote');
const LeadEscalation = require('../models/LeadEscalation');
const LeadMergeLog = require('../models/LeadMergeLog');
const LeadTransferLog = require('../models/LeadTransferLog');
const LeadNote = require('../models/LeadNote');
const EmailLog = require('../models/EmailLog');
const EmailReply = require('../models/EmailReply');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const TripTask = require('../models/TripTask');
const TripDocument = require('../models/TripDocument');
const SupportTicket = require('../models/SupportTicket');
const Voucher = require('../models/Voucher');

async function ensureIndexes() {
  await Promise.all([
    User.collection.createIndex({ email: 1 }, { unique: true, background: true }),
    Branch.collection.createIndex({ code: 1 }, { unique: true, background: true }),
    User.collection.createIndex({ role: 1, status: 1 }, { background: true }),
    User.collection.createIndex({ branchId: 1, role: 1, status: 1 }, { background: true }),

    Lead.collection.createIndex({ phone: 1 }, { background: true }),
    Lead.collection.createIndex({ whatsapp: 1 }, { background: true, sparse: true }),
    Lead.collection.createIndex({ branchId: 1, status: 1, createdAt: -1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, leadScore: 1, budget: -1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, 'reactivation.isReactivated': 1, 'reactivation.stage': 1, updatedAt: -1 }, { background: true }),
    Lead.collection.createIndex({ status: 1, createdAt: -1 }, { background: true }),
    Lead.collection.createIndex({ assignedTo: 1, status: 1 }, { background: true }),
    Lead.collection.createIndex({ destination: 1 }, { background: true }),
    Lead.collection.createIndex({ createdAt: -1 }, { background: true }),
    Lead.collection.createIndex({ name: 'text', email: 'text', destination: 'text' }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, isDeleted: 1, createdAt: -1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, temperature: 1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, agingBucket: 1 }, { background: true }),
    Lead.collection.createIndex({ alternatePhone: 1 }, { background: true, sparse: true }),
    Lead.collection.createIndex({ branchId: 1, isDeleted: 1, status: 1, createdAt: -1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, isDeleted: 1, assignedTo: 1, createdAt: -1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, isDeleted: 1, source: 1, status: 1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, slaBreached: 1, createdAt: -1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, assignedTo: 1, status: 1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, assignedTo: 1, isHot: 1, status: 1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, channel: 1, updatedAt: -1 }, { background: true }),
    Lead.collection.createIndex({ budget: -1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, isDeleted: 1, budget: -1 }, { background: true }),
    Lead.collection.createIndex({ nextFollowUp: 1 }, { background: true, sparse: true }),
    Lead.collection.createIndex({ branchId: 1, isDeleted: 1, nextFollowUp: 1 }, { background: true, sparse: true }),
    Lead.collection.createIndex({ email: 1 }, { background: true, sparse: true }),
    LeadNote.collection.createIndex({ lead: 1, createdAt: -1 }, { background: true }),
    LeadActivity.collection.createIndex({ leadId: 1, createdAt: -1 }, { background: true }),
    AuditLog.collection.createIndex({ entityType: 1, entityId: 1, createdAt: -1 }, { background: true }),
    CallNote.collection.createIndex({ leadId: 1, createdAt: -1 }, { background: true }),
    LeadEscalation.collection.createIndex({ followUpId: 1, level: 1 }, { unique: true, background: true }),
    LeadMergeLog.collection.createIndex({ targetLeadId: 1, createdAt: -1 }, { background: true }),
    LeadTransferLog.collection.createIndex({ leadId: 1, createdAt: -1 }, { background: true }),

    FollowUp.collection.createIndex({ scheduledAt: 1, status: 1 }, { background: true }),
    FollowUp.collection.createIndex({ branchId: 1, status: 1, scheduledAt: 1 }, { background: true }),
    FollowUp.collection.createIndex({ lead: 1, scheduledAt: -1 }, { background: true }),
    FollowUp.collection.createIndex({ assignedTo: 1, status: 1, scheduledAt: 1 }, { background: true }),

    Quotation.collection.createIndex({ lead: 1, status: 1 }, { background: true }),
    Quotation.collection.createIndex({ branchId: 1, status: 1, createdAt: -1 }, { background: true }),
    Quotation.collection.createIndex({ status: 1, createdAt: -1 }, { background: true }),

    Booking.collection.createIndex({ travelDate: 1, status: 1 }, { background: true }),
    Booking.collection.createIndex({ branchId: 1, status: 1, createdAt: -1 }, { background: true }),
    Booking.collection.createIndex({ status: 1, createdAt: -1 }, { background: true }),
    Booking.collection.createIndex({ branchId: 1, status: 1, travelDate: 1 }, { background: true }),
    Booking.collection.createIndex({ branchId: 1, archivedAt: 1, createdAt: -1 }, { background: true }),
    TripTask.collection.createIndex({ booking: 1, status: 1 }, { background: true }),
    TripTask.collection.createIndex({ branchId: 1, status: 1, dueDate: 1 }, { background: true }),
    TripDocument.collection.createIndex({ booking: 1, type: 1 }, { background: true }),
    SupportTicket.collection.createIndex({ status: 1, updatedAt: -1 }, { background: true }),
    Voucher.collection.createIndex({ booking: 1, type: 1 }, { background: true }),

    Attendance.collection.createIndex({ userId: 1, date: 1 }, { unique: true, background: true }),
    ActivityLog.collection.createIndex({ branchId: 1, createdAt: -1 }, { background: true }),
    ActivityLog.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400, background: true }),
    Attendance.collection.createIndex({ date: 1, workMode: 1 }, { background: true }),
    Attendance.collection.createIndex({ date: 1, status: 1 }, { background: true }),

    EmailLog.collection.createIndex({ branchId: 1, leadId: 1, status: 1, sentAt: -1 }, { background: true }),
    EmailLog.collection.createIndex({ branchId: 1, sentBy: 1, status: 1, sentAt: -1 }, { background: true }),
    EmailLog.collection.createIndex({ branchId: 1, status: 1, sentAt: -1 }, { background: true }),
    EmailLog.collection.createIndex({ branchId: 1, status: 1, createdAt: -1 }, { background: true }),
    EmailReply.collection.createIndex({ branchId: 1, leadId: 1, receivedAt: -1 }, { background: true }),
    EmailReply.collection.createIndex({ branchId: 1, receivedAt: -1 }, { background: true }),
    WhatsAppMessage.collection.createIndex({ lead: 1, timestamp: -1 }, { background: true }),
    WhatsAppMessage.collection.createIndex({ lead: 1, direction: 1, status: 1 }, { background: true }),
    Payment.collection.createIndex({ branchId: 1, status: 1, paidAt: -1 }, { background: true }),
    Notification.collection.createIndex({ user: 1, read: 1, createdAt: -1 }, { background: true }),
    Notification.collection.createIndex({ user: 1, type: 1, 'meta.followUpId': 1 }, { background: true }),
    Quotation.collection.createIndex({ createdByExecutive: 1, branchId: 1, status: 1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, status: 1, firstContactAt: 1, createdAt: 1 }, { background: true }),
    Lead.collection.createIndex({ branchId: 1, assignedTo: 1, isDeleted: 1, priority: 1 }, { background: true }),
    FollowUp.collection.createIndex({ status: 1, scheduledAt: 1 }, { background: true }),
  ]);

  console.log('[MongoDB] Performance indexes ensured');
}

module.exports = { ensureIndexes };
