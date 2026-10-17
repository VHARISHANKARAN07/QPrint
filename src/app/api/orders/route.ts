import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromRequest, AuthError } from '@/lib/auth';
import { calculatePrice } from '@/lib/pricing';
import { validatePageCount, generateOrderNumber, isValidStatusTransition } from '@/lib/validators';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';
import { emitSocketEvent, SocketEvents, getQueuePositions } from '@/lib/socket-emitter';

// POST /api/orders — Create a new order
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (session.role !== 'STUDENT' && session.role !== 'TEACHER') {
      return NextResponse.json({ error: 'Only students and teachers can create orders' }, { status: 403 });
    }

    const body = await request.json();
    const { pageCount } = body;

    // Validate page count
    const pageValidation = validatePageCount(pageCount);
    if (!pageValidation.valid) {
      return NextResponse.json({ error: pageValidation.error }, { status: 400 });
    }

    // Server-side price calculation (NEVER trust the client price)
    const pricing = await calculatePrice(pageCount);
    if (!pricing) {
      return NextResponse.json(
        { error: 'No applicable pricing tier found for this page count. Please contact the shop.' },
        { status: 400 }
      );
    }

    // Create order with price snapshot in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          userId: session.userId,
          userRole: session.role,
          pageCount,
          pricingTierId: pricing.tierId,
          appliedTierLabel: pricing.tierLabel,
          pricePerPage: pricing.pricePerPage,
          totalAmount: pricing.totalAmount,
          status: 'DRAFT',
          orderNumber: 'TEMP', // Will be updated
        },
      });

      // Generate unique order number using sequence number
      const orderNumber = generateOrderNumber(newOrder.sequenceNumber);

      // Update with the real order number
      const updatedOrder = await tx.order.update({
        where: { id: newOrder.id },
        data: { orderNumber },
      });

      // Create payment record
      await tx.payment.create({
        data: {
          orderId: newOrder.id,
          amount: pricing.totalAmount,
          paymentStatus: 'PAYMENT_PENDING',
        },
      });

      return updatedOrder;
    });

    // Audit log
    await createAuditLog({
      actorId: session.userId,
      action: AuditActions.ORDER_CREATED,
      entityType: EntityTypes.ORDER,
      entityId: order.id,
      newValue: {
        orderNumber: order.orderNumber,
        pageCount,
        pricePerPage: pricing.pricePerPage,
        totalAmount: pricing.totalAmount,
        tierLabel: pricing.tierLabel,
      },
    });

    // Emit real-time event
    await emitSocketEvent(SocketEvents.ORDER_CREATED, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: session.userId,
      userRole: session.role,
      status: order.status,
      pageCount,
      totalAmount: pricing.totalAmount,
    });

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        pageCount: order.pageCount,
        pricePerPage: Number(order.pricePerPage),
        totalAmount: Number(order.totalAmount),
        appliedTierLabel: order.appliedTierLabel,
        status: order.status,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create order. Please try again.' },
      { status: 500 }
    );
  }
}

// GET /api/orders — Get orders for current user (or all for shop handler)
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const role = searchParams.get('role'); // For shop handler filtering
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build where clause
    const where: Record<string, unknown> = {};

    // Students and teachers can only see their own orders
    if (session.role === 'STUDENT' || session.role === 'TEACHER') {
      where.userId = session.userId;
    }

    // Shop handler can filter by role
    if (session.role === 'SHOP_HANDLER' && role) {
      where.userRole = role;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    // Search by order number, name, or mobile
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { mobile: { contains: search } } },
      ];
    }

    // Date filtering
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, unknown>).lte = new Date(dateTo + 'T23:59:59.999Z');
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: where as any,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              mobile: true,
              department: true,
              section: true,
              rollNumber: true,
              role: true,
            },
          },
          payment: true,
          pricingTier: true,
        },
        orderBy: [
          { manualPriority: 'desc' },
          { createdAt: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where: where as any }),
    ]);

    // Serialize Decimal fields
    const serialized = orders.map((o) => ({
      ...o,
      pricePerPage: Number(o.pricePerPage),
      totalAmount: Number(o.totalAmount),
      payment: o.payment
        ? { ...o.payment, amount: Number(o.payment.amount) }
        : null,
      pricingTier: o.pricingTier
        ? { ...o.pricingTier, pricePerPage: Number(o.pricingTier.pricePerPage) }
        : null,
    }));

    return NextResponse.json({
      orders: serialized,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}
