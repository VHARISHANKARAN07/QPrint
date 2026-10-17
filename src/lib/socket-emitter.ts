/**
 * Socket.IO event emitter for real-time updates
 * This module provides a way for API routes to emit events
 * to connected Socket.IO clients via the custom server
 */

// Socket event types
export const SocketEvents = {
  // Order events
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_STATUS_CHANGED: 'order:statusChanged',

  // Queue events
  QUEUE_UPDATED: 'queue:updated',

  // Payment events
  PAYMENT_SUBMITTED: 'payment:submitted',
  PAYMENT_VERIFIED: 'payment:verified',

  // Pricing events
  PRICING_UPDATED: 'pricing:updated',

  // Shop events
  SHOP_SETTINGS_UPDATED: 'shop:settingsUpdated',
  QR_UPDATED: 'shop:qrUpdated',

  // Notification events
  NOTIFICATION: 'notification',
} as const;

export interface OrderUpdatePayload {
  orderId: string;
  orderNumber: string;
  userId: string;
  userRole: string;
  status: string;
  previousStatus?: string;
  queuePosition?: number;
  estimatedTime?: number;
}

export interface QueueUpdatePayload {
  activeOrders: number;
  orderPositions: Array<{
    orderId: string;
    orderNumber: string;
    userId: string;
    position: number;
    estimatedTime: number;
  }>;
}

export interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  orderId?: string;
  orderNumber?: string;
}

/**
 * Emit event to the Socket.IO server via internal HTTP call
 * The custom server.ts exposes an internal endpoint for this
 */
export async function emitSocketEvent(
  event: string,
  data: unknown
): Promise<void> {
  try {
    const socketPort = process.env.SOCKET_PORT || '3001';
    const response = await fetch(`http://localhost:${socketPort}/internal/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data }),
    });
    if (!response.ok) {
      console.error('Socket emit failed:', response.statusText);
    }
  } catch (error) {
    // Socket emission should not crash the API route
    console.error('Socket emit error:', error);
  }
}

/**
 * Calculate queue positions for all active orders
 */
export async function getQueuePositions(): Promise<QueueUpdatePayload> {
  // Import prisma dynamically to avoid circular deps
  const { default: prisma } = await import('./prisma');

  const activeOrders = await prisma.order.findMany({
    where: {
      status: {
        in: ['PAYMENT_VERIFIED', 'CONFIRMED', 'WAITING', 'PRINTING'],
      },
    },
    orderBy: [
      { manualPriority: 'desc' },
      { createdAt: 'asc' },
    ],
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  const settings = await prisma.shopSettings.findFirst();
  const estTimePerOrder = settings?.estimatedProcessingTime || 5;

  const orderPositions = activeOrders.map((order, index) => ({
    orderId: order.id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    position: index + 1,
    estimatedTime: (index + 1) * estTimePerOrder,
  }));

  return {
    activeOrders: activeOrders.length,
    orderPositions,
  };
}
