const express = require('express');
const router = express.Router();
const {
  listUsers,
  getUser,
  getUserProfile,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
  inviteUser,
  resetPassword,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(protect);

router.post('/invite', authorize('admin', 'lead_provider'), inviteUser);
router.post('/reset-password/:id', authorize('admin'), resetPassword);
router.get('/:id/profile', getUserProfile);
router.get('/', listUsers);
router.post('/', authorize('admin', 'lead_provider'), createUser);
router.get('/:id', getUser);
router.put('/:id', authorize('admin'), updateUser);
router.patch('/:id/toggle-status', authorize('admin'), toggleUserStatus);
router.delete('/:id', authorize('admin'), deleteUser);

module.exports = router;
