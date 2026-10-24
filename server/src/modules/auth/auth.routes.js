import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { loginSchema } from './auth.schema.js';
import { verifyCredentials } from './auth.service.js';
import { signToken } from '../../utils/token.js';

export const authRouter = Router();

// Friendly rate limit on login for testing & demos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many login attempts, try again later' },
});

// POST /api/auth/login
authRouter.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const user = await verifyCredentials(req.body.email, req.body.password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    req.session.user = user;
    const token = signToken(user);
    res.json({ user, token });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
authRouter.post('/logout', authenticate, (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

// GET /api/auth/me
authRouter.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});
