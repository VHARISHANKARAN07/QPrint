import prisma from './prisma';
import { Decimal } from '@prisma/client/runtime/library';

export interface PricingResult {
  tierId: string;
  tierLabel: string;
  pricePerPage: number;
  totalAmount: number;
  pageCount: number;
}

/**
 * Find the applicable pricing tier for the given page count
 * Uses flat pricing: Total = Pages × Applicable Tier Rate
 */
export async function calculatePrice(pageCount: number): Promise<PricingResult | null> {
  if (!pageCount || pageCount < 1 || !Number.isInteger(pageCount)) {
    return null;
  }

  // Find active tier where pageCount falls within [minimumPages, maximumPages]
  // maximumPages = null means unlimited (101+)
  const tier = await prisma.pricingTier.findFirst({
    where: {
      active: true,
      minimumPages: { lte: pageCount },
      OR: [
        { maximumPages: { gte: pageCount } },
        { maximumPages: null }, // Unlimited upper bound
      ],
    },
    orderBy: { minimumPages: 'desc' }, // Pick the most specific tier
  });

  if (!tier) {
    return null;
  }

  const pricePerPage = Number(tier.pricePerPage);
  const totalAmount = Math.round(pageCount * pricePerPage * 100) / 100; // Round to 2 decimal places

  const maxLabel = tier.maximumPages ? tier.maximumPages.toString() : '+';
  const tierLabel = `${tier.minimumPages}-${maxLabel} pages`;

  return {
    tierId: tier.id,
    tierLabel,
    pricePerPage,
    totalAmount,
    pageCount,
  };
}

/**
 * Validate that pricing tiers don't overlap
 * Returns error message if overlapping, null if valid
 */
export async function validateTierRange(
  minimumPages: number,
  maximumPages: number | null,
  excludeTierId?: string
): Promise<string | null> {
  if (minimumPages < 1) {
    return 'Minimum pages must be at least 1';
  }

  if (maximumPages !== null && maximumPages < minimumPages) {
    return 'Maximum pages must be greater than or equal to minimum pages';
  }

  // Find any active tier that overlaps with the proposed range
  const overlapping = await prisma.pricingTier.findFirst({
    where: {
      active: true,
      id: excludeTierId ? { not: excludeTierId } : undefined,
      AND: [
        {
          OR: [
            // Case 1: Existing tier's min falls within new range
            {
              minimumPages: {
                gte: minimumPages,
                ...(maximumPages !== null ? { lte: maximumPages } : {}),
              },
            },
            // Case 2: New range's min falls within existing tier
            {
              minimumPages: { lte: minimumPages },
              OR: [
                { maximumPages: { gte: minimumPages } },
                { maximumPages: null },
              ],
            },
          ],
        },
      ],
    },
  });

  if (overlapping) {
    const maxLabel = overlapping.maximumPages
      ? overlapping.maximumPages.toString()
      : '+';
    return `Range overlaps with existing tier: ${overlapping.minimumPages}-${maxLabel} pages @ ₹${overlapping.pricePerPage}/page`;
  }

  return null;
}

/**
 * Get all pricing tiers for display
 */
export async function getAllPricingTiers() {
  return prisma.pricingTier.findMany({
    orderBy: { minimumPages: 'asc' },
  });
}

/**
 * Get only active pricing tiers
 */
export async function getActivePricingTiers() {
  return prisma.pricingTier.findMany({
    where: { active: true },
    orderBy: { minimumPages: 'asc' },
  });
}
