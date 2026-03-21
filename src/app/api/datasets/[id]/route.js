import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { datasetsDir } from '@/lib/engine';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const filePath = path.join(datasetsDir, id);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return new Response(content, {
        headers: { 'Content-Type': 'text/plain' }
      });
    } else {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
