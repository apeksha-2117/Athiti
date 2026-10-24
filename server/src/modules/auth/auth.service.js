import argon2 from 'argon2';
import { prisma } from '../../config/prisma.js';

/**
 * Verify credentials, return safe user object (no passwordHash).
 */
export async function verifyCredentials(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'ACTIVE') return null;

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) return null;

  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}

/**
 * Return safe user object by id (for session hydration).
 */
export async function getUserById(id) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return null;
  const { passwordHash: _, ...safeUser } = user;
  return safeUser;
}
