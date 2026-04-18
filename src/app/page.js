'use client';

import { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Zap, Info, Binary, Terminal, GitBranch, Play, Pause,
  SkipBack, SkipForward, Radio, BarChart2, GitMerge, Sun, Moon,
  ChevronLeft, ChevronRight,
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
import ComparisonDashboard from '@/components/ComparisonDashboard';
import Link           from 'next/link';
import RunWorkerStats from '@/components/RunWorkerStats';

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

  // PageRank
  const [runResult, setRunResult]         = useState(null);
  const [iteration, setIteration]         = useState(0);
  const [iterationData, setIterationData] = useState(null);
  const [liveMode, setLiveMode]           = useState(true);
  const [visualizeMode, setVisualizeMode] = useState(true);
  const [liveIterCount, setLiveIterCount] = useState(0);
  const liveReaderRef = useRef(null);
  const [comparisons, setComparisons]     = useState({});
  const compReadersRef = useRef([]);

  // Graph metadata
  const [graphStats, setGraphStats]       = useState(null);
  const [selectedNode, setSelectedNode]   = useState(null);

  // Auto-play
  const [isPlaying, setIsPlaying]         = useState(false);
  const [playSpeed, setPlaySpeed]         = useState(500);
  const playIntervalRef = useRef(null);
  // Navigation
  const searchParams = useSearchParams();
  const router = useRouter();
  const [currentTab, setCurrentTab]       = useState(searchParams.get('tab') || 'run');
  const [selectedDataset, setSelectedDataset] = useState(searchParams.get('dataset') || '');
  const [pendingDataset, setPendingDataset]   = useState(searchParams.get('dataset') || '');
  const [benchmarkResult, setBenchmarkResult] = useState(null);
  const [bfsResult, setBfsResult]         = useState(null);
  const [ssspResult, setSsspResult]       = useState(null);
  const [showSSSP, setShowSSSP]           = useState(false);

  // Scraper
  const [scrapeEvents, setScrapeEvents]   = useState([]);
  const [runEvents, setRunEvents]     = useState([]);
  const [isScraping, setIsScraping]       = useState(false);
  const readerRef = useRef(null);

  // Sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showStats, setShowStats]         = useState(false);

  // Sync tab and dataset with URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== currentTab) setCurrentTab(tab);
    
    const ds = searchParams.get('dataset');
    if (ds && ds !== selectedDataset) setSelectedDataset(ds);
  }, [searchParams]);

  const handleTabChange = (t) => {
    setCurrentTab(t);
    const params = new URLSearchParams(searchParams);
    params.set('tab', t);
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  // ── Iteration fetch ──────────────────────────────────────────────────────
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

  // ── Live streaming run ─────────────────────────────────────────────────────
  const handleRun = async ({ dataset, mode, processes }) => {
    const targetDS = pendingDataset || dataset;
    setLoading(true);
    setStatus('Initializing simulation...');
    setSelectedDataset(targetDS);
    setIteration(0);
    setIterationData(null);
    setRunResult(null);
    setIsPlaying(false);
    setLiveIterCount(0);
    setRunEvents([]);
    setComparisons({});
    compReadersRef.current.forEach(r => r.cancel());
    compReadersRef.current = [];

    if (mode === 'compare') {
      const modeConfigs = [
        { mode: 'cpu_seq', processes: 1 },
        { mode: 'cpu_par', processes: 2 },
        { mode: 'cpu_par', processes: 4 },
        { mode: 'cpu_par', processes: 8 },
        { mode: 'cpu_omp', processes: 8 }
      ];

      // Reset comparisons
      const initialComp = {};
      modeConfigs.forEach(cfg => {
        initialComp[`${cfg.mode}_${cfg.processes}`] = { status: 'running', iteration: 0, result: null };
      });
      setComparisons(initialComp);
      setCurrentTab('run');

      modeConfigs.forEach(async (cfg) => {
        const id = `${cfg.mode}_${cfg.processes}`;
        try {
          const res = await fetch('/api/run/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dataset, mode: cfg.mode, processes: cfg.processes, visualize: false }),
          });
          if (!res.ok) throw new Error('Failed');
          const reader = res.body.getReader();
          compReadersRef.current.push(reader);
          const decoder = new TextDecoder();
          let buf = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n\n');
            buf = lines.pop();
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const ev = JSON.parse(line.slice(6));
              if (ev.type === 'iteration') {
                setComparisons(prev => ({
                  ...prev,
                  [id]: { ...prev[id], iteration: ev.data.iteration, iterations: ev.data.iterations }
                }));
              }
              if (ev.type === 'complete') {
                setComparisons(prev => ({
                  ...prev,
                  [id]: { ...prev[id], status: 'complete', result: ev.data }
                }));
              }
            }
          }
        } catch (e) {
          setComparisons(prev => ({ ...prev, [id]: { ...prev[id], status: 'error' } }));
        }
      });
      setLoading(false);
      return;
    }

    if (liveMode) {
      try {
        const res = await fetch('/api/run/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataset, mode, processes, visualize: visualizeMode }),
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
              if (ev.type === 'worker') {
                setRunEvents(prev => {
                  const now = [...prev, ev];
                  if (now.length > 300) return now.slice(100);
                  return now;
                });
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
          body: JSON.stringify({ dataset, mode, processes, visualize: visualizeMode }),
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

  // ── Restore from history ──────────────────────────────────────────────────
  const handleRestore = (record) => {
    if (record.dataset) setSelectedDataset(record.dataset);
    setStatus(`Restored: ${record.dataset} · ${record.iterations} iters · ${record.mode}`);
    setCurrentTab('run');
  };

  const handleRestoreScrape = (events) => {
    setScrapeEvents(events);
    setStatus(`Replaying session: ${events.length} events loaded.`);
    handleTabChange('scrape');
  };

  // ── Benchmark ─────────────────────────────────────────────────────────────
  const handleBenchmark = async ({ datasets, processes, target }) => {
    if (!datasets || datasets.length === 0) return;
    setLoading(true);
    setBenchmarkResult(null);
    const accumulated = [];
    for (let i = 0; i < datasets.length; i++) {
      const ds = datasets[i];
      setStatus(`Benchmarking ${ds} (${i + 1}/${datasets.length})...`);
      try {
        const res = await fetch('/api/benchmark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataset: ds, processes, target }),
        });
        const data = await res.json();
        if (data.success) {
          accumulated.push({ dataset: ds, results: data.results });
          // Show partial results as they come in
          setBenchmarkResult([...accumulated]);
        } else {
          accumulated.push({ dataset: ds, results: [], error: data.error });
        }
      } catch (err) {
        accumulated.push({ dataset: ds, results: [], error: err.message });
      }
    }
    setStatus(`Benchmark complete — ${accumulated.length} dataset${accumulated.length > 1 ? 's' : ''}.`);
    setBenchmarkResult(accumulated);
    setLoading(false);
  };

  // ── BFS ───────────────────────────────────────────────────────────────────
  const handleBFS = async ({ dataset, mode, processes, source }) => {
    const targetDS = pendingDataset || dataset;
    setLoading(true); setBfsResult(null); setSsspResult(null); setShowSSSP(false);
    setSelectedDataset(targetDS);
    setStatus(`Running BFS from node ${source}...`);
    try {
      const res = await fetch('/api/bfs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataset: targetDS, mode, processes, source }) });
      const data = await res.json();
      if (data.success) { setBfsResult(data.data); setStatus(`BFS done: ${data.data.reachable}/${data.data.nodes} reachable, max depth ${data.data.max_distance}`); }
      else setStatus(`BFS Error: ${data.error}`);
    } catch (err) { setStatus(`Error: ${err.message}`); }
    finally { setLoading(false); }
  };

  // ── SSSP ──────────────────────────────────────────────────────────────────
  const handleSSP = async ({ dataset, source, target }) => {
    const targetDS = pendingDataset || dataset;
    setLoading(true); setSsspResult(null); setShowSSSP(true);
    setStatus(`Finding shortest path: ${source} → ${target}...`);
    try {
      const res = await fetch('/api/sssp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataset: targetDS, source, target }) });
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
            setScrapeEvents(p => [...p, ev]);
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
      setScrapeEvents(events => {
        if (events.length > 5) {
          fetch('/api/scrape/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metadata: { startUrl, maxDepth }, events })
          }).catch(console.error);
        }
        return events;
      });
    }
  };

  const stopScrape = () => readerRef.current?.cancel();

  // Whether we're in the immersive scrape-active fullscreen
  const scrapeFullscreen = currentTab === 'scrape' && isScraping;
  const sidebarMinimized = scrapeFullscreen || isSidebarCollapsed;

  return (
    <main className={`flex flex-col text-[var(--foreground)] font-sans selection:bg-blue-500/30 ${scrapeFullscreen ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur-xl shrink-0 w-full sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl shadow-lg shadow-blue-500/20">
            <Layers size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight flex items-center gap-2.5">
              TEMPORALOOM
              <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20 font-mono">v2.1 // ALPHA</span>
            </h1>
            <p className="text-[var(--text-muted)] text-[11px] font-semibold uppercase tracking-widest">Distributed Graph Analytics Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-5 px-6 py-3 bg-[var(--background)] rounded-2xl border border-[var(--border)] shadow-xl">
          <button onClick={toggleTheme} className="p-2 hover:bg-[var(--surface-hover)] rounded-xl transition-colors text-[var(--text-dim)] hover:text-[var(--foreground)]" title="Toggle Theme">
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <div className="w-px h-7 bg-[var(--border)]" />
          <div className="flex flex-col">
            <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">Engine</span>
            <span className="text-xs text-green-400 flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /> Operational
            </span>
          </div>
          <div className="w-px h-7 bg-[var(--border)]" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">Visualize</span>
            <button onClick={() => setVisualizeMode(p => !p)} className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${visualizeMode ? 'text-purple-400' : 'text-[var(--text-dim)]'}`}>
              <Binary size={12} className={visualizeMode ? 'animate-pulse' : ''} />
              {visualizeMode ? 'On' : 'Off'}
            </button>
          </div>
          <div className="w-px h-7 bg-[var(--border)]" />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">Live Stream</span>
            <button onClick={() => setLiveMode(p => !p)} disabled={!visualizeMode} className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${!visualizeMode ? 'opacity-30 cursor-not-allowed' : (liveMode ? 'text-blue-400' : 'text-[var(--text-dim)]')}`}>
              <Radio size={12} className={liveMode && visualizeMode ? 'animate-pulse' : ''} />
              {liveMode && visualizeMode ? 'On' : 'Off'}
            </button>
          </div>
          <div className="w-px h-7 bg-[var(--border)]" />
          <div className="flex flex-col">
            <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">Datasets</span>
            <Link href="/datasets" className="text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors">Open Manager →</Link>
          </div>
          {status && (
            <>
              <div className="w-px h-7 bg-[var(--border)]" />
              <div className="max-w-xs">
                <span className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest block">Status</span>
                <span className="text-[11px] text-[var(--foreground)]/70 font-mono truncate block">{status}</span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className={`flex flex-1 min-h-0 transition-all duration-500 ${scrapeFullscreen ? '' : ''}`}>

        {/* ── Sidebar ── */}
        <aside className={`transition-all duration-500 flex flex-col border-r border-[var(--border)] bg-[var(--surface)]/40 shrink-0 relative ${sidebarMinimized ? 'w-16' : 'w-[340px] xl:w-[380px]'}`}>
          
          {/* Collapse toggle */}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute -right-3.5 top-8 z-20 w-7 h-7 bg-[var(--surface)] border border-[var(--border)] rounded-full flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--foreground)] transition-all shadow-xl hover:scale-110 active:scale-95"
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>

          <div className={`flex flex-col gap-5 p-5 overflow-y-auto custom-scrollbar h-full ${sidebarMinimized ? 'items-center pt-6' : ''}`}>
            {/* Control Panel */}
            <div className={sidebarMinimized ? 'scale-90' : ''}>
              <ControlPanel
                onRun={handleRun} onBenchmark={handleBenchmark} onBFS={handleBFS}
                onScrape={handleScrape} onSSP={handleSSP}
                loading={loading} status={status}
                currentTab={currentTab} setCurrentTab={handleTabChange}
                liveMode={liveMode}
                minimized={sidebarMinimized}
                dataset={pendingDataset}
                setDataset={setPendingDataset}
              />
            </div>

            {/* History + About — only in full sidebar */}
            {!sidebarMinimized && (
              <AnimatePresence>
                <motion.div
                  key="sidebar-extras"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="flex flex-col gap-5"
                >
                  {currentTab === 'scrape' ? (
                    <ScrapeHistory onRestore={handleRestoreScrape} />
                  ) : (
                    <RunHistory onRestore={handleRestore} />
                  )}

                  <div className="p-5 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl">
                    <div className="flex items-center gap-2 text-[var(--text-dim)] font-bold text-xs uppercase tracking-widest mb-3">
                      <Info size={14} /> About System
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed font-medium">
                      Temporaloom implements PageRank, BFS, and SSSP across CPU Sequential, MPI, and CUDA backends with live SSE streaming. Web-crawled topology ingestion constructs datasets in real-time.
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className={`flex-1 min-w-0 flex flex-col min-h-0 overflow-auto custom-scrollbar p-6 gap-6 ${scrapeFullscreen ? 'overflow-hidden' : ''}`}>
          <AnimatePresence mode="wait">

            {/* BENCHMARK */}
            {currentTab === 'benchmark' && (
              <motion.div key="benchmark" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6 h-full">
                <BenchmarkChart data={benchmarkResult} loading={loading && !benchmarkResult} />
              </motion.div>
            )}

            {/* BFS */}
            {currentTab === 'bfs' && (
              <motion.div key="bfs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">
                <div className="flex items-center gap-4 px-1">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400"><GitBranch size={18} /></div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-widest block">Graph Traversal · BFS + SSSP</span>
                    <span className="text-base text-[var(--foreground)] font-bold">{selectedDataset || 'Select a dataset'}</span>
                  </div>
                </div>

                {showSSSP && ssspResult && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                    className={`p-5 rounded-2xl border flex items-start gap-4 ${ssspResult.path?.length > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                    <GitMerge size={18} className={ssspResult.path?.length > 0 ? 'text-emerald-400 mt-0.5 shrink-0' : 'text-red-400 mt-0.5 shrink-0'} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black uppercase tracking-widest mb-2 text-[var(--text-dim)]">
                        Shortest Path — Node {ssspResult.source} → {ssspResult.target}
                      </div>
                      {ssspResult.path?.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {ssspResult.path.map((n, i) => (
                            <span key={i} className="flex items-center gap-1">
                              <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-md text-xs font-black font-mono text-emerald-300">{n}</span>
                              {i < ssspResult.path.length - 1 && <span className="text-[var(--text-dim)] text-sm">→</span>}
                            </span>
                          ))}
                          <span className="ml-2 text-xs text-[var(--text-dim)] font-mono">({ssspResult.distance} hops · {ssspResult.execution_time?.toFixed(4)}s)</span>
                        </div>
                      ) : (
                        <span className="text-red-400 font-bold text-sm">Unreachable</span>
                      )}
                    </div>
                    <button onClick={() => setShowSSSP(false)} className="text-[var(--text-dim)] hover:text-[var(--foreground)] text-sm font-mono shrink-0">✕</button>
                  </motion.div>
                )}

                <BFSResult data={bfsResult} loading={loading && !bfsResult} />
              </motion.div>
            )}

            {/* SCRAPE */}
            {currentTab === 'scrape' && (
              <motion.div key="scrape" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`flex flex-col gap-6 ${scrapeFullscreen ? 'h-full min-h-0' : ''}`}>
                <ScrapeVisualizer events={scrapeEvents} isScraping={isScraping} onStop={stopScrape} />
              </motion.div>
            )}

            {/* RUN */}
            {currentTab === 'run' && (
              <motion.div key="run" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-col gap-6">

                {/* Live streaming indicator */}
                {loading && liveMode && (
                  <div className="flex items-center gap-4 px-5 py-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                    <Radio size={16} className="text-blue-500 animate-pulse shrink-0" />
                    <div className="flex-1">
                      <span className="text-xs font-black uppercase text-blue-400 tracking-widest">Live Stream Active</span>
                      <span className="text-xs text-[var(--text-dim)] ml-3">{liveIterCount} iterations received</span>
                    </div>
                    <button onClick={stopLive} className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/15 px-4 py-1.5 rounded-lg font-bold uppercase">Stop</button>
                  </div>
                )}

                {/* Comparison Dashboard */}
                {Object.keys(comparisons).length > 0 && (
                  <ComparisonDashboard comparisons={comparisons} />
                )}

                {/* Engine Worker Visualization */}
                <AnimatePresence>
                  {loading && runEvents.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                      animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
                      exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                      className="overflow-hidden"
                    >
                      <RunWorkerStats events={runEvents} loading={loading} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Graph viewer */}
                <div className="relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-visible min-h-[500px]">
                  <div className="absolute top-6 left-6 z-10 flex items-center gap-3 pointer-events-none">
                    <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400"><Binary size={18} /></div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-[var(--text-muted)] font-black uppercase tracking-widest">Graph Simulation</span>
                      <span className="text-sm text-[var(--foreground)] font-bold">{visualizeMode ? (selectedDataset || 'Waiting...') : 'Visualization Disabled'}</span>
                    </div>
                  </div>

                  {/* Iteration controls */}
                  {runResult && visualizeMode && (
                    <div className="absolute bottom-6 left-6 right-6 z-10 flex items-center gap-5 bg-[var(--background)]/85 backdrop-blur-xl p-4 rounded-2xl border border-[var(--border)] shadow-xl">
                      <div className="flex flex-col shrink-0 w-16">
                        <span className="text-[9px] text-[var(--text-dim)] font-bold uppercase">Iter</span>
                        <span className="text-base text-[var(--foreground)] font-black font-mono leading-none">
                          {iteration}<span className="text-[var(--text-dim)] text-xs">/{runResult.iterations - 1}</span>
                        </span>
                      </div>
                      <input type="range" min="0" max={runResult.iterations - 1} value={iteration}
                        onChange={e => { setIsPlaying(false); setIteration(parseInt(e.target.value)); }}
                        onMouseUp={e => { if (!liveMode) fetchIteration(parseInt(e.target.value)); }}
                        onTouchEnd={e => { if (!liveMode) fetchIteration(parseInt(e.target.value)); }}
                        className="flex-1 accent-blue-500 h-1.5 rounded-full bg-[var(--border)] cursor-pointer" />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => { setIsPlaying(false); const n = Math.max(0, iteration-1); setIteration(n); if (!liveMode) fetchIteration(n); }}
                          className="p-2.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-lg border border-[var(--border)] transition-all text-[var(--text-dim)] hover:text-[var(--foreground)]"><SkipBack size={16} /></button>
                        <button onClick={togglePlay} className={`p-3 rounded-lg border transition-all ${isPlaying ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]/70 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]'}`}>
                          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                        </button>
                        <button onClick={() => { setIsPlaying(false); const n = Math.min(runResult.iterations-1, iteration+1); setIteration(n); if (!liveMode) fetchIteration(n); }}
                          className="p-2.5 bg-[var(--surface)] hover:bg-[var(--surface-hover)] rounded-lg border border-[var(--border)] transition-all text-[var(--text-dim)] hover:text-[var(--foreground)]"><SkipForward size={16} /></button>
                      </div>
                      <select value={playSpeed} onChange={e => setPlaySpeed(parseInt(e.target.value))}
                        className="bg-transparent text-[var(--text-dim)] text-xs font-bold border border-[var(--border)] rounded-md px-2 py-1.5 cursor-pointer focus:outline-none hover:text-[var(--foreground)] transition-colors shrink-0">
                        <option value={1000}>Slow</option><option value={500}>Normal</option>
                        <option value={200}>Fast</option><option value={50}>Ultra</option>
                      </select>
                    </div>
                  )}

                  {visualizeMode ? (
                    <GraphViewer
                      dataset={selectedDataset}
                      iterationData={iterationData}
                      onNodeClick={setSelectedNode}
                      onGraphLoaded={setGraphStats}
                      theme={theme}
                    />
                  ) : (
                    <div className="w-full h-[500px] flex items-center justify-center flex-col gap-4 text-[var(--text-dim)] bg-[var(--background)]/30 rounded-2xl">
                      <Binary size={48} className="opacity-20" />
                      <span className="text-sm font-bold uppercase tracking-widest text-[#555]">Visualization Graph Disabled to save resources</span>
                    </div>
                  )}
                </div>

                {/* Stats toggle */}
                {runResult && (
                  <button
                    onClick={() => setShowStats(s => !s)}
                    className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border font-black text-xs uppercase tracking-widest transition-all w-fit ${showStats ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--foreground)] hover:border-[var(--text-muted)]'}`}
                  >
                    <BarChart2 size={14} /> {showStats ? 'Hide Stats' : 'Show Graph Stats'}
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
                <div className="grid grid-cols-12 gap-6" style={{ minHeight: '300px' }}>
                  <div className="col-span-8">
                    {runResult ? <PerformanceChart results={runResult} /> : (
                      <div className="h-full bg-[var(--surface)] rounded-2xl border border-[var(--border)] border-dashed flex flex-col items-center justify-center gap-4 text-[var(--text-dim)] transition-all">
                        <Terminal size={36} />
                        <span className="text-sm font-bold uppercase tracking-widest">Execute simulation to view metrics</span>
                      </div>
                    )}
                  </div>
                  <div className="col-span-4 bg-gradient-to-br from-[var(--surface)] to-[var(--surface-hover)] rounded-2xl border border-[var(--border)] shadow-xl p-7 relative overflow-hidden flex flex-col justify-end group hover:border-blue-500/20 transition-all">
                    <Zap size={110} className="absolute -top-6 -right-6 text-blue-600/5 rotate-12 group-hover:text-blue-600/10 transition-all" />
                    <span className="text-xs text-blue-500 font-black uppercase tracking-widest mb-1.5 block">Architecture Mode</span>
                    <h2 className="text-5xl font-black tracking-tighter text-[var(--foreground)] uppercase">
                      {runResult?.mode ? runResult.mode.replace('_', ' ') : 'N/A'}
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] font-bold leading-relaxed mt-2 uppercase tracking-tight">
                      {liveMode ? '⚡ Live stream active' : 'Batch execution mode'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </main>
  );
}
