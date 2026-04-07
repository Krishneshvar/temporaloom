import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { engineDir, cleanResultsDir } from '@/lib/engine';
import { saveRun } from '@/lib/history';


const ENGINE_TIMEOUT_MS = 120_000; // 2-minute hard cap

export async function POST(request) {
  try {
    const { dataset, mode, useMPI, processes } = await request.json();
    
    if (!dataset) {
      return NextResponse.json({ error: 'Dataset is required' }, { status: 400 });
    }

    const datasetPath = path.join('../datasets', dataset);
    cleanResultsDir();

    let cmd = '';
    let args = [];

    if (mode === 'gpu_seq') {
      cmd = './pagerank_cuda_seq';
      args = [datasetPath, '-e', '-j'];
    } else if (mode === 'gpu_par') {
      cmd = './pagerank_cuda_par';
      args = [datasetPath, '-e', '-j'];
    } else if (mode === 'cpu_par' || useMPI) {
      cmd = 'mpirun';
      args = ['--oversubscribe', '-np', (processes || 4).toString(), './pagerank_mpi', datasetPath, '-e', '-j'];
    } else {
      cmd = './pagerank_seq';
      args = [datasetPath, '-e', '-j'];
    }

    console.log(`Running: ${cmd} ${args.join(' ')}`);

    return new Promise((resolve) => {
      const child = spawn(cmd, args, { cwd: engineDir });
      let stdoutData = '';
      let stderrData = '';
      let settled = false;

      const killAndResolve = (response) => {
        if (settled) return;
        settled = true;
        try { child.kill('SIGKILL'); } catch (_) {}
        resolve(response);
      };

      // Hard timeout
      const timeout = setTimeout(() => {
        killAndResolve(NextResponse.json(
          { success: false, message: 'Engine timed out after 120s', error: 'TIMEOUT' },
          { status: 504 }
        ));
      }, ENGINE_TIMEOUT_MS);

      child.stdout.on('data', (data) => { stdoutData += data.toString(); });
      child.stderr.on('data', (data) => { stderrData += data.toString(); });

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;

        if (code !== 0) {
          resolve(NextResponse.json({ 
            success: false, 
            message: `Job failed with exit code ${code}`, 
            error: stderrData.slice(0, 2000),
          }, { status: 500 }));
          return;
        }

        try {
          const jsonStr = stdoutData.substring(stdoutData.indexOf('{'), stdoutData.lastIndexOf('}') + 1);
          if (jsonStr) {
            const finalResult = JSON.parse(jsonStr);
            try { saveRun({ dataset, mode: 'cpu_seq', processes: 1, ...finalResult }); } catch (_) {}
            resolve(NextResponse.json({ success: true, data: finalResult }));
          } else {
            resolve(NextResponse.json({ success: true, message: 'Job finished but no JSON result found', raw: stdoutData.slice(0, 500) }));
          }
        } catch (e) {
          resolve(NextResponse.json({ success: true, message: 'Results could not be parsed', error: e.message, raw: stdoutData.slice(0, 500) }));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        killAndResolve(NextResponse.json({ success: false, error: err.message }, { status: 500 }));
      });
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
