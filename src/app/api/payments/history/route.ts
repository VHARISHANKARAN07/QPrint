import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

// GET /api/payments/history — Payment history with daily/monthly aggregation
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today'; // today, yesterday, week, month, custom
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Date range calculation
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'custom':
        startDate = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = dateTo ? new Date(dateTo + 'T23:59:59.999Z') : endDate;
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Build where clause
    const where: Record<string, unknown> = {
      paymentStatus: 'PAYMENT_VERIFIED',
      verifiedAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // Students/teachers only see their own
    if (session.role !== 'SHOP_HANDLER') {
      where.order = { userId: session.userId };
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: where as any,
        include: {
          order: {
            include: {
              user: {
                select: { name: true, mobile: true, role: true },
              },
            },
          },
        },
        orderBy: { verifiedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where: where as any }),
    ]);

    // Calculate aggregates
    const aggregates = await prisma.payment.aggregate({
      where: where as any,
      _sum: { amount: true },
      _count: { id: true },
    });

    // Calculate total pages from orders
    const orderIds = payments.map((p) => p.orderId);
    const pageSum = await prisma.order.aggregate({
      where: { id: { in: orderIds } },
      _sum: { pageCount: true },
    });

    const serialized = payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
      order: {
        ...p.order,
        pricePerPage: Number(p.order.pricePerPage),
        totalAmount: Number(p.order.totalAmount),
      },
    }));

    return NextResponse.json({
      payments: serialized,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalOrders: aggregates._count.id,
        totalAmount: Number(aggregates._sum.amount || 0),
        totalPages: pageSum._sum.pageCount || 0,
      },
    });
  } catch (error) {
    console.error('Payment history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment history' },
      { status: 500 }
    );
  }
}
