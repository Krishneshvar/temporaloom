import { NextResponse } from 'next/server';
import { loadHistory, clearHistory } from '@/lib/history';

export async function GET() {
  return NextResponse.json(loadHistory());
}

export async function DELETE() {
  clearHistory();
  return NextResponse.json({ success: true });
}
