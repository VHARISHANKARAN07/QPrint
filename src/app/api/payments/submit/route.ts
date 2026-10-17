import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';
import { emitSocketEvent, SocketEvents, getQueuePositions } from '@/lib/socket-emitter';

// POST /api/payments/submit — Mark payment as submitted
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, paymentReference } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Find the order and verify ownership
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (session.role !== 'SHOP_HANDLER' && order.userId !== session.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!order.payment) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    // Update payment status to SUBMITTED
    const updatedPayment = await prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        paymentStatus: 'PAYMENT_SUBMITTED',
        paymentReference: paymentReference || null,
        paymentTimestamp: new Date(),
      },
    });

    // Update order status to PAYMENT_SUBMITTED
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'PAYMENT_SUBMITTED' },
    });

    // Audit log
    await createAuditLog({
      actorId: session.userId,
      action: AuditActions.PAYMENT_SUBMITTED,
      entityType: EntityTypes.PAYMENT,
      entityId: updatedPayment.id,
      newValue: {
        orderId,
        paymentReference,
        paymentStatus: 'PAYMENT_SUBMITTED',
      },
    });

    // Emit events
    await emitSocketEvent(SocketEvents.PAYMENT_SUBMITTED, {
      orderId,
      orderNumber: order.orderNumber,
      userId: order.userId,
      userRole: order.userRole,
      paymentStatus: 'PAYMENT_SUBMITTED',
    });

    return NextResponse.json({
      success: true,
      payment: {
        ...updatedPayment,
        amount: Number(updatedPayment.amount),
      },
    });
  } catch (error) {
    console.error('Payment submit error:', error);
    return NextResponse.json(
      { error: 'Failed to submit payment' },
      { status: 500 }
    );
  }
}
