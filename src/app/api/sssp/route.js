import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { engineDir } from '@/lib/engine';

const SSSP_TIMEOUT_MS = 60_000;

export async function POST(request) {
  try {
    const { dataset, source = 0, target = -1, mode = 'sssp_seq', processes = 4 } = await request.json();
    if (!dataset) return NextResponse.json({ error: 'Dataset required' }, { status: 400 });

    const datasetPath = path.join('../datasets', dataset);
    const args = [datasetPath, '-j', '-s', String(source)];
    if (target >= 0) args.push('-t', String(target));

    let cmd = './sssp_seq';
    if (mode === 'sssp_omp') {
      cmd = './sssp_omp';
      args.push('-p', String(processes));
    }

    const child = spawn(cmd, args, { cwd: engineDir });
    let stdout = '', stderr = '', settled = false;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (settled) return; settled = true;
        try { child.kill('SIGKILL'); } catch (_) {}
        resolve(NextResponse.json({ success: false, error: 'SSSP timed out' }, { status: 504 }));
      }, SSSP_TIMEOUT_MS);

      child.stdout.on('data', d => { stdout += d; });
      child.stderr.on('data', d => { stderr += d; });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (settled) return; settled = true;
        if (code !== 0) { resolve(NextResponse.json({ success: false, error: stderr.slice(0, 500) }, { status: 500 })); return; }
        try {
          const jsonStr = stdout.substring(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1);
          resolve(NextResponse.json({ success: true, data: JSON.parse(jsonStr) }));
        } catch (e) { resolve(NextResponse.json({ success: false, error: e.message }, { status: 500 })); }
      });

      child.on('error', err => { clearTimeout(timeout); if (!settled) { settled = true; resolve(NextResponse.json({ success: false, error: err.message }, { status: 500 })); } });
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
