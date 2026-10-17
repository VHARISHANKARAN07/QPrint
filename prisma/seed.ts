import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Qprint database...');

  // 1. Create Shop Handler account (case-sensitive credentials)
  const shopUsername = process.env.SHOP_USERNAME || 'RITXeroxShop';
  const shopPassword = process.env.SHOP_PASSWORD || 'Rit@1432#';

  const existingHandler = await prisma.user.findFirst({
    where: { role: UserRole.SHOP_HANDLER, username: shopUsername },
  });

  if (!existingHandler) {
    const passwordHash = await bcrypt.hash(shopPassword, 12);
    await prisma.user.create({
      data: {
        role: UserRole.SHOP_HANDLER,
        name: 'Xerox Shop Handler',
        username: shopUsername, // Case-sensitive: RITXeroxShop
        passwordHash,
      },
    });
    console.log(`✅ Shop Handler created: username="${shopUsername}"`);
  } else {
    console.log('ℹ️  Shop Handler already exists, skipping...');
  }

  // 2. Create default pricing tiers (non-overlapping)
  const existingTiers = await prisma.pricingTier.count();
  if (existingTiers === 0) {
    await prisma.pricingTier.createMany({
      data: [
        {
          minimumPages: 1,
          maximumPages: 10,
          pricePerPage: 2.0,
          active: true,
          effectiveFrom: new Date(),
        },
        {
          minimumPages: 11,
          maximumPages: 50,
          pricePerPage: 1.5,
          active: true,
          effectiveFrom: new Date(),
        },
        {
          minimumPages: 51,
          maximumPages: 100,
          pricePerPage: 1.0,
          active: true,
          effectiveFrom: new Date(),
        },
        {
          minimumPages: 101,
          maximumPages: null, // 101+ (unlimited)
          pricePerPage: 0.75,
          active: true,
          effectiveFrom: new Date(),
        },
      ],
    });
    console.log('✅ Default pricing tiers created');
  } else {
    console.log('ℹ️  Pricing tiers already exist, skipping...');
  }

  // 3. Create default shop settings
  const existingSettings = await prisma.shopSettings.count();
  if (existingSettings === 0) {
    await prisma.shopSettings.create({
      data: {
        shopName: process.env.SHOP_NAME || 'RIT Xerox Shop',
        contactNumber: process.env.SHOP_CONTACT || '9876543210',
        upiId: process.env.SHOP_UPI_ID || 'ritxerox@upi',
        estimatedProcessingTime: 5,
      },
    });
    console.log('✅ Default shop settings created');
  } else {
    console.log('ℹ️  Shop settings already exist, skipping...');
  }

  console.log('🎉 Seeding complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
