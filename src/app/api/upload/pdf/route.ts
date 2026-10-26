import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || (process.env.VERCEL ? '/tmp/uploads' : './uploads');
const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25MB

// POST /api/upload/pdf — Upload a PDF file
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
      return NextResponse.json({ error: 'PDF file is required' }, { status: 400 });
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size: 25MB' }, { status: 400 });
    }

    // Read bytes and check PDF magic bytes (%PDF-)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const header = buffer.subarray(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      return NextResponse.json({ error: 'Invalid PDF file' }, { status: 400 });
    }

    // Create upload directory
    const pdfDir = path.join(UPLOAD_DIR, 'pdfs');
    await mkdir(pdfDir, { recursive: true });

    // Generate unique filename
    const filename = `pdf_${uuidv4()}.pdf`;
    const filepath = path.join(pdfDir, filename);
    const fileReference = `/uploads/pdfs/${filename}`;

    await writeFile(filepath, buffer);

    return NextResponse.json({
      success: true,
      fileReference,
      filename: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    return NextResponse.json({ error: 'Failed to upload PDF' }, { status: 500 });
  }
}
