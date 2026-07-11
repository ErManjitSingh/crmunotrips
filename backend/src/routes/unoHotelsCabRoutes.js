const express = require('express');
const {
  searchCabs,
  calculateFare,
  getCabDetail,
} = require('../controllers/unoHotelsCabController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/search', searchCabs);
router.post('/fare', calculateFare);
router.get('/:slug', getCabDetail);

module.exports = router;
