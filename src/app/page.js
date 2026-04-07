'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Zap, Info, Binary, Terminal, GitBranch, Play, Pause,
  SkipBack, SkipForward, Radio, BarChart2, GitMerge,
} from 'lucide-react';
import GraphViewer    from '@/components/GraphViewer';
import ControlPanel   from '@/components/ControlPanel';
import PerformanceChart from '@/components/PerformanceChart';
import BenchmarkChart from '@/components/BenchmarkChart';
import ScrapeVisualizer from '@/components/ScrapeVisualizer';
import BFSResult      from '@/components/BFSResult';
import GraphStats     from '@/components/GraphStats';
import RunHistory     from '@/components/RunHistory';

export default function Home() {
  const [loading, setLoading]             = useState(false);
  const [status, setStatus]               = useState('');
  const [selectedDataset, setSelectedDataset] = useState('');

  // PageRank
  const [runResult, setRunResult]         = useState(null);
  const [iteration, setIteration]         = useState(0);
  const [iterationData, setIterationData] = useState(null);
  const [liveMode, setLiveMode]           = useState(true);   // Feature 9
  const [liveIterCount, setLiveIterCount] = useState(0);
  const liveReaderRef = useRef(null);

  // Graph metadata from GraphViewer parse
  const [graphStats, setGraphStats]       = useState(null);   // Feature 12
  const [selectedNode, setSelectedNode]   = useState(null);   // Feature 4 (inspector in viewer)

  // Auto-play
  const [isPlaying, setIsPlaying]         = useState(false);
  const [playSpeed, setPlaySpeed]         = useState(500);
  const playIntervalRef = useRef(null);

  // BFS / SSSP
  const [currentTab, setCurrentTab]       = useState('run');
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [bfsResult, setBfsResult]         = useState(null);
  const [ssspResult, setSsspResult]       = useState(null);
  const [showSSSP, setShowSSSP]           = useState(false);

  // Scraper
  const [scrapeEvents, setScrapeEvents]   = useState([]);
  const [isScraping, setIsScraping]       = useState(false);
  const readerRef = useRef(null);

  // Stats tab in Run section
  const [showStats, setShowStats]         = useState(false);

  // ── Iteration fetch (batch mode) ──────────────────────────────────────────
  const fetchIteration = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/iterations/${id}`);
      if (res.ok) setIterationData(await res.json());
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (runResult && !liveMode) fetchIteration(iteration);
  }, [iteration, runResult, liveMode, fetchIteration]);

  // ── Auto-play ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || !runResult) return;
    playIntervalRef.current = setInterval(() => {
      setIteration(prev => {
        const next = prev + 1;
        if (next >= runResult.iterations) { setIsPlaying(false); return prev; }
        if (!liveMode) fetchIteration(next);
        return next;
      });
    }, playSpeed);
    return () => clearInterval(playIntervalRef.current);
  }, [isPlaying, playSpeed, runResult, liveMode, fetchIteration]);

  const togglePlay = () => {
    if (!runResult) return;
    if (iteration >= runResult.iterations - 1) setIteration(0);
    setIsPlaying(p => !p);
  };

  // ── Feature 9: Live streaming run ─────────────────────────────────────────
  const handleRun = async ({ dataset, mode, processes }) => {
    setLoading(true);
    setStatus('Initializing simulation...');
    setSelectedDataset(dataset);
    setIteration(0);
    setIterationData(null);
    setRunResult(null);
    setIsPlaying(false);
    setLiveIterCount(0);

    if (liveMode) {
      // ── SSE streaming path ───────────────────────────────────────────────
      try {
        const res = await fetch('/api/run/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataset, mode, processes }),
        });
        if (!res.ok) { setStatus('Stream error'); setLoading(false); return; }

        const reader = res.body.getReader();
        liveReaderRef.current = reader;
        const decoder = new TextDecoder();
        let buffer = '', iterBuffer = [], maxIter = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const ev = JSON.parse(line.slice(6));

              if (ev.type === 'iteration') {
                iterBuffer.push(ev.data);
                const n = ev.data.iteration ?? 0;
                if (n > maxIter) maxIter = n;
                setLiveIterCount(maxIter + 1);
                setIteration(n);
                setIterationData(ev.data);
              }

              if (ev.type === 'complete') {
                setRunResult(ev.data);
                setIteration(ev.data.iterations - 1);
                setStatus(`Converged in ${ev.data.iterations} iters [${(ev.data.mode ?? mode)?.toUpperCase()}] — Live stream complete.`);
              }

              if (ev.type === 'error') {
                setStatus(`Engine Error: ${ev.message}`);
              }
            } catch (_) {}
          }
        }
      } catch (err) {
        setStatus(`Stream Error: ${err.message}`);
      } finally {
        setLoading(false);
        liveReaderRef.current = null;
      }
    } else {
      // ── Batch path (legacy) ───────────────────────────────────────────────
      try {
        const res = await fetch('/api/run', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataset, mode, processes }),
        });
        const data = await res.json();
        if (data.success) {
          setRunResult(data.data);
          setStatus(`Converged in ${data.data.iterations} iters [${data.data.mode?.toUpperCase()}].`);
          fetchIteration(data.data.iterations - 1);
          setIteration(data.data.iterations - 1);
        } else {
          setStatus(`Error: ${data.message || data.error}`);
        }
      } catch (err) {
        setStatus(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const stopLive = () => liveReaderRef.current?.cancel();

  // ── Restore from history ───────────────────────────────────────────────────
  const handleRestore = (record) => {
    if (record.dataset) setSelectedDataset(record.dataset);
    setStatus(`Restored: ${record.dataset} · ${record.iterations} iters · ${record.mode}`);
    setCurrentTab('run');
  };

  // ── Benchmark ─────────────────────────────────────────────────────────────
  const handleBenchmark = async ({ dataset, processes }) => {
    setLoading(true); setStatus('Running benchmark suite...');
    setSelectedDataset(dataset); setBenchmarkResult(null);
    try {
      const res = await fetch('/api/benchmark', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataset, processes }) });
      const data = await res.json();
      if (data.success) { setBenchmarkResult(data.results); setStatus('Benchmark complete.'); }
      else setStatus(`Error: ${data.error}`);
    } catch (err) { setStatus(`Error: ${err.message}`); }
    finally { setLoading(false); }
  };

  // ── BFS ───────────────────────────────────────────────────────────────────
  const handleBFS = async ({ dataset, mode, processes, source }) => {
    setLoading(true); setBfsResult(null); setSsspResult(null); setShowSSSP(false);
    setSelectedDataset(dataset);
    setStatus(`Running BFS from node ${source}...`);
    try {
      const res = await fetch('/api/bfs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataset, mode, processes, source }) });
      const data = await res.json();
      if (data.success) { setBfsResult(data.data); setStatus(`BFS done: ${data.data.reachable}/${data.data.nodes} reachable, max depth ${data.data.max_distance}`); }
      else setStatus(`BFS Error: ${data.error}`);
    } catch (err) { setStatus(`Error: ${err.message}`); }
    finally { setLoading(false); }
  };

  // ── SSSP ──────────────────────────────────────────────────────────────────
  const handleSSP = async ({ dataset, source, target }) => {
    setLoading(true); setSsspResult(null); setShowSSSP(true);
    setStatus(`Finding shortest path: ${source} → ${target}...`);
    try {
      const res = await fetch('/api/sssp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataset, source, target }) });
      const data = await res.json();
      if (data.success) {
        setSsspResult(data.data);
        setStatus(data.data.path?.length > 0
          ? `Shortest path: [${data.data.path.join(' → ')}]  distance=${data.data.distance}`
          : `No path from ${source} to ${target} (unreachable)`);
      } else setStatus(`SSSP Error: ${data.error}`);
    } catch (err) { setStatus(`Error: ${err.message}`); }
    finally { setLoading(false); }
  };

  // ── Scrape ────────────────────────────────────────────────────────────────
  const handleScrape = async ({ startUrl, maxDepth }) => {
    setLoading(true); setIsScraping(true); setScrapeEvents([]);
    setStatus(`Crawling ${startUrl}...`);
    try {
      const res = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startUrl, maxDepth }) });
      if (!res.ok) throw new Error((await res.json()).error);
      const reader = res.body.getReader(); readerRef.current = reader;
      const dec = new TextDecoder(); let buf = '';
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try { const ev = JSON.parse(line.slice(6)); setScrapeEvents(p => [...p, ev]); if (ev.type === 'complete') setStatus(ev.data.message); } catch (_) {}
        }
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      setScrapeEvents(p => [...p, { type: 'error', message: err.message, url: 'SYSTEM' }]);
    } finally { setLoading(false); setIsScraping(false); readerRef.current = null; }
  };

  const stopScrape = () => readerRef.current?.cancel();

  return (
    <main className="min-h-screen bg-[#050505] text-white p-6 font-sans selection:bg-blue-500/30">

      {/* ── Header ── */}
      <header className="flex items-center justify-between mb-8 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20">
            <Layers size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              TEMPORALOOM
              <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20 font-mono">v2.1 // ALPHA</span>
            </h1>
            <p className="text-[#555] text-xs font-semibold uppercase tracking-widest">Distributed Graph Analytics Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-4 px-6 py-3 bg-[#111] rounded-2xl border border-[#222] shadow-xl">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#555] font-bold uppercase">Engine</span>
            <span className="text-xs text-green-400 flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Operational
            </span>
          </div>
          <div className="w-px h-8 bg-[#222]" />
          {/* Live-mode toggle */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#555] font-bold uppercase">Live Stream</span>
            <button
              onClick={() => setLiveMode(p => !p)}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${liveMode ? 'text-blue-400' : 'text-white/30'}`}
            >
              <Radio size={12} className={liveMode ? 'animate-pulse' : ''} />
              {liveMode ? 'On' : 'Off'}
            </button>
          </div>
          <div className="w-px h-8 bg-[#222]" />
          <div className="flex flex-col">
            <span className="text-[10px] text-[#555] font-bold uppercase">Datasets</span>
            <a href="/datasets" className="text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors">Open Manager →</a>
          </div>
        </div>
      </header>

      {/* ── Grid ── */}
      <div className="grid grid-cols-12 gap-6 max-w-[1400px] mx-auto pb-20">

        {/* Sidebar */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
          <div className="sticky top-6 flex flex-col gap-6">
            <ControlPanel
              onRun={handleRun} onBenchmark={handleBenchmark} onBFS={handleBFS}
              onScrape={handleScrape} onSSP={handleSSP}
              loading={loading} status={status}
              currentTab={currentTab} setCurrentTab={setCurrentTab}
              liveMode={liveMode}
            />
            <RunHistory onRestore={handleRestore} />
            <div className="p-5 bg-[#111] rounded-2xl border border-[#222] shadow-xl">
              <div className="flex items-center gap-2 text-white/40 font-bold text-[10px] uppercase tracking-widest mb-3">
                <Info size={13} /> About
              </div>
              <p className="text-[11px] text-[#555] leading-relaxed font-medium">
                Temporaloom implements PageRank, BFS, and SSSP across CPU Sequential, MPI, and CUDA backends with live SSE streaming. Web-crawled topology ingestion constructs datasets in real-time.
              </p>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-6">
          <AnimatePresence mode="wait">

            {/* BENCHMARK */}
            {currentTab === 'benchmark' && (
              <motion.div key="benchmark" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-6">
                <BenchmarkChart data={benchmarkResult} loading={loading && !benchmarkResult} />
              </motion.div>
            )}

            {/* BFS */}
            {currentTab === 'bfs' && (
              <motion.div key="bfs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-6">
                <div className="flex items-center gap-3 px-1">
                  <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400"><GitBranch size={16} /></div>
                  <div>
                    <span className="text-[10px] text-[#555] font-bold uppercase tracking-widest block">Graph Traversal · BFS + SSSP</span>
                    <span className="text-sm text-white font-bold">{selectedDataset || 'Select a dataset'}</span>
                  </div>
                </div>

                {/* SSSP path result banner */}
                {showSSSP && ssspResult && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl border flex items-start gap-3 ${ssspResult.path?.length > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <GitMerge size={16} className={ssspResult.path?.length > 0 ? 'text-emerald-400 mt-0.5 shrink-0' : 'text-red-400 mt-0.5 shrink-0'} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest mb-1 text-white/40">
                        Shortest Path — Node {ssspResult.source} → {ssspResult.target}
                      </div>
                      {ssspResult.path?.length > 0 ? (
                        <div className="flex flex-wrap gap-1 items-center">
                          {ssspResult.path.map((n, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-md text-[11px] font-black font-mono text-emerald-300">{n}</span>
                              {i < ssspResult.path.length - 1 && <span className="text-white/20 text-xs">→</span>}
                            </span>
                          ))}
                          <span className="ml-2 text-[10px] text-white/30 font-mono">({ssspResult.distance} hops · {ssspResult.execution_time?.toFixed(4)}s)</span>
                        </div>
                      ) : (
                        <span className="text-red-400 font-bold text-sm">Unreachable</span>
                      )}
                    </div>
                    <button onClick={() => setShowSSSP(false)} className="text-white/20 hover:text-white text-xs font-mono shrink-0">✕</button>
                  </motion.div>
                )}

                <BFSResult data={bfsResult} loading={loading && !bfsResult} />
              </motion.div>
            )}

            {/* SCRAPE */}
            {currentTab === 'scrape' && (
              <motion.div key="scrape" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-6 min-h-[500px]">
                <ScrapeVisualizer events={scrapeEvents} isScraping={isScraping} onStop={stopScrape} />
              </motion.div>
            )}

            {/* RUN */}
            {currentTab === 'run' && (
              <motion.div key="run" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-6">

                {/* Live streaming indicator */}
                {loading && liveMode && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                    <Radio size={14} className="text-blue-500 animate-pulse shrink-0" />
                    <div className="flex-1">
                      <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Live Stream Active</span>
                      <span className="text-[11px] text-white/40 ml-3">{liveIterCount} iterations received</span>
                    </div>
                    <button onClick={stopLive} className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 px-3 py-1 rounded-lg font-bold">Stop</button>
                  </div>
                )}

                {/* Graph viewer */}
                <div className="relative bg-[#111] rounded-2xl border border-[#222] shadow-2xl overflow-visible min-h-[400px]">
                  <div className="absolute top-6 left-6 z-10 flex items-center gap-2 pointer-events-none">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400"><Binary size={16} /></div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#555] font-bold uppercase">Graph Simulation</span>
                      <span className="text-xs text-white font-bold">{selectedDataset || 'Waiting...'}</span>
                    </div>
                  </div>

                  {/* Iteration controls */}
                  {runResult && (
                    <div className="absolute bottom-6 left-6 right-6 z-10 flex items-center gap-4 bg-black/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl">
                      <div className="flex flex-col shrink-0 w-14">
                        <span className="text-[9px] text-white/30 font-bold uppercase">Iter</span>
                        <span className="text-base text-white font-black font-mono leading-none">
                          {iteration}<span className="text-white/25 text-xs">/{runResult.iterations - 1}</span>
                        </span>
                      </div>
                      <input type="range" min="0" max={runResult.iterations - 1} value={iteration}
                        onChange={e => { setIsPlaying(false); const n = parseInt(e.target.value); setIteration(n); if (!liveMode) fetchIteration(n); }}
                        className="flex-1 accent-blue-500 h-1 rounded-full bg-white/10 cursor-pointer" />
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setIsPlaying(false); const n = Math.max(0, iteration-1); setIteration(n); if (!liveMode) fetchIteration(n); }}
                          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all text-white/50 hover:text-white"><SkipBack size={15} /></button>
                        <button onClick={togglePlay} className={`p-2.5 rounded-lg border transition-all ${isPlaying ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-white/70 hover:bg-white/10 hover:text-white'}`}>
                          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                        </button>
                        <button onClick={() => { setIsPlaying(false); const n = Math.min(runResult.iterations-1, iteration+1); setIteration(n); if (!liveMode) fetchIteration(n); }}
                          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all text-white/50 hover:text-white"><SkipForward size={15} /></button>
                      </div>
                      <select value={playSpeed} onChange={e => setPlaySpeed(parseInt(e.target.value))}
                        className="bg-transparent text-white/50 text-[10px] font-bold border border-white/10 rounded-md px-1.5 py-1 cursor-pointer focus:outline-none hover:text-white transition-colors shrink-0">
                        <option value={1000}>Slow</option><option value={500}>Normal</option>
                        <option value={200}>Fast</option><option value={50}>Ultra</option>
                      </select>
                    </div>
                  )}

                  <GraphViewer
                    dataset={selectedDataset}
                    iterationData={iterationData}
                    onNodeClick={setSelectedNode}
                    onGraphLoaded={setGraphStats}
                  />
                </div>

                {/* Stats toggle tab */}
                {runResult && (
                  <button
                    onClick={() => setShowStats(s => !s)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all w-fit ${showStats ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-white/5 border-white/5 text-white/30 hover:text-white/60 hover:border-white/10'}`}
                  >
                    <BarChart2 size={13} /> {showStats ? 'Hide Stats' : 'Show Graph Stats'}
                  </button>
                )}

                {/* Graph Stats Panel */}
                <AnimatePresence>
                  {showStats && runResult && (
                    <motion.div key="stats" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                      <GraphStats runResult={runResult} iterationData={iterationData} graphStats={graphStats} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bottom row */}
                <div className="grid grid-cols-12 gap-6 h-[280px]">
                  <div className="col-span-8">
                    {runResult ? <PerformanceChart results={runResult} /> : (
                      <div className="h-full bg-[#111] rounded-2xl border border-[#222] border-dashed flex flex-col items-center justify-center gap-3 text-white/10 transition-all">
                        <Terminal size={32} />
                        <span className="text-xs font-bold uppercase tracking-widest">Execute simulation to view metrics</span>
                      </div>
                    )}
                  </div>
                  <div className="col-span-4 bg-gradient-to-br from-[#111] to-[#1a1a1a] rounded-2xl border border-[#222] shadow-xl p-6 relative overflow-hidden flex flex-col justify-end group hover:border-blue-500/20 transition-all">
                    <Zap size={100} className="absolute -top-6 -right-6 text-blue-600/5 rotate-12 group-hover:text-blue-600/10 transition-all" />
                    <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-1 block">Architecture Mode</span>
                    <h2 className="text-4xl font-black tracking-tighter text-white uppercase">
                      {runResult?.mode ? runResult.mode.replace('_', ' ') : 'N/A'}
                    </h2>
                    <p className="text-[10px] text-[#555] font-bold leading-relaxed mt-2 uppercase tracking-tight">
                      {liveMode ? '⚡ Live stream active' : 'Batch execution mode'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
