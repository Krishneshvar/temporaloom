import { NextResponse } from 'next/server';
import { buildGraphFromWeb } from '@/lib/scraper';

export async function POST(request) {
  try {
    const { startUrl, maxDepth } = await request.json();
    
    if (!startUrl || maxDepth === undefined) {
      return NextResponse.json({ error: 'Missing startUrl or maxDepth parameters' }, { status: 400 });
    }
    
    try {
       new URL(startUrl); 
    } catch (e) {
       return NextResponse.json({ error: 'Invalid URL format provided' }, { status: 400 });
    }

    // Call the scraper utility
    const result = await buildGraphFromWeb(startUrl, parseInt(maxDepth));
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
