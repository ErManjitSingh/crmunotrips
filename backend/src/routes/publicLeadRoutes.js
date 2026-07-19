const express = require('express');
const rateLimit = require('express-rate-limit');
const { ingestLead } = require('../controllers/publicLeadController');

const router = express.Router();

const publicLeadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many lead submissions, please try again later.' },
});

router.post('/leads', publicLeadLimiter, ingestLead);

module.exports = router;
