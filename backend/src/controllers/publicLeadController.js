const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { ingestPublicLead } = require('../services/publicLeadIngestService');

const ingestLead = asyncHandler(async (req, res) => {
  const expected = process.env.META_LEAD_API_KEY || process.env.PUBLIC_LEAD_API_KEY;
  if (!expected) {
    throw new ApiError(503, 'Public lead ingest is not configured');
  }

  const provided =
    req.headers['x-api-key'] ||
    req.headers['x-meta-api-key'] ||
    req.body?.apiKey ||
    req.query?.apiKey;

  if (!provided || provided !== expected) {
    throw new ApiError(401, 'Invalid API key');
  }

  const lead = await ingestPublicLead(req.body || {});

  res.status(201).json({
    success: true,
    message: 'Lead created',
    data: {
      id: lead._id,
      leadId: lead.leadId,
      name: lead.name,
      phone: lead.phone,
      destination: lead.destination,
      source: lead.source,
      sourceLabel: lead.sourceLabel,
      status: lead.status,
    },
  });
});

module.exports = { ingestLead };
