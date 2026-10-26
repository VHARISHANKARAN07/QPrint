import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, createToken, setSessionCookie, UserRole } from '@/lib/auth';
import { validateMobile, validatePassword, validateName, sanitizeInput } from '@/lib/validators';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, mobile, password, confirmPassword, department, section, rollNumber } = body;

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

    if (!department || typeof department !== 'string' || department.trim().length < 1) {
      return NextResponse.json({ error: 'Department is required' }, { status: 400 });
    }

    if (!section || typeof section !== 'string' || section.trim().length < 1) {
      return NextResponse.json({ error: 'Section is required' }, { status: 400 });
    }

    if (!rollNumber || typeof rollNumber !== 'string' || rollNumber.trim().length < 1) {
      return NextResponse.json({ error: 'Roll number is required' }, { status: 400 });
    }

    // Check if mobile number is already registered
    const existingUser = await prisma.user.findFirst({
      where: { mobile: mobile.trim(), role: UserRole.STUDENT },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'This mobile number is already registered.' },
        { status: 409 }
      );
    }

    // Hash password (case-sensitive - bcrypt preserves exact input)
    const passwordHash = await hashPassword(password);

    // Create student
    const student = await prisma.user.create({
      data: {
        role: UserRole.STUDENT,
        name: sanitizeInput(name),
        mobile: mobile.trim(),
        passwordHash,
        department: sanitizeInput(department),
        section: sanitizeInput(section),
        rollNumber: sanitizeInput(rollNumber),
      },
    });

    // Create audit log
    await createAuditLog({
      actorId: student.id,
      action: AuditActions.SIGNUP,
      entityType: EntityTypes.USER,
      entityId: student.id,
      newValue: { role: 'STUDENT', name: student.name, mobile: student.mobile },
    });

    // Create session token
    const token = await createToken({
      userId: student.id,
      role: UserRole.STUDENT,
      name: student.name,
      mobile: student.mobile!,
    });

    await setSessionCookie(token);

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
    console.error('Student signup error:', error);
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
