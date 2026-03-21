import { NextResponse } from 'next/server';
import fs from 'fs';
import { datasetsDir } from '@/lib/engine';

export async function GET() {
  try {
    if (!fs.existsSync(datasetsDir)) return NextResponse.json([]);
    
    const files = fs.readdirSync(datasetsDir).filter(f => f.endsWith('.txt'));
    return NextResponse.json(files);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
