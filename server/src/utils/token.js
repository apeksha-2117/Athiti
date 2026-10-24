import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'athithi_demo_super_secret_jwt_key_32chars';

/**
 * Sign a lightweight JWT-compatible HMAC token
 */
export function signToken(payload, expiresInMs = 7 * 24 * 60 * 60 * 1000) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      hotelId: payload.hotelId,
      exp: Date.now() + expiresInMs,
    })
  ).toString('base64url');

  const signature = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode an HMAC token
 */
export function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expected = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');

    // Constant-time comparison
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Date.now()) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
