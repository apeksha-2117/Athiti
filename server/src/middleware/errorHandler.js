/**
 * Central error handler. Must be the last middleware registered.
 */
export function errorHandler(err, req, res, _next) {
  console.error(err);

  const status = err.status || err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  res.status(status).json({ error: message });
}
