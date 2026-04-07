import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { engineDir, datasetsDir, cleanResultsDir, resultsDir } from '@/lib/engine';
import { saveRun } from '@/lib/history';

const ENGINE_TIMEOUT_MS = 120_000;

export async function POST(request) {
  const { dataset, mode, processes } = await request.json();
  if (!dataset) return NextResponse.json({ error: 'Dataset required' }, { status: 400 });

  const datasetPath = path.join('../datasets', dataset);
  cleanResultsDir();

  let cmd, args;
  if (mode === 'gpu_seq')      { cmd = './pagerank_cuda_seq'; args = [datasetPath, '-e', '-j']; }
  else if (mode === 'gpu_par') { cmd = './pagerank_cuda_par'; args = [datasetPath, '-e', '-j']; }
  else if (mode === 'cpu_par') { cmd = 'mpirun'; args = ['--oversubscribe', '-np', String(processes ?? 4), './pagerank_mpi', datasetPath, '-e', '-j']; }
  else                         { cmd = './pagerank_seq'; args = [datasetPath, '-e', '-j']; }

  const encoder = new TextEncoder();
  let child, killTimer;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)); } catch (_) {}
      };
      const close = () => { try { controller.close(); } catch (_) {} };

      child = spawn(cmd, args, { cwd: engineDir });
      let stdout = '', settled = false;

      killTimer = setTimeout(() => {
        if (!settled) { settled = true; try { child.kill('SIGKILL'); } catch (_) {} send({ type: 'error', message: 'Engine timed out after 120s' }); close(); }
      }, ENGINE_TIMEOUT_MS);

      child.stdout.on('data', d => { stdout += d.toString(); });
      child.stderr.on('data', () => {}); // suppress

      // Poll for new iteration files every 120ms and stream them
      let lastSent = -1;
      const poll = setInterval(() => {
        if (!fs.existsSync(resultsDir)) return;
        const files = fs.readdirSync(resultsDir)
          .filter(f => f.startsWith('iteration_') && f.endsWith('.json'))
          .map(f => ({ f, n: parseInt(f.replace('iteration_', '').replace('.json', ''), 10) }))
          .filter(({ n }) => !isNaN(n) && n > lastSent)
          .sort((a, b) => a.n - b.n);
        for (const { f, n } of files) {
          try {
            const data = JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf8'));
            send({ type: 'iteration', data });
            lastSent = n;
          } catch (_) {}
        }
      }, 120);

      child.on('close', (code) => {
        clearInterval(poll);
        clearTimeout(killTimer);
        if (settled) return;
        settled = true;

        // Final poll to catch last iterations
        if (fs.existsSync(resultsDir)) {
          fs.readdirSync(resultsDir)
            .filter(f => f.startsWith('iteration_') && f.endsWith('.json'))
            .map(f => ({ f, n: parseInt(f.replace('iteration_', '').replace('.json', ''), 10) }))
            .filter(({ n }) => !isNaN(n) && n > lastSent)
            .sort((a, b) => a.n - b.n)
            .forEach(({ f }) => {
              try {
                const data = JSON.parse(fs.readFileSync(path.join(resultsDir, f), 'utf8'));
                send({ type: 'iteration', data });
              } catch (_) {}
            });
        }

        if (code !== 0) { send({ type: 'error', message: `Engine exited with code ${code}` }); close(); return; }

        try {
          const jsonStr = stdout.substring(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1);
          const result = JSON.parse(jsonStr);
          // Persist to history
          const record = saveRun({ dataset, mode: mode || 'cpu_seq', processes: processes ?? 1, ...result });
          send({ type: 'complete', data: result, historyId: record.id });
        } catch (_) {
          send({ type: 'error', message: 'Could not parse engine output' });
        }
        close();
      });

      child.on('error', (err) => {
        clearInterval(poll); clearTimeout(killTimer);
        if (!settled) { settled = true; send({ type: 'error', message: err.message }); close(); }
      });
    },
    cancel() { try { child?.kill('SIGKILL'); } catch (_) {} clearTimeout(killTimer); },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
