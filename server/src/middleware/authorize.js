/**
 * Returns a middleware that enforces one or more allowed roles.
 * Must be used after `authenticate`.
 *
 * Usage:
 *   router.get('/admin/incidents', authenticate, authorize('ADMIN'), handler)
 *   router.get('/tasks', authenticate, authorize('STAFF', 'ADMIN'), handler)
 */
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
