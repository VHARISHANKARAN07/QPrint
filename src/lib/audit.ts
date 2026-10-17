import prisma from './prisma';

/**
 * Create an audit log entry for tracking all significant actions
 */
export async function createAuditLog(params: {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        oldValue: params.oldValue ? JSON.stringify(params.oldValue) : null,
        newValue: params.newValue ? JSON.stringify(params.newValue) : null,
      },
    });
  } catch (error) {
    // Audit logging should never crash the main flow
    console.error('Failed to create audit log:', error);
  }
}

// Standard action names
export const AuditActions = {
  // Auth
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  SIGNUP: 'SIGNUP',
  PROFILE_UPDATE: 'PROFILE_UPDATE',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',

  // Orders
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_STATUS_CHANGE: 'ORDER_STATUS_CHANGE',
  ORDER_PDF_SENT: 'ORDER_PDF_SENT',
  ORDER_MANUAL_PRIORITY: 'ORDER_MANUAL_PRIORITY',

  // Payments
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  PAYMENT_VERIFIED: 'PAYMENT_VERIFIED',

  // Pricing
  PRICING_TIER_CREATED: 'PRICING_TIER_CREATED',
  PRICING_TIER_UPDATED: 'PRICING_TIER_UPDATED',
  PRICING_TIER_TOGGLED: 'PRICING_TIER_TOGGLED',

  // QR
  QR_UPLOADED: 'QR_UPLOADED',
  QR_REPLACED: 'QR_REPLACED',
  QR_DEACTIVATED: 'QR_DEACTIVATED',

  // Shop Settings
  SHOP_SETTINGS_UPDATED: 'SHOP_SETTINGS_UPDATED',
} as const;

export const EntityTypes = {
  USER: 'User',
  ORDER: 'Order',
  PAYMENT: 'Payment',
  PRICING_TIER: 'PricingTier',
  QR_HISTORY: 'QRHistory',
  SHOP_SETTINGS: 'ShopSettings',
} as const;
