import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, createToken, setSessionCookie, UserRole } from '@/lib/auth';
import { validateMobile, validatePassword, validateName, sanitizeInput } from '@/lib/validators';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, mobile, password, confirmPassword } = body;

    // Validate all required fields
    const nameValidation = validateName(name);
    if (!nameValidation.valid) {
      return NextResponse.json({ error: nameValidation.error }, { status: 400 });
    }

    const mobileValidation = validateMobile(mobile);
    if (!mobileValidation.valid) {
      return NextResponse.json({ error: mobileValidation.error }, { status: 400 });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.error }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    }

    // Check if mobile number is already registered for teacher role
    const existingUser = await prisma.user.findFirst({
      where: { mobile: mobile.trim(), role: UserRole.TEACHER },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'This mobile number is already registered.' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create teacher
    const teacher = await prisma.user.create({
      data: {
        role: UserRole.TEACHER,
        name: sanitizeInput(name),
        mobile: mobile.trim(),
        passwordHash,
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: teacher.id,
      action: AuditActions.SIGNUP,
      entityType: EntityTypes.USER,
      entityId: teacher.id,
      newValue: { role: 'TEACHER', name: teacher.name, mobile: teacher.mobile },
    });

    // Create session token
    const token = await createToken({
      userId: teacher.id,
      role: UserRole.TEACHER,
      name: teacher.name,
      mobile: teacher.mobile!,
    });

    await setSessionCookie(token);

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
    console.error('Teacher signup error:', error);
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
