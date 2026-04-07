import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { datasetsDir } from '@/lib/engine';

function parseGraphStats(content) {
  const lines = content.split('\n');
  let nodes = 0, edges = 0, headerRead = false;
  const degreeMap = new Map();

  for (const line of lines) {
    if (!line.trim() || line.startsWith('#')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 2) continue;
    const a = parseInt(parts[0]);
    const b = parseInt(parts[1]);
    if (isNaN(a) || isNaN(b)) continue;

    if (!headerRead) {
      // First non-comment 2-number line is the N M header
      nodes = a;
      edges = b;
      headerRead = true;
      continue;
    }

    // Count degree
    degreeMap.set(a, (degreeMap.get(a) || 0) + 1);
  }

  const degrees = Array.from(degreeMap.values());
  const avgDegree = degrees.length ? (degrees.reduce((s, d) => s + d, 0) / degrees.length) : 0;
  const maxDegree = degrees.length ? Math.max(...degrees) : 0;
  const density = nodes > 1 ? (edges / (nodes * (nodes - 1))) : 0;

  return { nodes, edges, avgDegree: parseFloat(avgDegree.toFixed(2)), maxDegree, density: parseFloat(density.toFixed(6)) };
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Strip ?stats query to check for stats-only request
    const { searchParams } = new URL(request.url);
    const statsOnly = searchParams.get('stats') === '1';

    const filePath = path.join(datasetsDir, id);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    if (statsOnly) {
      const stat = fs.statSync(filePath);
      const content = fs.readFileSync(filePath, 'utf8');
      const graphStats = parseGraphStats(content);
      return NextResponse.json({
        name: id,
        sizeBytes: stat.size,
        modified: stat.mtime,
        ...graphStats,
      });
    }

    // Default: return raw file content for GraphViewer
    const content = fs.readFileSync(filePath, 'utf8');
    return new Response(content, { headers: { 'Content-Type': 'text/plain' } });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    // Safety: only allow .txt files
    if (!id.endsWith('.txt') || id.includes('/') || id.includes('..')) {
      return NextResponse.json({ error: 'Invalid dataset name' }, { status: 400 });
    }

    const filePath = path.join(datasetsDir, id);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });
    }

    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
