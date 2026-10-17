import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, createToken, setSessionCookie } from '@/lib/auth';
import { validateMobile, validatePassword } from '@/lib/validators';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';
import { UserRole } from '@prisma/client';

// Simple in-memory rate limiter
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mobile, password } = body;

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const key = `teacher:${clientIp}:${mobile}`;
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

    // Validate inputs
    const mobileValidation = validateMobile(mobile);
    if (!mobileValidation.valid) {
      return NextResponse.json({ error: mobileValidation.error }, { status: 400 });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.error }, { status: 400 });
    }

    // Find teacher by mobile number (exact match)
    const teacher = await prisma.user.findFirst({
      where: { mobile: mobile.trim(), role: UserRole.TEACHER },
    });

    if (!teacher) {
      const current = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
      loginAttempts.set(key, { count: current.count + 1, lastAttempt: Date.now() });
      return NextResponse.json(
        { error: 'Invalid mobile number or password' },
        { status: 401 }
      );
    }

    // Verify password (case-sensitive)
    const passwordMatch = await verifyPassword(password, teacher.passwordHash);
    if (!passwordMatch) {
      const current = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
      loginAttempts.set(key, { count: current.count + 1, lastAttempt: Date.now() });
      return NextResponse.json(
        { error: 'Invalid mobile number or password' },
        { status: 401 }
      );
    }

    loginAttempts.delete(key);

    // Create session
    const token = await createToken({
      userId: teacher.id,
      role: UserRole.TEACHER,
      name: teacher.name,
      mobile: teacher.mobile!,
    });

    await setSessionCookie(token);

    await createAuditLog({
      actorId: teacher.id,
      action: AuditActions.LOGIN,
      entityType: EntityTypes.USER,
      entityId: teacher.id,
      newValue: { role: 'TEACHER' },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: teacher.id,
        name: teacher.name,
        mobile: teacher.mobile,
        role: teacher.role,
      },
    });
  } catch (error) {
    console.error('Teacher login error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
