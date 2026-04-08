'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Zap, Info, Binary, Terminal, GitBranch, Play, Pause,
  SkipBack, SkipForward, Radio, BarChart2, GitMerge, Sun, Moon
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import GraphViewer    from '@/components/GraphViewer';
import ControlPanel   from '@/components/ControlPanel';
import PerformanceChart from '@/components/PerformanceChart';
import BenchmarkChart from '@/components/BenchmarkChart';
import ScrapeVisualizer from '@/components/ScrapeVisualizer';
import BFSResult      from '@/components/BFSResult';
import GraphStats     from '@/components/GraphStats';
import RunHistory     from '@/components/RunHistory';
import ScrapeHistory  from '@/components/ScrapeHistory';

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading]             = useState(false);
  const [status, setStatus]               = useState('');
  const [selectedDataset, setSelectedDataset] = useState('');

  // PageRank
  const [runResult, setRunResult]         = useState(null);
  const [iteration, setIteration]         = useState(0);
  const [iterationData, setIterationData] = useState(null);
  const [liveMode, setLiveMode]           = useState(true);   
  const [liveIterCount, setLiveIterCount] = useState(0);
  const liveReaderRef = useRef(null);

  // Graph metadata from GraphViewer parse
  const [graphStats, setGraphStats]       = useState(null);   
  const [selectedNode, setSelectedNode]   = useState(null);   

  // Auto-play
  const [isPlaying, setIsPlaying]         = useState(false);
  const [playSpeed, setPlaySpeed]         = useState(500);
  const playIntervalRef = useRef(null);

  // BFS / SSSP
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentTab, setCurrentTab]       = useState(searchParams.get('tab') || 'run');
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [bfsResult, setBfsResult]         = useState(null);
  const [ssspResult, setSsspResult]       = useState(null);
  const [showSSSP, setShowSSSP]           = useState(false);

  // Scraper
  const [scrapeEvents, setScrapeEvents]   = useState([]);
  const [isScraping, setIsScraping]       = useState(false);
  const readerRef = useRef(null);

  // Sidebar collapse
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Stats tab in Run section
  const [showStats, setShowStats]         = useState(false);

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== currentTab) setCurrentTab(tab);
  }, [searchParams]);

  const handleTabChange = (t) => {
    setCurrentTab(t);
    router.push(`/?tab=${t}`);
  };

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

  // ── Live streaming run ─────────────────────────────────────────
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
        let buffer = '';

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
                const n = ev.data.iteration ?? 0;
                setLiveIterCount(prev => Math.max(prev, n + 1));
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

  const handleRestoreScrape = (events) => {
    setScrapeEvents(events);
    setStatus(`Replaying session: ${events.length} events loaded.`);
    setCurrentTab('scrape');
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
          try { 
            const ev = JSON.parse(line.slice(6)); 
            setScrapeEvents(p => {
              const next = [...p, ev];
              // If last event, trigger save (or we can do it in finally)
              return next;
            }); 
            if (ev.type === 'complete') setStatus(ev.data.message); 
          } catch (_) {}
        }
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      setScrapeEvents(p => [...p, { type: 'error', message: err.message, url: 'SYSTEM' }]);
    } finally { 
      setLoading(false); 
      setIsScraping(false); 
      readerRef.current = null;
      
      // Save to history if we have events
      setScrapeEvents(events => {
        if (events.length > 5) {
          fetch('/api/scrape/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              metadata: { startUrl, maxDepth },
              events: events
            })
          }).catch(console.error);
        }
        return events;
      });
    }
  };

  const stopScrape = () => readerRef.current?.cancel();

  return (
    <main className={`flex flex-col text-[var(--foreground)] p-6 font-sans selection:bg-blue-500/30 ${currentTab === 'scrape' && isScraping ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between mb-8 max-w-[1400px] mx-auto w-full shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20">
            <Layers size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              TEMPORALOOM
              <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20 font-mono">v2.1 // ALPHA</span>
            </h1>
            <p className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-widest">Distributed Graph Analytics Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-4 px-6 py-3 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl">
          <button
            onClick={toggleTheme}
            className="p-2 hover:bg-[var(--surface-hover)] rounded-xl transition-colors text-[var(--text-dim)] hover:text-[var(--foreground)]"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="w-px h-8 bg-[var(--border)]" />
          <div className="flex flex-col">
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Engine</span>
            <span className="text-xs text-green-400 flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Operational
            </span>
          </div>
          <div className="w-px h-8 bg-[var(--border)]" />
          {/* Live-mode toggle */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Live Stream</span>
            <button
              onClick={() => setLiveMode(p => !p)}
              className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${liveMode ? 'text-blue-400' : 'text-[var(--text-dim)]'}`}
            >
              <Radio size={12} className={liveMode ? 'animate-pulse' : ''} />
              {liveMode ? 'On' : 'Off'}
            </button>
          </div>
          <div className="w-px h-8 bg-[var(--border)]" />
          <div className="flex flex-col">
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Datasets</span>
            <a href="/datasets" className="text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors">Open Manager →</a>
          </div>
        </div>
      </header>

      {/* ── Grid ── */}
      <div className={`grid grid-cols-12 gap-6 max-w-[1400px] mx-auto transition-all duration-700 ${currentTab === 'scrape' && isScraping ? 'flex-1 min-h-0 pb-6' : 'pb-20'}`}>

        {/* Sidebar */}
        <div 
          className={`transition-all duration-700 flex flex-col gap-6 relative group
            ${(isScraping && currentTab === 'scrape') || isSidebarCollapsed 
              ? 'col-span-12 lg:col-span-1 opacity-40 hover:opacity-100' 
              : 'col-span-12 lg:col-span-3'}`}
        >
          {/* Collapse Toggle Button */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3 top-10 z-20 w-6 h-6 bg-[var(--surface)] border border-[var(--border)] rounded-full flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--foreground)] transition-all shadow-xl group-hover:scale-110 active:scale-95"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <motion.div
              animate={{ rotate: isSidebarCollapsed ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <SkipBack size={10} />
            </motion.div>
          </button>

          <div className="sticky top-6 flex flex-col gap-6">
            <div className={((isScraping && currentTab === 'scrape') || isSidebarCollapsed) ? 'scale-[0.85] origin-top-left' : ''}>
              <ControlPanel
                onRun={handleRun} onBenchmark={handleBenchmark} onBFS={handleBFS}
                onScrape={handleScrape} onSSP={handleSSP}
                loading={loading} status={status}
                currentTab={currentTab} setCurrentTab={handleTabChange}
                liveMode={liveMode}
                minimized={(isScraping && currentTab === 'scrape') || isSidebarCollapsed}
              />
            </div>
            
            {!((isScraping && currentTab === 'scrape') || isSidebarCollapsed) && (
              <motion.div initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-6">
                {currentTab === 'scrape' ? (
                  <ScrapeHistory onRestore={handleRestoreScrape} />
                ) : (
                  <RunHistory onRestore={handleRestore} />
                )}
                <div className="p-6 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl">
                  <div className="flex items-center gap-2 text-[var(--text-dim)] font-bold text-xs uppercase tracking-widest mb-4">
                    <Info size={14} /> About System
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed font-medium">
                    Temporaloom implements PageRank, BFS, and SSSP across CPU Sequential, MPI, and CUDA backends with live SSE streaming. Web-crawled topology ingestion constructs datasets in real-time.
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Main */}
        <div className={`transition-all duration-700 flex flex-col gap-6 ${(isScraping && currentTab === 'scrape') || isSidebarCollapsed ? 'col-span-12 lg:col-span-11' : 'col-span-12 lg:col-span-9'}`}>
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
                    <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest block">Graph Traversal · BFS + SSSP</span>
                    <span className="text-sm text-[var(--foreground)] font-bold">{selectedDataset || 'Select a dataset'}</span>
                  </div>
                </div>

                {/* SSSP path result banner */}
                {showSSSP && ssspResult && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl border flex items-start gap-3 ${ssspResult.path?.length > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <GitMerge size={16} className={ssspResult.path?.length > 0 ? 'text-emerald-400 mt-0.5 shrink-0' : 'text-red-400 mt-0.5 shrink-0'} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-widest mb-1 text-[var(--text-dim)]">
                        Shortest Path — Node {ssspResult.source} → {ssspResult.target}
                      </div>
                      {ssspResult.path?.length > 0 ? (
                        <div className="flex flex-wrap gap-1 items-center">
                          {ssspResult.path.map((n, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-md text-[11px] font-black font-mono text-emerald-300">{n}</span>
                              {i < ssspResult.path.length - 1 && <span className="text-[var(--text-dim)] text-xs">→</span>}
                            </span>
                          ))}
                          <span className="ml-2 text-[10px] text-[var(--text-dim)] font-mono">({ssspResult.distance} hops · {ssspResult.execution_time?.toFixed(4)}s)</span>
                        </div>
                      ) : (
                        <span className="text-red-400 font-bold text-sm">Unreachable</span>
                      )}
                    </div>
                    <button onClick={() => setShowSSSP(false)} className="text-[var(--text-dim)] hover:text-[var(--foreground)] text-xs font-mono shrink-0">✕</button>
                  </motion.div>
                )}

                <BFSResult data={bfsResult} loading={loading && !bfsResult} />
              </motion.div>
            )}

            {/* SCRAPE */}
            {currentTab === 'scrape' && (
              <motion.div key="scrape" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex flex-col gap-6 h-full min-h-0">
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
                      <span className="text-[11px] text-[var(--text-dim)] ml-3">{liveIterCount} iterations received</span>
                    </div>
                    <button onClick={stopLive} className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 px-3 py-1 rounded-lg font-bold">Stop</button>
                  </div>
                )}

                {/* Graph viewer */}
                <div className="relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-visible min-h-[400px]">
                  <div className="absolute top-6 left-6 z-10 flex items-center gap-2 pointer-events-none">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400"><Binary size={16} /></div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Graph Simulation</span>
                      <span className="text-xs text-[var(--foreground)] font-bold">{selectedDataset || 'Waiting...'}</span>
                    </div>
                  </div>

                  {/* Iteration controls */}
                  {runResult && (
                    <div className="absolute bottom-6 left-6 right-6 z-10 flex items-center gap-4 bg-[var(--background)]/80 backdrop-blur-xl p-4 rounded-2xl border border-[var(--border)] shadow-xl">
                      <div className="flex flex-col shrink-0 w-14">
                        <span className="text-[9px] text-[var(--text-dim)] font-bold uppercase">Iter</span>
                        <span className="text-base text-[var(--foreground)] font-black font-mono leading-none">
                          {iteration}<span className="text-[var(--text-dim)] text-xs">/{runResult.iterations - 1}</span>
                        </span>
                      </div>
                      <input type="range" min="0" max={runResult.iterations - 1} value={iteration}
                        onChange={e => { setIsPlaying(false); const n = parseInt(e.target.value); setIteration(n); if (!liveMode) fetchIteration(n); }}
                        className="flex-1 accent-blue-500 h-1 rounded-full bg-[var(--border)] cursor-pointer" />
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setIsPlaying(false); const n = Math.max(0, iteration-1); setIteration(n); if (!liveMode) fetchIteration(n); }}
                          className="p-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-lg border border-[var(--border)] transition-all text-[var(--text-dim)] hover:text-[var(--foreground)]"><SkipBack size={15} /></button>
                        <button onClick={togglePlay} className={`p-2.5 rounded-lg border transition-all ${isPlaying ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]/70 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'}`}>
                          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                        </button>
                        <button onClick={() => { setIsPlaying(false); const n = Math.min(runResult.iterations-1, iteration+1); setIteration(n); if (!liveMode) fetchIteration(n); }}
                          className="p-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-lg border border-[var(--border)] transition-all text-[var(--text-dim)] hover:text-[var(--foreground)]"><SkipForward size={15} /></button>
                      </div>
                      <select value={playSpeed} onChange={e => setPlaySpeed(parseInt(e.target.value))}
                        className="bg-transparent text-[var(--text-dim)] text-[10px] font-bold border border-[var(--border)] rounded-md px-1.5 py-1 cursor-pointer focus:outline-none hover:text-[var(--foreground)] transition-colors shrink-0">
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
                    theme={theme}
                  />
                </div>

                {/* Stats toggle tab */}
                {runResult && (
                  <button
                    onClick={() => setShowStats(s => !s)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all w-fit ${showStats ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--foreground)] hover:border-[var(--text-muted)]'}`}
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
                      <div className="h-full bg-[var(--surface)] rounded-2xl border border-[var(--border)] border-dashed flex flex-col items-center justify-center gap-3 text-[var(--text-dim)] transition-all">
                        <Terminal size={32} />
                        <span className="text-xs font-bold uppercase tracking-widest">Execute simulation to view metrics</span>
                      </div>
                    )}
                  </div>
                  <div className="col-span-4 bg-gradient-to-br from-[var(--surface)] to-[var(--surface-hover)] rounded-2xl border border-[var(--border)] shadow-xl p-6 relative overflow-hidden flex flex-col justify-end group hover:border-blue-500/20 transition-all">
                    <Zap size={100} className="absolute -top-6 -right-6 text-blue-600/5 rotate-12 group-hover:text-blue-600/10 transition-all" />
                    <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-1 block">Architecture Mode</span>
                    <h2 className="text-4xl font-black tracking-tighter text-[var(--foreground)] uppercase">
                      {runResult?.mode ? runResult.mode.replace('_', ' ') : 'N/A'}
                    </h2>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold leading-relaxed mt-2 uppercase tracking-tight">
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
