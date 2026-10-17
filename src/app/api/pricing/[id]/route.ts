import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';
import { emitSocketEvent, SocketEvents } from '@/lib/socket-emitter';

// PATCH /api/pricing/[id] — Update a pricing tier
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'SHOP_HANDLER') {
      return NextResponse.json({ error: 'Shop handler access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { minimumPages, maximumPages, pricePerPage, active } = body;

    const existingTier = await prisma.pricingTier.findUnique({ where: { id } });
    if (!existingTier) {
      return NextResponse.json({ error: 'Pricing tier not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (minimumPages !== undefined) updateData.minimumPages = minimumPages;
    if (maximumPages !== undefined) updateData.maximumPages = maximumPages === '' || maximumPages === null ? null : maximumPages;
    if (pricePerPage !== undefined) updateData.pricePerPage = pricePerPage;
    if (active !== undefined) updateData.active = active;

    // Check for overlapping tiers if range is changing
    if (minimumPages !== undefined || maximumPages !== undefined) {
      const newMin = minimumPages ?? existingTier.minimumPages;
      const newMax = maximumPages === undefined
        ? existingTier.maximumPages
        : (maximumPages === '' || maximumPages === null ? null : maximumPages);

      const overlapping = await prisma.pricingTier.findMany({
        where: { active: true, id: { not: id } },
      });

      for (const tier of overlapping) {
        const tierMax = tier.maximumPages ?? Infinity;
        const checkMax = newMax ?? Infinity;

        if (newMin <= tierMax && checkMax >= tier.minimumPages) {
          return NextResponse.json(
            {
              error: `Range overlaps with existing tier: ${tier.minimumPages}-${tier.maximumPages || '+'} pages`,
            },
            { status: 400 }
          );
        }
      }
    }

    const updatedTier = await prisma.pricingTier.update({
      where: { id },
      data: updateData as any,
    });

    await createAuditLog({
      actorId: session.userId,
      action: active !== undefined ? AuditActions.PRICING_TIER_TOGGLED : AuditActions.PRICING_TIER_UPDATED,
      entityType: EntityTypes.PRICING_TIER,
      entityId: id,
      oldValue: {
        minimumPages: existingTier.minimumPages,
        maximumPages: existingTier.maximumPages,
        pricePerPage: Number(existingTier.pricePerPage),
        active: existingTier.active,
      },
      newValue: updateData,
    });

    await emitSocketEvent(SocketEvents.PRICING_UPDATED, {
      action: 'updated',
      tierId: id,
    });

    return NextResponse.json({
      success: true,
      tier: { ...updatedTier, pricePerPage: Number(updatedTier.pricePerPage) },
    });
  } catch (error) {
    console.error('Update pricing error:', error);
    return NextResponse.json({ error: 'Failed to update pricing tier' }, { status: 500 });
  }
}
