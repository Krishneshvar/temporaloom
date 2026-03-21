'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Zap, Info, Play, ChevronRight, Binary, Terminal } from 'lucide-react';
import GraphViewer from '@/components/GraphViewer';
import ControlPanel from '@/components/ControlPanel';
import PerformanceChart from '@/components/PerformanceChart';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [selectedDataset, setSelectedDataset] = useState('');
  const [runResult, setRunResult] = useState(null);
  const [iteration, setIteration] = useState(0);
  const [iterationData, setIterationData] = useState(null);

  const handleRun = async ({ dataset, useMPI, processes }) => {
    setLoading(true);
    setStatus('Initializing simulation...');
    setSelectedDataset(dataset);
    setIteration(0);
    setIterationData(null);

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset, useMPI, processes }),
      });
      const data = await res.json();
      if (data.success) {
        setRunResult(data.data);
        setStatus(`Converged in ${data.data.iterations} iterations.`);
        // Load final iteration by default
        fetchIteration(data.data.iterations - 1);
        setIteration(data.data.iterations - 1);
      } else {
        setStatus(`Error: ${data.message}`);
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
              <span className="bg-blue-500/10 text-blue-400 text-[10px] px-2 py-0.5 rounded-full border border-blue-500/20 font-mono">v1.2 // ALPHA</span>
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
          <div className="w-[1px] h-8 bg-[#222]" />
          <div className="flex flex-col">
            <span className="text-[10px] text-[#555] font-bold uppercase">Latency</span>
            <span className="text-xs text-white font-bold font-mono">2.4ms</span>
          </div>
        </div>
      </header>

      {/* Grid Layout */}
      <div className="grid grid-cols-12 gap-6 max-w-[1400px] mx-auto min-h-[calc(100vh-160px)] pb-20">
        {/* Sidebar Controls */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6">
          <div className="sticky top-6 flex flex-col gap-6">
            <ControlPanel onRun={handleRun} loading={loading} status={status} />
            
            <div className="p-6 bg-[#111] rounded-2xl border border-[#222] shadow-xl">
              <div className="flex items-center gap-2 text-white/50 font-bold text-xs mb-4">
                <Info size={14} />
                <span>Project Details</span>
              </div>
              <p className="text-xs text-[#666] leading-relaxed font-medium">
                Temporaloom implements iterative PageRank using MPI-based distributed computation. 
                The engine automatically handles partitioning of large-scale graphs across processes.
              </p>
            </div>
          </div>
        </div>

        {/* Main Graph Viewer */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-6">
          <div className="relative flex-1 bg-[#111] rounded-2xl border border-[#222] shadow-2xl overflow-hidden group">
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
                 <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-1 block">Parallel Speedup</span>
                 <h2 className="text-4xl font-black tracking-tighter text-white">
                   {runResult?.speedup || '0.00'}<span className="text-lg opacity-30 ml-1">x</span>
                 </h2>
                 <p className="text-[10px] text-[#555] font-bold leading-relaxed mt-2 uppercase tracking-tight">
                    Performance gain achieved via distributed multi-process execution.
                 </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
