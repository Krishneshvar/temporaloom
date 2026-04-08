import { NextResponse } from 'next/server';
import { getScrapeSession } from '@/lib/history';

export async function GET(req, { params }) {
  const { id } = await params;
  const events = getScrapeSession(id);
  if (!events) return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
  return NextResponse.json({ success: true, events });
}
