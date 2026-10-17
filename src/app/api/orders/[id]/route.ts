import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { isValidStatusTransition } from '@/lib/validators';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';
import { emitSocketEvent, SocketEvents, getQueuePositions } from '@/lib/socket-emitter';

// GET /api/orders/[id] — Get single order details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
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
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Enforce access control
    if (session.role !== 'SHOP_HANDLER' && order.userId !== session.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Calculate queue position
    let queuePosition = 0;
    let estimatedTime = 0;

    if (['PAYMENT_VERIFIED', 'CONFIRMED', 'WAITING', 'PRINTING'].includes(order.status)) {
      const queueData = await getQueuePositions();
      const position = queueData.orderPositions.find((p) => p.orderId === order.id);
      if (position) {
        queuePosition = position.position;
        estimatedTime = position.estimatedTime;
      }
    }

    return NextResponse.json({
      order: {
        ...order,
        pricePerPage: Number(order.pricePerPage),
        totalAmount: Number(order.totalAmount),
        payment: order.payment
          ? { ...order.payment, amount: Number(order.payment.amount) }
          : null,
        pricingTier: order.pricingTier
          ? { ...order.pricingTier, pricePerPage: Number(order.pricingTier.pricePerPage) }
          : null,
      },
      queuePosition,
      estimatedTime,
    });
  } catch (error) {
    console.error('Get order error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

// PATCH /api/orders/[id] — Update order status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status: newStatus, pdfSubmitted, pdfUrl, manualPriority } = body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Access control
    if (session.role !== 'SHOP_HANDLER' && order.userId !== session.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    // Handle status change
    if (newStatus) {
      // Only shop handler can set printing/completion statuses
      const shopOnlyStatuses = ['PRINTING', 'READY_FOR_COLLECTION', 'COLLECTED'];
      if (shopOnlyStatuses.includes(newStatus) && session.role !== 'SHOP_HANDLER') {
        return NextResponse.json(
          { error: 'Only the shop handler can update to this status' },
          { status: 403 }
        );
      }

      // Validate status transition
      if (!isValidStatusTransition(order.status, newStatus)) {
        return NextResponse.json(
          { error: `Cannot transition from ${order.status} to ${newStatus}` },
          { status: 400 }
        );
      }

      updateData.status = newStatus;

      // Set timestamps based on status
      if (newStatus === 'PRINTING') {
        updateData.printingStartedAt = new Date();
      } else if (newStatus === 'READY_FOR_COLLECTION') {
        updateData.completedAt = new Date();
      } else if (newStatus === 'COLLECTED') {
        updateData.collectedAt = new Date();
      }
    }

    // Handle PDF submission
    if (pdfSubmitted !== undefined) {
      updateData.pdfSubmitted = pdfSubmitted;
      if (pdfUrl) {
        updateData.pdfUrl = pdfUrl;
      }
    }

    // Handle manual priority (shop handler only)
    if (manualPriority !== undefined && session.role === 'SHOP_HANDLER') {
      updateData.manualPriority = manualPriority;

      await createAuditLog({
        actorId: session.userId,
        action: AuditActions.ORDER_MANUAL_PRIORITY,
        entityType: EntityTypes.ORDER,
        entityId: order.id,
        oldValue: { manualPriority: order.manualPriority },
        newValue: { manualPriority },
      });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData as any,
      include: {
        user: {
          select: { id: true, name: true, mobile: true, role: true },
        },
        payment: true,
      },
    });

    // Audit log for status change
    if (newStatus) {
      await createAuditLog({
        actorId: session.userId,
        action: AuditActions.ORDER_STATUS_CHANGE,
        entityType: EntityTypes.ORDER,
        entityId: order.id,
        oldValue: { status: order.status },
        newValue: { status: newStatus },
      });
    }

    if (pdfSubmitted) {
      await createAuditLog({
        actorId: session.userId,
        action: AuditActions.ORDER_PDF_SENT,
        entityType: EntityTypes.ORDER,
        entityId: order.id,
        newValue: { pdfSubmitted: true },
      });
    }

    // Emit real-time events
    const queueData = await getQueuePositions();

    await emitSocketEvent(SocketEvents.ORDER_STATUS_CHANGED, {
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      userId: updatedOrder.userId,
      userRole: updatedOrder.userRole,
      status: updatedOrder.status,
      previousStatus: order.status,
    });

    await emitSocketEvent(SocketEvents.QUEUE_UPDATED, queueData);

    // Send notification for important status changes
    if (newStatus === 'READY_FOR_COLLECTION') {
      await emitSocketEvent(SocketEvents.NOTIFICATION, {
        userId: updatedOrder.userId,
        title: '🎉 Your Print is Ready!',
        message: `Order ${updatedOrder.orderNumber} is ready for collection.`,
        type: 'success',
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
      });
    } else if (newStatus === 'PRINTING') {
      await emitSocketEvent(SocketEvents.NOTIFICATION, {
        userId: updatedOrder.userId,
        title: '🖨️ Printing Started',
        message: `Order ${updatedOrder.orderNumber} is now being printed.`,
        type: 'info',
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
      });
    } else if (newStatus === 'PAYMENT_VERIFIED') {
      await emitSocketEvent(SocketEvents.NOTIFICATION, {
        userId: updatedOrder.userId,
        title: '✅ Payment Verified',
        message: `Payment for order ${updatedOrder.orderNumber} has been verified.`,
        type: 'success',
        orderId: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
      });
    }

    return NextResponse.json({
      success: true,
      order: {
        ...updatedOrder,
        pricePerPage: Number(updatedOrder.pricePerPage),
        totalAmount: Number(updatedOrder.totalAmount),
        payment: updatedOrder.payment
          ? { ...updatedOrder.payment, amount: Number(updatedOrder.payment.amount) }
          : null,
      },
    });
  } catch (error) {
    console.error('Update order error:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}
