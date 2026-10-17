import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { calculatePrice } from '@/lib/pricing';
import { validatePageCount } from '@/lib/validators';

// POST /api/pricing/calculate — Calculate price for given page count
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pageCount } = body;

    const validation = validatePageCount(pageCount);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const pricing = await calculatePrice(pageCount);
    if (!pricing) {
      return NextResponse.json(
        { error: 'No applicable pricing tier found for this page count' },
        { status: 400 }
      );
    }

    return NextResponse.json({ pricing });
  } catch (error) {
    console.error('Price calculation error:', error);
    return NextResponse.json({ error: 'Failed to calculate price' }, { status: 500 });
  }
}
