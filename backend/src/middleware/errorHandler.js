const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || res.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'Server Error',
    // Application error codes only (e.g. LEAD_REASSIGNED); numeric driver codes such as Mongo's 11000 are never exposed.
    ...(typeof err.code === 'string' && /^[A-Z_]+$/.test(err.code) ? { code: err.code } : {}),
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = errorHandler;
