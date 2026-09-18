const express = require('express');
const router = express.Router();
const { getStats, getDestinationDetail, getAllDestinations } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/stats', getStats);
router.get('/destination', getDestinationDetail);
router.get('/destinations', getAllDestinations);

module.exports = router;
