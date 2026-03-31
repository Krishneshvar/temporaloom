'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Zap, Info, ChevronRight, Binary, Terminal, ShieldAlert } from 'lucide-react';
import GraphViewer from '@/components/GraphViewer';
import ControlPanel from '@/components/ControlPanel';
import PerformanceChart from '@/components/PerformanceChart';
import BenchmarkChart from '@/components/BenchmarkChart';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [selectedDataset, setSelectedDataset] = useState('');
  
  // Standard Execution State
  const [runResult, setRunResult] = useState(null);
  const [iteration, setIteration] = useState(0);
  const [iterationData, setIterationData] = useState(null);

  // System State
  const [currentTab, setCurrentTab] = useState('run');
  const [benchmarkResult, setBenchmarkResult] = useState(null);

  const handleRun = async ({ dataset, mode, processes }) => {
    setLoading(true);
    setStatus('Initializing simulation sequence...');
    setSelectedDataset(dataset);
    setIteration(0);
    setIterationData(null);

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset, mode, processes }),
      });
      const data = await res.json();
      if (data.success) {
        setRunResult(data.data);
        setStatus(`Converged in ${data.data.iterations} iterations [${data.data.mode.toUpperCase()}].`);
        // Load final iteration by default
        fetchIteration(data.data.iterations - 1);
        setIteration(data.data.iterations - 1);
      } else {
        setStatus(`Error: ${data.message || data.error}`);
      }
    } catch (err) {
      setStatus(`System Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBenchmark = async ({ dataset, processes }) => {
    setLoading(true);
    setStatus('Running 4-stage benchmark suite. This will take time...');
    setSelectedDataset(dataset);
    setBenchmarkResult(null);

    try {
      const res = await fetch('/api/benchmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset, processes }),
      });
      const data = await res.json();
      if (data.success) {
        setBenchmarkResult(data.results);
        setStatus(`Benchmark complete. Mapped performance profiles.`);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`System Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async ({ startUrl, maxDepth }) => {
    setLoading(true);
    setStatus(`Crawling topology for ${startUrl}...`);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startUrl, maxDepth }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.data.message);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`System Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchIteration = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/iterations/${id}`);
      if (res.ok) {
        const data = await res.json();
        setIterationData(data);
      }
    } catch (err) {
      console.error('Failed to fetch iteration', err);
    }
  }, []);

  useEffect(() => {
    if (runResult) {
      fetchIteration(iteration);
    }
  }, [iteration, runResult, fetchIteration]);

  return (
    <main className="min-h-screen bg-[#050505] text-white p-6 font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500/20">
            <Layers size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              TEMPORALOOM
              <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20 font-mono">v1.3 // ALPHA</span>
            </h1>
            <p className="text-[#555] text-xs font-semibold uppercase tracking-widest">Distributed PageRank Analytics Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-6 px-6 py-3 bg-[#111] rounded-2xl border border-[#222] shadow-xl">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#555] font-bold uppercase">Engine Status</span>
            <span className="text-xs text-green-400 flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Operational
            </span>
          </div>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-12 gap-6 max-w-[1400px] mx-auto min-h-[calc(100vh-160px)] pb-20">
        
        {/* Sidebar Controls */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
          <div className="sticky top-6 flex flex-col gap-6">
            <ControlPanel 
               onRun={handleRun} 
               onBenchmark={handleBenchmark}
               onScrape={handleScrape}
               loading={loading} 
               status={status} 
               currentTab={currentTab}
               setCurrentTab={setCurrentTab}
            />
            
            <div className="p-6 bg-[#111] rounded-2xl border border-[#222] shadow-xl">
              <div className="flex items-center gap-2 text-white/50 font-bold text-xs mb-4">
                <Info size={14} />
                <span>Project Details</span>
              </div>
              <p className="text-xs text-[#666] leading-relaxed font-medium">
                Temporaloom implements iterative PageRank using distributed computation. It now supports Native Threading, MPI, and Parallel CUDA optimizations. Web-crawled network ingestion automatically constructs matrices in real-time.
              </p>
            </div>
          </div>
        </div>

        {/* Main Interface Portals */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-6">
          
          <AnimatePresence mode="wait">
            {/* ---- BENCHMARK TAB ---- */}
            {currentTab === 'benchmark' && (
              <motion.div 
                 key="benchmark"
                 initial={{ opacity: 0, scale: 0.98 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.98 }}
                 className="flex flex-col gap-6"
              >
                  <BenchmarkChart data={benchmarkResult} loading={loading && !benchmarkResult} />
              </motion.div>
            )}

            {/* ---- SCRAPE TAB ---- */}
            {currentTab === 'scrape' && (
              <motion.div 
                 key="scrape"
                 initial={{ opacity: 0, scale: 0.98 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.98 }}
                 className="flex flex-col gap-6 h-full min-h-[500px]"
              >
                  <div className="h-full flex-1 bg-[#111] rounded-2xl border border-[#222] border-dashed flex flex-col items-center justify-center p-8 text-center pattern-isometric pattern-white/5 pattern-size-10">
                     <ShieldAlert size={48} className="text-purple-500 mb-6 opacity-80" />
                     <h2 className="text-2xl font-black tracking-tight text-white mb-2">Automated Web Crawler</h2>
                     <p className="text-[#666] text-sm max-w-md">
                        Input a target URL to deeply traverse its hyperlink topology and assemble an edge-mapped dataset algorithmically. This bypasses static datasets for real-time web PageRank execution.
                     </p>
                  </div>
              </motion.div>
            )}

            {/* ---- RUN TAB ---- */}
            {currentTab === 'run' && (
              <motion.div 
                 key="run"
                 initial={{ opacity: 0, scale: 0.98 }}
                 animate={{ opacity: 1, scale: 1 }}
                 exit={{ opacity: 0, scale: 0.98 }}
                 className="flex flex-col gap-6"
              >
                {/* Main Graph Viewer */}
                <div className="relative flex-1 bg-[#111] rounded-2xl border border-[#222] shadow-2xl overflow-hidden group min-h-[400px]">
                  <div className="absolute top-6 left-6 z-10 flex items-center gap-2 pointer-events-none">
                    <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
                      <Binary size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#555] font-bold uppercase">Dynamic Graph Simulation</span>
                      <span className="text-xs text-white font-bold">{selectedDataset || 'Waiting for activation...'}</span>
                    </div>
                  </div>

                  {/* Iteration Control Overlay */}
                  {runResult && (
                    <div className="absolute bottom-6 left-6 right-6 z-10 flex items-center gap-6 bg-[#000]/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl">
                      <div className="flex flex-col shrink-0">
                        <span className="text-[10px] text-white/30 font-bold uppercase">Iteration Step</span>
                        <span className="text-lg text-white font-black font-mono leading-none tracking-tighter">
                          {iteration}/{runResult.iterations - 1}
                        </span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max={runResult.iterations - 1} 
                        value={iteration} 
                        onChange={(e) => setIteration(parseInt(e.target.value))}
                        className="flex-1 accent-blue-500 h-1 rounded-full bg-white/10" 
                      />
                      <div className="flex items-center gap-2">
                        <button className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all text-white/50 hover:text-white">
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </div>
                  )}

                  <GraphViewer dataset={selectedDataset} iterationData={iterationData} />
                </div>

                {/* Bottom Statistics and Performance */}
                <div className="grid grid-cols-12 gap-6 h-[280px]">
                  <div className="col-span-8">
                    {runResult ? (
                      <PerformanceChart results={runResult} />
                    ) : (
                      <div className="h-full bg-[#111] rounded-2xl border border-[#222] border-dashed flex flex-col items-center justify-center gap-3 text-white/10 group-hover:border-white/20 transition-all">
                        <Terminal size={32} />
                        <span className="text-xs font-bold uppercase tracking-widest">Execute simulation to view metrics</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="col-span-4 bg-gradient-to-br from-[#111] to-[#1a1a1a] rounded-2xl border border-[#222] shadow-xl p-6 relative overflow-hidden flex flex-col justify-end group transition-all hover:border-blue-500/20">
                    <Zap size={100} className="absolute -top-6 -right-6 text-blue-600/5 rotate-12 transition-all group-hover:text-blue-600/10" />
                    <div className="mb-2">
                      <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-1 block">Architecture Mode</span>
                      <h2 className="text-4xl font-black tracking-tighter text-white uppercase">
                        {runResult?.mode ? runResult.mode.replace('_', ' ') : 'N/A'}
                      </h2>
                      <p className="text-[10px] text-[#555] font-bold leading-relaxed mt-2 uppercase tracking-tight">
                          Active execution profile dictating speedup calculations and hardware bounds.
                      </p>
                    </div>
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
