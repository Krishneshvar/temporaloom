import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { engineDir, cleanResultsDir } from '@/lib/engine';

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

      child.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          resolve(NextResponse.json({ 
            success: false, 
            message: `Job failed with code ${code}`, 
            error: stderrData 
          }, { status: 500 }));
          return;
        }

        try {
          // Find the JSON output block
          const jsonStr = stdoutData.substring(stdoutData.indexOf('{'), stdoutData.lastIndexOf('}') + 1);
          if (jsonStr) {
            const finalResult = JSON.parse(jsonStr);
            resolve(NextResponse.json({ success: true, data: finalResult }));
          } else {
            resolve(NextResponse.json({ success: true, message: 'Job finished but no JSON result found', raw: stdoutData }));
          }
        } catch (e) {
          resolve(NextResponse.json({ success: true, message: 'Job finished but results could not be parsed', error: e.message, raw: stdoutData }));
        }
      });
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
