import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';

// GET /api/orders/stats — Get spending statistics for current user
export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { default: prisma } = await import('@/lib/prisma');

    // Get user's order statistics
    const [orderCount, pageSum, amountSum] = await Promise.all([
      prisma.order.count({
        where: {
          userId: session.userId,
          status: { notIn: ['CANCELLED', 'DRAFT'] },
        },
      }),
      prisma.order.aggregate({
        where: {
          userId: session.userId,
          status: { notIn: ['CANCELLED', 'DRAFT'] },
        },
        _sum: { pageCount: true },
      }),
      prisma.order.aggregate({
        where: {
          userId: session.userId,
          status: { notIn: ['CANCELLED', 'DRAFT'] },
        },
        _sum: { totalAmount: true },
      }),
    ]);

    return NextResponse.json({
      stats: {
        totalOrders: orderCount,
        totalPages: pageSum._sum.pageCount || 0,
        totalSpent: Number(amountSum._sum.totalAmount || 0),
      },
    });
  } catch (error) {
    console.error('Order stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
  }
}
