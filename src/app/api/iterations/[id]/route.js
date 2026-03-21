import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resultsDir } from '@/lib/engine';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const iterPath = path.join(resultsDir, `iteration_${id}.json`);
    if (fs.existsSync(iterPath)) {
      const data = JSON.parse(fs.readFileSync(iterPath, 'utf8'));
      return NextResponse.json(data);
    } else {
      return NextResponse.json({ error: 'Iteration not found' }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
