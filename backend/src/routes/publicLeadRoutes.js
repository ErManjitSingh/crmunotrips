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

router.get('/leads', (_req, res) => {
  res.json({
    ok: true,
    message: 'Public lead ingest is online. Submit leads with POST /api/public/leads and X-Api-Key header.',
    methods: ['POST'],
  });
});

router.post('/leads', publicLeadLimiter, ingestLead);

module.exports = router;
