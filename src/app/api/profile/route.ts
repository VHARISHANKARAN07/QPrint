import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromRequest, verifyPassword, hashPassword } from '@/lib/auth';
import { validateName, validateMobile, validatePassword, sanitizeInput } from '@/lib/validators';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';

// GET /api/profile — Get current user profile
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        role: true,
        mobile: true,
        department: true,
        section: true,
        rollNumber: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PATCH /api/profile — Update profile (requires current password)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, name, mobile, department, section, rollNumber, newPassword } = body;

    // Current password is REQUIRED to make any profile changes
    if (!currentPassword) {
      return NextResponse.json(
        { error: 'Current password is required to edit profile' },
        { status: 400 }
      );
    }

    // Fetch user with password hash
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify current password
    const passwordMatch = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    const updateData: Record<string, unknown> = {};
    const oldValues: Record<string, unknown> = {};

    if (name) {
      const nameValidation = validateName(name);
      if (!nameValidation.valid) {
        return NextResponse.json({ error: nameValidation.error }, { status: 400 });
      }
      oldValues.name = user.name;
      updateData.name = sanitizeInput(name);
    }

    if (mobile) {
      const mobileValidation = validateMobile(mobile);
      if (!mobileValidation.valid) {
        return NextResponse.json({ error: mobileValidation.error }, { status: 400 });
      }
      // Check uniqueness
      const existingMobile = await prisma.user.findFirst({
        where: {
          mobile: mobile.trim(),
          role: user.role,
          id: { not: user.id },
        },
      });
      if (existingMobile) {
        return NextResponse.json(
          { error: 'This mobile number is already registered.' },
          { status: 409 }
        );
      }
      oldValues.mobile = user.mobile;
      updateData.mobile = mobile.trim();
    }

    if (department !== undefined && session.role === 'STUDENT') {
      oldValues.department = user.department;
      updateData.department = sanitizeInput(department);
    }

    if (section !== undefined && session.role === 'STUDENT') {
      oldValues.section = user.section;
      updateData.section = sanitizeInput(section);
    }

    if (rollNumber !== undefined && session.role === 'STUDENT') {
      oldValues.rollNumber = user.rollNumber;
      updateData.rollNumber = sanitizeInput(rollNumber);
    }

    if (newPassword) {
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.valid) {
        return NextResponse.json({ error: passwordValidation.error }, { status: 400 });
      }
      updateData.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: session.userId },
      data: updateData as any,
      select: {
        id: true,
        name: true,
        role: true,
        mobile: true,
        department: true,
        section: true,
        rollNumber: true,
      },
    });

    // Audit log
    await createAuditLog({
      actorId: session.userId,
      action: newPassword ? AuditActions.PASSWORD_CHANGE : AuditActions.PROFILE_UPDATE,
      entityType: EntityTypes.USER,
      entityId: session.userId,
      oldValue: oldValues,
      newValue: Object.fromEntries(
        Object.entries(updateData).filter(([key]) => key !== 'passwordHash')
      ),
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
