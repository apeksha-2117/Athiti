import { verifyToken } from '../utils/token.js';

/**
 * Attaches the authenticated user to req.user.
 * Supports Authorization: Bearer <token> AND express-session cookies.
 * Returns 401 if unauthenticated.
 */
export function authenticate(req, res, next) {
  // 1. Check Bearer token from Authorization header (cross-domain SPA friendly)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyToken(token);
    if (payload) {
      req.user = payload;
      return next();
    }
  }

  // 2. Check session cookie fallback
  if (req.session?.user) {
    req.user = req.session.user;
    return next();
  }

  return res.status(401).json({ error: 'Unauthenticated' });
}
