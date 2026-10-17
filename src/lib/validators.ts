/**
 * Input validation utilities for Qprint
 */

// Indian 10-digit mobile number: starts with 6-9
const MOBILE_REGEX = /^[6-9]\d{9}$/;

export function validateMobile(mobile: string): { valid: boolean; error?: string } {
  if (!mobile || typeof mobile !== 'string') {
    return { valid: false, error: 'Mobile number is required' };
  }
  const cleaned = mobile.trim();
  if (!MOBILE_REGEX.test(cleaned)) {
    return { valid: false, error: 'Enter a valid 10-digit Indian mobile number' };
  }
  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password is too long' };
  }
  return { valid: true };
}

export function validateName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Name is required' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'Name is too long' };
  }
  return { valid: true };
}

export function validatePageCount(pages: number): { valid: boolean; error?: string } {
  if (pages === undefined || pages === null) {
    return { valid: false, error: 'Page count is required' };
  }
  if (!Number.isInteger(pages) || pages < 1) {
    return { valid: false, error: 'Page count must be a positive whole number' };
  }
  if (pages > 10000) {
    return { valid: false, error: 'Page count cannot exceed 10,000' };
  }
  return { valid: true };
}

export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '') // Basic XSS prevention
    .slice(0, 500);
}

/**
 * Valid order status transitions
 */
export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PDF_SENT', 'PAYMENT_PENDING', 'CANCELLED'],
  PDF_SENT: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING: ['PAYMENT_SUBMITTED', 'CANCELLED'],
  PAYMENT_SUBMITTED: ['PAYMENT_VERIFIED', 'PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_VERIFIED: ['CONFIRMED', 'WAITING', 'CANCELLED'],
  CONFIRMED: ['WAITING', 'CANCELLED'],
  WAITING: ['PRINTING', 'CANCELLED'],
  PRINTING: ['READY_FOR_COLLECTION', 'CANCELLED'],
  READY_FOR_COLLECTION: ['COLLECTED'],
  COLLECTED: [],
  CANCELLED: [],
};

export function isValidStatusTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  const validNext = VALID_STATUS_TRANSITIONS[currentStatus];
  if (!validNext) return false;
  return validNext.includes(newStatus);
}

/**
 * Generate unique order number: QP-YYYY-NNNNNN
 */
export function generateOrderNumber(sequenceNumber: number): string {
  const year = new Date().getFullYear();
  const padded = sequenceNumber.toString().padStart(6, '0');
  return `QP-${year}-${padded}`;
}
