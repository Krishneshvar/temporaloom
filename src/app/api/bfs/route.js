import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { engineDir } from '@/lib/engine';

const BFS_TIMEOUT_MS = 60_000;

function runBFS(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: engineDir });
    let stdoutData = '';
    let stderrData = '';
    let settled = false;

    const killAndResolve = (result) => {
      if (settled) return;
      settled = true;
      try { child.kill('SIGKILL'); } catch (_) {}
      resolve(result);
    };

    const timeout = setTimeout(() =>
      killAndResolve({ success: false, error: 'BFS timed out after 60s' }),
      BFS_TIMEOUT_MS
    );

    child.stdout.on('data', d => { stdoutData += d.toString(); });
    child.stderr.on('data', d => { stderrData += d.toString(); });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (code !== 0) {
        resolve({ success: false, error: stderrData.slice(0, 1000) });
        return;
      }
      try {
        const jsonStr = stdoutData.substring(stdoutData.indexOf('{'), stdoutData.lastIndexOf('}') + 1);
        if (jsonStr) resolve({ success: true, data: JSON.parse(jsonStr) });
        else resolve({ success: false, error: 'No JSON output from engine' });
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });

    child.on('error', err => { clearTimeout(timeout); killAndResolve({ success: false, error: err.message }); });
  });
}

export async function POST(request) {
  try {
    const { dataset, mode, processes, source } = await request.json();

    if (!dataset) {
      return NextResponse.json({ error: 'Dataset is required' }, { status: 400 });
    }

    const datasetPath = path.join('../datasets', dataset);
    const sourceNode = (source ?? 0).toString();
    const procCount  = (processes ?? 4).toString();

    let result;

    if (mode === 'bfs_mpi') {
      result = await runBFS('mpirun', [
        '--oversubscribe', '-np', procCount,
        './bfs_mpi', datasetPath, '-j', '-s', sourceNode
      ]);
    } else if (mode === 'bfs_omp') {
      result = await runBFS('./bfs_omp', [datasetPath, '-j', '-s', sourceNode, '-t', procCount]);
    } else {
      result = await runBFS('./bfs_seq', [datasetPath, '-j', '-s', sourceNode]);
    }

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: result.data });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
