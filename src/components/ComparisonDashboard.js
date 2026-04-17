'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, Zap, Activity, Clock, CheckCircle2, AlertCircle, BarChart3, Binary, HardDrive } from 'lucide-react';

export default function ComparisonDashboard({ comparisons }) {
  const modes = Object.entries(comparisons).sort((a, b) => {
    // Put finished ones at bottom? Or just alphabetic?
    return a[0].localeCompare(b[0]);
  });

  const bestTime = Math.min(...modes.map(([_, data]) => data.result?.execution_time || Infinity));

  return (
    <div className="flex flex-col gap-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-blue-500/5 border border-blue-500/10 rounded-2xl relative overflow-hidden group">
          <Activity size={80} className="absolute -right-6 -top-6 text-blue-500/10 rotate-12 transition-transform group-hover:scale-110" />
          <div className="flex flex-col gap-1 relative z-10">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Active Engines</span>
            <span className="text-3xl font-black text-[var(--foreground)]">{modes.filter(([_, d]) => d.status === 'running').length} / {modes.length}</span>
          </div>
        </div>
        <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl relative overflow-hidden group">
          <Zap size={80} className="absolute -right-6 -top-6 text-emerald-500/10 -rotate-12 transition-transform group-hover:scale-110" />
          <div className="flex flex-col gap-1 relative z-10">
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Fastest Convergence</span>
            <span className="text-3xl font-black text-[var(--foreground)]">
              {bestTime === Infinity ? '—' : `${bestTime.toFixed(4)}s`}
            </span>
          </div>
        </div>
        <div className="p-6 bg-purple-500/5 border border-purple-500/10 rounded-2xl relative overflow-hidden group">
          <BarChart3 size={80} className="absolute -right-6 -top-6 text-purple-500/10 rotate-45 transition-transform group-hover:scale-110" />
          <div className="flex flex-col gap-1 relative z-10">
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Global Memory usage</span>
            <span className="text-3xl font-black text-[var(--foreground)]">NOMINAL</span>
          </div>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence>
          {modes.map(([mode, data]) => (
            <ComparisonCard 
              key={mode} 
              mode={mode} 
              data={data} 
              isWinner={data.result?.execution_time === bestTime && bestTime !== Infinity} 
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ComparisonCard({ mode, data, isWinner }) {
  const isFinished = data.status === 'complete';
  const isError = data.status === 'error';
  const isRunning = data.status === 'running';

  const progress = isFinished ? 100 : (data.iterations ? (data.iteration / data.iterations) * 100 : 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-6 rounded-2xl border transition-all duration-500 flex flex-col gap-5 ${
        isWinner 
          ? 'bg-emerald-500/10 border-emerald-500/30 ring-2 ring-emerald-500/20' 
          : isFinished 
          ? 'bg-[var(--surface)] border-[var(--border)]' 
          : 'bg-[var(--surface-hover)] border-blue-500/20'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${isRunning ? 'bg-blue-600 shadow-blue-500/20 animate-pulse' : isFinished ? 'bg-emerald-600 shadow-emerald-500/20' : 'bg-[var(--background)]'}`}>
            {mode.startsWith('gpu') ? <Zap size={18} className="text-white" /> : <Cpu size={18} className="text-white" />}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black text-[var(--foreground)] uppercase tracking-widest">{mode.replace('_', ' ')}</span>
            <span className={`text-[10px] font-bold uppercase tracking-tight ${isRunning ? 'text-blue-400' : isFinished ? 'text-emerald-400' : 'text-red-400'}`}>
              {data.status}
            </span>
          </div>
        </div>

        {isWinner && (
          <div className="px-3 py-1 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-full shadow-lg">
            Optimal Path
          </div>
        )}
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-4 border-y border-[var(--border)]/50 py-4">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-[var(--text-dim)] uppercase leading-none mb-1">Runtime</span>
          <span className="text-base font-mono font-bold text-[var(--foreground)] leading-none">
            {isFinished ? `${data.result.execution_time.toFixed(4)}s` : isRunning ? <Clock size={14} className="animate-spin opacity-40 mt-1" /> : '—'}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-[var(--text-dim)] uppercase leading-none mb-1">Iters</span>
          <span className="text-base font-mono font-bold text-[var(--foreground)] leading-none">
            {isFinished ? data.result.iterations : isRunning ? `${data.iteration || 0}+` : '—'}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-[var(--text-dim)] uppercase leading-none mb-1">Setup</span>
          <span className="text-base font-mono font-bold text-[var(--foreground)] leading-none">
            {mode.includes('mpi') ? 'Cluster' : mode.includes('gpu') ? 'GPU Lat' : 'Local'}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black text-[var(--text-dim)] uppercase">Convergence Progress</span>
          <span className="text-[10px] font-mono font-bold">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full bg-[var(--background)] rounded-full border border-[var(--border)] overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className={`h-full transition-all duration-300 ${isFinished ? 'bg-emerald-500' : 'bg-blue-500'}`}
          />
        </div>
      </div>

      {/* Speedup indicator only if finished and not baseline */}
      {isFinished && !mode.includes('seq') && (
        <div className="mt-auto pt-2 flex items-center gap-2">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Efficiency:</span>
            <span className="text-xs font-mono font-bold">{(data.result.speedup || 1.0).toFixed(2)}x Speedup</span>
        </div>
      )}
    </motion.div>
  );
}
