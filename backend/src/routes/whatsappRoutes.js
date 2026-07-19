const express = require('express');
const router = express.Router();
const {
  listConversations,
  getMessages,
  getMessagesByConversation,
  getNotes,
  getFollowUpsForLead,
  listExecutives,
  postMessage,
  postNote,
  updateWhatsAppLead,
  markRead,
  createLeadFromChat,
  cloudStatus,
} = require('../controllers/whatsappController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/status', cloudStatus);
router.get('/conversations', listConversations);
router.get('/messages/conversation/:conversationId', getMessagesByConversation);
router.get('/messages/:leadId', getMessages);
router.get('/notes/:leadId', getNotes);
router.get('/followups/:leadId', getFollowUpsForLead);
router.get('/executives', listExecutives);
router.post('/messages', postMessage);
router.post('/notes', postNote);
router.post('/create-lead', createLeadFromChat);
router.put('/leads/:id', updateWhatsAppLead);
router.put('/read/:leadId', markRead);

module.exports = router;
