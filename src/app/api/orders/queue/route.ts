import { NextRequest, NextResponse } from 'next/server';
import { getQueuePositions } from '@/lib/socket-emitter';

// GET /api/orders/queue — Get current queue status
export async function GET() {
  try {
    const queueData = await getQueuePositions();
    return NextResponse.json(queueData);
  } catch (error) {
    console.error('Queue error:', error);
    return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
  }
}
