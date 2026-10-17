import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { UserRole } from '@prisma/client';

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'qprint-dev-secret-key-change-in-production-2026'
);

const COOKIE_NAME = 'qprint_session';
const TOKEN_EXPIRY = '24h';

export interface SessionPayload extends JWTPayload {
  userId: string;
  role: UserRole;
  name: string;
  mobile?: string;
  username?: string;
}

// Hash password with bcrypt (12 rounds)
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Verify password against hash — case-sensitive by default (bcrypt handles this)
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create a signed JWT token
export async function createToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

// Verify and decode a JWT token
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// Set session cookie (HTTP-only, secure, SameSite)
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });
}

// Get current session from cookie
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// Clear session cookie
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Verify session from request headers (for API routes)
export async function getSessionFromRequest(
  request: Request
): Promise<SessionPayload | null> {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  return verifyToken(match[1]);
}

// Require specific role — throws if unauthorized
export async function requireRole(
  request: Request,
  ...allowedRoles: UserRole[]
): Promise<SessionPayload> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new AuthError('Authentication required', 401);
  }
  if (!allowedRoles.includes(session.role)) {
    throw new AuthError('Insufficient permissions', 403);
  }
  return session;
}

export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}
