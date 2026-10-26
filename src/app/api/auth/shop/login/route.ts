import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, createToken, setSessionCookie, UserRole } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';

// Rate limiter for shop handler login
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes for shop handler

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const key = `shop:${clientIp}`;
    const attempts = loginAttempts.get(key);

    if (attempts && attempts.count >= MAX_ATTEMPTS) {
      const timeSince = Date.now() - attempts.lastAttempt;
      if (timeSince < LOCKOUT_MS) {
        const minutesLeft = Math.ceil((LOCKOUT_MS - timeSince) / 60000);
        return NextResponse.json(
          { error: `Too many login attempts. Try again in ${minutesLeft} minutes.` },
          { status: 429 }
        );
      }
      loginAttempts.delete(key);
    }

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // Find shop handler by EXACT username (case-sensitive: === comparison)
    // Prisma default string matching is case-sensitive in PostgreSQL
    const handler = await prisma.user.findFirst({
      where: {
        username: username, // Case-sensitive in PostgreSQL
        role: UserRole.SHOP_HANDLER,
      },
    });

    if (!handler) {
      const current = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
      loginAttempts.set(key, { count: current.count + 1, lastAttempt: Date.now() });
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Verify password (case-sensitive via bcrypt)
    const passwordMatch = await verifyPassword(password, handler.passwordHash);
    if (!passwordMatch) {
      const current = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
      loginAttempts.set(key, { count: current.count + 1, lastAttempt: Date.now() });
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    loginAttempts.delete(key);

    // Create session
    const token = await createToken({
      userId: handler.id,
      role: UserRole.SHOP_HANDLER,
      name: handler.name,
      username: handler.username!,
    });

    await setSessionCookie(token);

    await createAuditLog({
      actorId: handler.id,
      action: AuditActions.LOGIN,
      entityType: EntityTypes.USER,
      entityId: handler.id,
      newValue: { role: 'SHOP_HANDLER' },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: handler.id,
        name: handler.name,
        username: handler.username,
        role: handler.role,
      },
    });
  } catch (error) {
    console.error('Shop handler login error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
