import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionFromRequest } from '@/lib/auth';
import { createAuditLog, AuditActions, EntityTypes } from '@/lib/audit';
import { emitSocketEvent, SocketEvents } from '@/lib/socket-emitter';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || (process.env.VERCEL ? '/tmp/uploads' : './uploads');
const MAX_QR_SIZE = 5 * 1024 * 1024; // 5MB for QR images
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// GET /api/shop/qr — Get current active QR and history
export async function GET(request: NextRequest) {
  try {
    const activeQr = await prisma.qRHistory.findFirst({
      where: { active: true },
      orderBy: { uploadedAt: 'desc' },
    });

    const session = await getSessionFromRequest(request);

    // Only shop handler can see full history
    let history: any[] = [];
    if (session?.role === 'SHOP_HANDLER') {
      history = await prisma.qRHistory.findMany({
        orderBy: { uploadedAt: 'desc' },
        include: {
          uploader: { select: { name: true } },
        },
      });
    }

    return NextResponse.json({
      activeQr: activeQr
        ? {
            id: activeQr.id,
            fileReference: activeQr.fileReference,
            uploadedAt: activeQr.uploadedAt,
          }
        : null,
      history,
    });
  } catch (error) {
    console.error('Get QR error:', error);
    return NextResponse.json({ error: 'Failed to fetch QR data' }, { status: 500 });
  }
}

// POST /api/shop/qr — Upload new QR code (shop handler only)
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session || session.role !== 'SHOP_HANDLER') {
      return NextResponse.json({ error: 'Shop handler access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('qrImage') as File;

    if (!file) {
      return NextResponse.json({ error: 'QR image file is required' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PNG, JPG, JPEG, WebP' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_QR_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size: 5MB' },
        { status: 400 }
      );
    }

    // Create upload directory
    const qrDir = path.join(UPLOAD_DIR, 'qr');
    await mkdir(qrDir, { recursive: true });

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png';
    const filename = `qr_${uuidv4()}.${ext}`;
    const filepath = path.join(qrDir, filename);
    const fileReference = `/uploads/qr/${filename}`;

    // Write file to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Deactivate all existing QR codes
    await prisma.qRHistory.updateMany({
      where: { active: true },
      data: {
        active: false,
        deactivatedAt: new Date(),
      },
    });

    // Create new QR history entry
    const newQr = await prisma.qRHistory.create({
      data: {
        fileReference,
        uploadedBy: session.userId,
        active: true,
      },
    });

    // Update shop settings
    await prisma.shopSettings.updateMany({
      data: { activeQrReference: fileReference },
    });

    // Audit log
    await createAuditLog({
      actorId: session.userId,
      action: AuditActions.QR_UPLOADED,
      entityType: EntityTypes.QR_HISTORY,
      entityId: newQr.id,
      newValue: { fileReference, active: true },
    });

    // Emit event so all users get the new QR
    await emitSocketEvent(SocketEvents.QR_UPDATED, {
      qrId: newQr.id,
      fileReference,
    });

    return NextResponse.json({
      success: true,
      qr: {
        id: newQr.id,
        fileReference: newQr.fileReference,
        uploadedAt: newQr.uploadedAt,
        active: newQr.active,
      },
    });
  } catch (error) {
    console.error('QR upload error:', error);
    return NextResponse.json({ error: 'Failed to upload QR image' }, { status: 500 });
  }
}
