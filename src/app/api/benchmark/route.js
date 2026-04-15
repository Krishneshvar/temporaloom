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
    const { dataset, processes, target = 'all' } = await request.json();
    
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset is required' }, { status: 400 });
    }

    const datasetPath = path.join('../datasets', dataset);
    cleanResultsDir();

    const procCount = (processes || 4).toString();
    const results = [];

    if (target === 'all' || target === 'cpu') {
      const cpuSeqRes = await runMode('./pagerank_seq', [datasetPath, '-j']);
      const cpuParRes = await runMode('mpirun', ['--oversubscribe', '-np', procCount, './pagerank_mpi', datasetPath, '-j']);
      const cpuOmpRes = await runMode('./pagerank_omp', [datasetPath, '-j', '-t', procCount]);
      results.push(
        { id: 'cpu_seq', name: 'CPU Sequential', data: cpuSeqRes.data, error: cpuSeqRes.error },
        { id: 'cpu_par', name: 'CPU Parallel (MPI)', data: cpuParRes.data, error: cpuParRes.error },
        { id: 'cpu_omp', name: 'CPU Parallel (OMP)', data: cpuOmpRes.data, error: cpuOmpRes.error }
      );
    }
    
    if (target === 'all' || target === 'gpu') {
      const gpuSeqRes = await runMode('./pagerank_cuda_seq', [datasetPath, '-j']);
      const gpuParRes = await runMode('./pagerank_cuda_par', [datasetPath, '-j']);
      results.push(
        { id: 'gpu_seq', name: 'GPU Sequential', data: gpuSeqRes.data, error: gpuSeqRes.error },
        { id: 'gpu_par', name: 'GPU Parallel (CUDA)', data: gpuParRes.data, error: gpuParRes.error }
      );
    }

    return NextResponse.json({ success: true, results });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
