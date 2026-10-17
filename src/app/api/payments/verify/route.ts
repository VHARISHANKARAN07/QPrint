import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';
import { emitSocketEvent, SocketEvents, getQueuePositions } from '@/lib/socket-emitter';

// POST /api/payments/verify — Shop handler verifies a payment
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'SHOP_HANDLER') {
      return NextResponse.json({ error: 'Shop handler access required' }, { status: 403 });
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payment: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!order.payment) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    if (order.payment.paymentStatus !== 'PAYMENT_SUBMITTED') {
      return NextResponse.json(
        { error: 'Payment must be submitted before verification' },
        { status: 400 }
      );
    }

    // Verify payment and move order to WAITING queue
    const [updatedPayment, updatedOrder] = await prisma.$transaction([
      prisma.payment.update({
        where: { id: order.payment.id },
        data: {
          paymentStatus: 'PAYMENT_VERIFIED',
          verifiedAt: new Date(),
          verifiedBy: session.userId,
        },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { status: 'WAITING' },
      }),
    ]);

    // Audit log
    await createAuditLog({
      actorId: session.userId,
      action: AuditActions.PAYMENT_VERIFIED,
      entityType: EntityTypes.PAYMENT,
      entityId: updatedPayment.id,
      oldValue: { paymentStatus: 'PAYMENT_SUBMITTED' },
      newValue: { paymentStatus: 'PAYMENT_VERIFIED', verifiedBy: session.userId },
    });

    // Get updated queue
    const queueData = await getQueuePositions();

    // Emit events
    await emitSocketEvent(SocketEvents.PAYMENT_VERIFIED, {
      orderId,
      orderNumber: order.orderNumber,
      userId: order.userId,
      userRole: order.userRole,
      paymentStatus: 'PAYMENT_VERIFIED',
    });

    await emitSocketEvent(SocketEvents.ORDER_STATUS_CHANGED, {
      orderId,
      orderNumber: order.orderNumber,
      userId: order.userId,
      userRole: order.userRole,
      status: 'WAITING',
      previousStatus: order.status,
    });

    await emitSocketEvent(SocketEvents.QUEUE_UPDATED, queueData);

    await emitSocketEvent(SocketEvents.NOTIFICATION, {
      userId: order.userId,
      title: '✅ Payment Verified',
      message: `Payment for order ${order.orderNumber} has been verified. Your order is now in the queue.`,
      type: 'success',
      orderId,
      orderNumber: order.orderNumber,
    });

    return NextResponse.json({
      success: true,
      payment: {
        ...updatedPayment,
        amount: Number(updatedPayment.amount),
      },
    });
  } catch (error) {
    console.error('Payment verify error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
