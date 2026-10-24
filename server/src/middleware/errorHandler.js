/**
 * Central error handler. Must be the last middleware registered.
 */
export function errorHandler(err, req, res, _next) {
  console.error(`[Error] ${req.method} ${req.url}:`, err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}
