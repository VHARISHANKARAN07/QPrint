import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';
import { emitSocketEvent, SocketEvents } from '@/lib/socket-emitter';

// GET /api/shop/settings — Get shop settings
export async function GET() {
  try {
    let settings = await prisma.shopSettings.findFirst();
    if (!settings) {
      settings = await prisma.shopSettings.create({
        data: {
          shopName: 'RIT Xerox Shop',
          contactNumber: '9876543210',
          upiId: 'ritxerox@upi',
          estimatedProcessingTime: 5,
        },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Get shop settings error:', error);
    return NextResponse.json({ error: 'Failed to fetch shop settings' }, { status: 500 });
  }
}

// PATCH /api/shop/settings — Update shop settings (shop handler only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'SHOP_HANDLER') {
      return NextResponse.json({ error: 'Shop handler access required' }, { status: 403 });
    }

    const body = await request.json();
    const { shopName, contactNumber, upiId, estimatedProcessingTime } = body;

    const settings = await prisma.shopSettings.findFirst();
    if (!settings) {
      return NextResponse.json({ error: 'Shop settings not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const oldValues: Record<string, unknown> = {};

    if (shopName !== undefined) {
      oldValues.shopName = settings.shopName;
      updateData.shopName = shopName;
    }
    if (contactNumber !== undefined) {
      oldValues.contactNumber = settings.contactNumber;
      updateData.contactNumber = contactNumber;
    }
    if (upiId !== undefined) {
      oldValues.upiId = settings.upiId;
      updateData.upiId = upiId;
    }
    if (estimatedProcessingTime !== undefined) {
      if (estimatedProcessingTime < 1 || estimatedProcessingTime > 120) {
        return NextResponse.json(
          { error: 'Estimated processing time must be between 1 and 120 minutes' },
          { status: 400 }
        );
      }
      oldValues.estimatedProcessingTime = settings.estimatedProcessingTime;
      updateData.estimatedProcessingTime = estimatedProcessingTime;
    }

    const updatedSettings = await prisma.shopSettings.update({
      where: { id: settings.id },
      data: updateData as any,
    });

    await createAuditLog({
      actorId: session.userId,
      action: AuditActions.SHOP_SETTINGS_UPDATED,
      entityType: EntityTypes.SHOP_SETTINGS,
      entityId: settings.id,
      oldValue: oldValues,
      newValue: updateData,
    });

    await emitSocketEvent(SocketEvents.SHOP_SETTINGS_UPDATED, {
      settings: updatedSettings,
    });

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('Update shop settings error:', error);
    return NextResponse.json({ error: 'Failed to update shop settings' }, { status: 500 });
  }
}
