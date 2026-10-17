import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';
import { emitSocketEvent, SocketEvents } from '@/lib/socket-emitter';

// GET /api/pricing — Get all pricing tiers
export async function GET(request: NextRequest) {
  try {
    const tiers = await prisma.pricingTier.findMany({
      orderBy: { minimumPages: 'asc' },
    });

    return NextResponse.json({
      tiers: tiers.map((t) => ({
        ...t,
        pricePerPage: Number(t.pricePerPage),
      })),
    });
  } catch (error) {
    console.error('Get pricing error:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 });
  }
}

// POST /api/pricing — Create a new pricing tier (shop handler only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'SHOP_HANDLER') {
      return NextResponse.json({ error: 'Shop handler access required' }, { status: 403 });
    }

    const body = await request.json();
    const { minimumPages, maximumPages, pricePerPage } = body;

    // Validate
    if (!minimumPages || minimumPages < 1) {
      return NextResponse.json({ error: 'Minimum pages must be at least 1' }, { status: 400 });
    }

    if (maximumPages !== null && maximumPages !== undefined && maximumPages < minimumPages) {
      return NextResponse.json(
        { error: 'Maximum pages must be greater than or equal to minimum pages' },
        { status: 400 }
      );
    }

    if (!pricePerPage || pricePerPage <= 0) {
      return NextResponse.json({ error: 'Price per page must be greater than 0' }, { status: 400 });
    }

    const maxPages = maximumPages === undefined || maximumPages === '' ? null : maximumPages;

    // Check for overlapping tiers
    const overlapping = await prisma.pricingTier.findMany({
      where: { active: true },
    });

    for (const tier of overlapping) {
      const tierMax = tier.maximumPages ?? Infinity;
      const newMax = maxPages ?? Infinity;

      if (minimumPages <= tierMax && newMax >= tier.minimumPages) {
        return NextResponse.json(
          {
            error: `Range overlaps with existing tier: ${tier.minimumPages}-${tier.maximumPages || '+'} pages @ ₹${tier.pricePerPage}/page`,
          },
          { status: 400 }
        );
      }
    }

    const tier = await prisma.pricingTier.create({
      data: {
        minimumPages,
        maximumPages: maxPages,
        pricePerPage,
        active: true,
        effectiveFrom: new Date(),
      },
    });

    await createAuditLog({
      actorId: session.userId,
      action: AuditActions.PRICING_TIER_CREATED,
      entityType: EntityTypes.PRICING_TIER,
      entityId: tier.id,
      newValue: { minimumPages, maximumPages: maxPages, pricePerPage },
    });

    await emitSocketEvent(SocketEvents.PRICING_UPDATED, {
      action: 'created',
      tierId: tier.id,
    });

    return NextResponse.json({
      success: true,
      tier: { ...tier, pricePerPage: Number(tier.pricePerPage) },
    });
  } catch (error) {
    console.error('Create pricing error:', error);
    return NextResponse.json({ error: 'Failed to create pricing tier' }, { status: 500 });
  }
}
