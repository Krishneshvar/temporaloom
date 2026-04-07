import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { datasetsDir } from '@/lib/engine';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const filename = file.name;

    // Validation
    if (!filename.endsWith('.txt')) {
      return NextResponse.json({ error: 'Only .txt graph files are supported' }, { status: 400 });
    }
    if (filename.includes('/') || filename.includes('..') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB cap
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds 50 MB limit' }, { status: 413 });
    }

    // Ensure datasets directory exists
    if (!fs.existsSync(datasetsDir)) {
      fs.mkdirSync(datasetsDir, { recursive: true });
    }

    const destPath = path.join(datasetsDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(destPath, buffer);

    return NextResponse.json({ success: true, filename, sizeBytes: file.size });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
