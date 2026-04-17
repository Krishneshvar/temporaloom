import { NextResponse } from 'next/server';
import os from 'os';
import { execSync } from 'child_process';

function getPhysicalCores() {
  try {
    // Linux: count unique (physical id, core id) pairs from /proc/cpuinfo
    const cpuinfo = execSync('grep -E "^physical id|^core id" /proc/cpuinfo', { timeout: 2000 }).toString();
    const lines = cpuinfo.trim().split('\n');
    const seen = new Set();
    let physId = '0';
    for (const line of lines) {
      if (line.startsWith('physical id')) physId = line.split(':')[1].trim();
      else if (line.startsWith('core id'))  seen.add(`${physId}-${line.split(':')[1].trim()}`);
    }
    if (seen.size > 0) return seen.size;
  } catch {}

  try {
    // macOS
    const val = parseInt(execSync('sysctl -n hw.physicalcpu', { timeout: 2000 }).toString().trim());
    if (val > 0) return val;
  } catch {}

  // Fallback: logical thread count
  return os.cpus().length;
}

export async function GET() {
  const physical = getPhysicalCores();
  const logical  = os.cpus().length;
  return NextResponse.json({ cores: physical, logical, threads: logical });
}
