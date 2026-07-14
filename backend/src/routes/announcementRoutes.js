const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const {
  listAll,
  createOne,
  updateOne,
  deleteOne,
  getFeed,
  dismissOne,
  markRead,
  markPopupSeen,
  seedDemo,
} = require('../controllers/announcementController');

router.use(protect);

router.get('/feed', getFeed);
router.post('/seed-demo', authorize('admin'), seedDemo);

router.get('/', authorize('admin'), listAll);
router.post('/', authorize('admin'), createOne);

router.post('/:id/dismiss', dismissOne);
router.post('/:id/read', markRead);
router.post('/:id/popup-seen', markPopupSeen);
router.put('/:id', authorize('admin'), updateOne);
router.delete('/:id', authorize('admin'), deleteOne);

module.exports = router;
