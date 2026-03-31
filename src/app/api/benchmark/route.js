import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { engineDir, cleanResultsDir } from '@/lib/engine';

const runMode = (cmd, args) => {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: engineDir });
    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ success: false, error: stderrData, code });
        return;
      }
      try {
        const jsonStr = stdoutData.substring(stdoutData.indexOf('{'), stdoutData.lastIndexOf('}') + 1);
        if (jsonStr) {
          resolve({ success: true, data: JSON.parse(jsonStr) });
        } else {
          resolve({ success: false, error: 'No JSON output' });
        }
      } catch (e) {
        resolve({ success: false, error: e.message });
      }
    });
  });
};

export async function POST(request) {
  try {
    const { dataset, processes } = await request.json();
    
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset is required' }, { status: 400 });
    }

    const datasetPath = path.join('../datasets', dataset);
    cleanResultsDir();

    const procCount = (processes || 4).toString();

    // 1. CPU Sequential
    const cpuSeqRes = await runMode('./pagerank_seq', [datasetPath, '-j']);
    
    // 2. CPU Parallel
    const cpuParRes = await runMode('mpirun', ['--oversubscribe', '-np', procCount, './pagerank_mpi', datasetPath, '-j']);
    
    // 3. GPU Sequential
    const gpuSeqRes = await runMode('./pagerank_cuda_seq', [datasetPath, '-j']);
    
    // 4. GPU Parallel
    const gpuParRes = await runMode('./pagerank_cuda_par', [datasetPath, '-j']);

    const results = [
      { id: 'cpu_seq', name: 'CPU Sequential', data: cpuSeqRes.data, error: cpuSeqRes.error },
      { id: 'cpu_par', name: 'CPU Parallel (MPI)', data: cpuParRes.data, error: cpuParRes.error },
      { id: 'gpu_seq', name: 'GPU Sequential', data: gpuSeqRes.data, error: gpuSeqRes.error },
      { id: 'gpu_par', name: 'GPU Parallel (CUDA)', data: gpuParRes.data, error: gpuParRes.error }
    ];

    return NextResponse.json({ success: true, results });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
