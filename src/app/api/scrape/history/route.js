import { NextResponse } from 'next/server';
import { loadScrapeHistory, saveScrapeSession } from '@/lib/history';

export async function GET() {
  const history = loadScrapeHistory();
  return NextResponse.json({ success: true, history });
}

export async function POST(req) {
  try {
    const { metadata, events } = await req.json();
    const record = saveScrapeSession(metadata, events);
    return NextResponse.json({ success: true, record });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
