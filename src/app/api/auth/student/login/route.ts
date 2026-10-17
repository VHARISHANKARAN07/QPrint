import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, createToken, setSessionCookie } from '@/lib/auth';
import { validateMobile, validatePassword } from '@/lib/validators';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';
import { UserRole } from '@prisma/client';

// Simple in-memory rate limiter
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mobile, password } = body;

    // Rate limiting
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const key = `student:${clientIp}:${mobile}`;
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

    // Find student by mobile number (exact match, no case conversion)
    const student = await prisma.user.findFirst({
      where: { mobile: mobile.trim(), role: UserRole.STUDENT },
    });

    if (!student) {
      // Track failed attempt
      const current = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
      loginAttempts.set(key, { count: current.count + 1, lastAttempt: Date.now() });

      return NextResponse.json(
        { error: 'Invalid mobile number or password' },
        { status: 401 }
      );
    }

    // Verify password (case-sensitive — bcrypt compares exact bytes)
    const passwordMatch = await verifyPassword(password, student.passwordHash);
    if (!passwordMatch) {
      const current = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
      loginAttempts.set(key, { count: current.count + 1, lastAttempt: Date.now() });

      return NextResponse.json(
        { error: 'Invalid mobile number or password' },
        { status: 401 }
      );
    }

    // Clear login attempts on success
    loginAttempts.delete(key);

    // Create session token
    const token = await createToken({
      userId: student.id,
      role: UserRole.STUDENT,
      name: student.name,
      mobile: student.mobile!,
    });

    await setSessionCookie(token);

    // Audit log
    await createAuditLog({
      actorId: student.id,
      action: AuditActions.LOGIN,
      entityType: EntityTypes.USER,
      entityId: student.id,
      newValue: { role: 'STUDENT' },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: student.id,
        name: student.name,
        mobile: student.mobile,
        role: student.role,
        department: student.department,
        section: student.section,
        rollNumber: student.rollNumber,
      },
    });
  } catch (error) {
    console.error('Student login error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}
