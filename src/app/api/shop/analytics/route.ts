import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';

// GET /api/shop/analytics — Shop analytics dashboard
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'SHOP_HANDLER') {
      return NextResponse.json({ error: 'Shop handler access required' }, { status: 403 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Today's stats
    const [todayOrders, todayVerifiedPayments, todayPendingOrders, todayPrintingOrders, todayReadyOrders] =
      await Promise.all([
        prisma.order.findMany({
          where: { createdAt: { gte: todayStart } },
        }),
        prisma.payment.aggregate({
          where: {
            paymentStatus: 'PAYMENT_VERIFIED',
            verifiedAt: { gte: todayStart },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.order.count({
          where: {
            status: { in: ['DRAFT', 'PDF_SENT', 'PAYMENT_PENDING', 'PAYMENT_SUBMITTED'] },
          },
        }),
        prisma.order.count({
          where: { status: 'PRINTING' },
        }),
        prisma.order.count({
          where: { status: 'READY_FOR_COLLECTION' },
        }),
      ]);

    const todayPages = todayOrders.reduce((sum, o) => sum + o.pageCount, 0);

    // Monthly stats
    const [monthOrders, monthVerifiedPayments] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: monthStart } },
      }),
      prisma.payment.aggregate({
        where: {
          paymentStatus: 'PAYMENT_VERIFIED',
          verifiedAt: { gte: monthStart },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const monthPages = monthOrders.reduce((sum, o) => sum + o.pageCount, 0);

    // Active queue count
    const activeQueueCount = await prisma.order.count({
      where: { status: { in: ['WAITING', 'PRINTING'] } },
    });

    return NextResponse.json({
      today: {
        totalOrders: todayOrders.length,
        totalPages: todayPages,
        totalEarnings: Number(todayVerifiedPayments._sum.amount || 0),
        pendingOrders: todayPendingOrders,
        printingOrders: todayPrintingOrders,
        readyForCollection: todayReadyOrders,
      },
      month: {
        totalOrders: monthOrders.length,
        totalPages: monthPages,
        totalEarnings: Number(monthVerifiedPayments._sum.amount || 0),
      },
      activeQueue: activeQueueCount,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
