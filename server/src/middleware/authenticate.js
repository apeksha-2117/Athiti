/**
 * Attaches the authenticated user to req.user.
 * Returns 401 if no session exists.
 */
export function authenticate(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  req.user = req.session.user;
  next();
}
