const express = require('express');
const router = express.Router();
const {
  listPackages,
  getPackage,
  createPackage,
  updatePackage,
  deletePackage,
  duplicatePackage,
  cloneFromUnoPackage,
  listHotels,
  createHotel,
  updateHotel,
  deleteHotel,
  listCabs,
  createCab,
  updateCab,
  deleteCab,
  listFlights,
  createFlight,
  updateFlight,
  deleteFlight,
} = require('../controllers/packageController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/clone-from-uno/:unoId', cloneFromUnoPackage);
router.post('/duplicate/:id', duplicatePackage);
router.route('/').get(listPackages).post(createPackage);
router.route('/:id').get(getPackage).put(updatePackage).delete(deletePackage);

module.exports = router;
