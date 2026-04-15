'use client';

import { useState, useEffect } from 'react';
import { Play, Activity, Cpu, Database, Settings2, Globe, Search, BarChart3, Zap, GitBranch, GitMerge } from 'lucide-react';

export default function ControlPanel({ onRun, onBenchmark, onScrape, onBFS, onSSP, loading, status, currentTab, setCurrentTab, liveMode, minimized = false, dataset, setDataset }) {
  const [datasets, setDatasets] = useState([]);

  const [execMode, setExecMode]   = useState('cpu_seq');
  const [processes, setProcesses] = useState(4);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [maxDepth, setMaxDepth]   = useState(2);
  const [bfsMode, setBfsMode]     = useState('bfs_seq');
  const [bfsProcesses, setBfsProcesses] = useState(4);
  const [bfsSource, setBfsSource] = useState(0);
  const [sspSource, setSspSource] = useState(0);
  const [sspTarget, setSspTarget] = useState(1);
  const [sspMode, setSspMode]     = useState('sssp_seq');
  const [maxCores, setMaxCores]   = useState(8);
  const [benchmarkTarget, setBenchmarkTarget] = useState('all');

  useEffect(() => {
    fetch('/api/datasets').then(r => r.json()).then(d => { if (Array.isArray(d)) setDatasets(d); }).catch(() => {});
    fetch('/api/system').then(r => r.json()).then(d => { if (d.cores) setMaxCores(d.cores); }).catch(() => {});
  }, []);

  const TABS = [
    { id: 'run',       label: 'Run',   icon: <Play size={14} /> },
    { id: 'benchmark', label: 'Bench', icon: <BarChart3 size={14} /> },
    { id: 'bfs',       label: 'BFS',   icon: <GitBranch size={14} /> },
    { id: 'scrape',    label: 'Scrape',icon: <Globe size={14} /> },
  ];

  if (minimized) {
    const activeTab = TABS.find(t => t.id === currentTab) || TABS[0];
    const getAction = () => {
      if (currentTab === 'run') return { icon: <Play size={18} />, onClick: () => onRun({ dataset, mode: execMode, processes }), color: 'bg-blue-600 hover:bg-blue-500', title: 'Run Simulation' };
      if (currentTab === 'benchmark') return { icon: <BarChart3 size={18} />, onClick: () => onBenchmark({ dataset, processes, target: benchmarkTarget }), color: 'bg-emerald-600 hover:bg-emerald-500', title: 'Start Benchmark' };
      if (currentTab === 'bfs') return { icon: <GitBranch size={18} />, onClick: () => onBFS?.({ dataset, mode: bfsMode, processes: bfsProcesses, source: bfsSource }), color: 'bg-emerald-600 hover:bg-emerald-500', title: 'Run BFS' };
      return { icon: <Search size={18} />, onClick: () => onScrape({ startUrl: scrapeUrl, maxDepth }), color: 'bg-purple-600 hover:bg-purple-500', title: 'Generate Graph' };
    };
    const action = getAction();
    return (
      <div className="flex flex-col gap-4 p-3 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-2xl">
        <div className="flex flex-col items-center gap-4">
          <div className="p-2 bg-[var(--background)]/10 rounded-lg border border-[var(--border)] text-[var(--text-dim)]">{activeTab.icon}</div>
          <div className="h-px w-full bg-[var(--border)]" />
          <button onClick={action.onClick} disabled={loading || (currentTab === 'scrape' ? !scrapeUrl : !dataset)}
            className={`w-10 h-10 ${action.color} rounded-xl flex items-center justify-center text-white transition-all active:scale-90 shadow-lg disabled:opacity-20`} title={action.title}>
            {loading ? <Activity className="animate-spin" size={18} /> : action.icon}
          </button>
        </div>
      </div>
    );
  }

  const labelCls = 'text-sm text-[var(--text-muted)] font-semibold flex items-center gap-2';
  const inputCls = 'bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm w-full';

  return (
    <div className="flex flex-col gap-5 p-5 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-2xl font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-[var(--foreground)] font-bold">
          <Settings2 size={18} />
          <span className="text-sm font-black uppercase tracking-widest">Control Center</span>
        </div>
        {liveMode && (
          <span className="text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-0.5 rounded-full font-black uppercase tracking-widest animate-pulse">⚡ Live</span>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-[var(--background)] p-1 rounded-xl border border-[var(--border)]">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setCurrentTab(tab.id)}
            className={`flex flex-col items-center gap-1 px-1 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${currentTab === tab.id ? 'bg-[var(--surface-hover)] text-[var(--foreground)] shadow' : 'text-[var(--text-dim)] hover:text-[var(--foreground)]'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Dataset selector */}
      {currentTab !== 'scrape' && (
        <div className="flex flex-col gap-2">
          <label className={labelCls}><Database size={14} /> Dataset</label>
          <select value={dataset} onChange={e => setDataset(e.target.value)} className={inputCls + ' cursor-pointer'}>
            <option value="">Select a topology graph...</option>
            {datasets.map(d => <option key={d} value={d} className="bg-[var(--surface)]">{d}</option>)}
          </select>
          <a href="/datasets" className="text-xs text-blue-500 hover:text-blue-400 font-bold transition-colors uppercase tracking-tight">+ Ingest Custom Data</a>
        </div>
      )}

      {/* RUN */}
      {currentTab === 'run' && (
        <div className="flex flex-col gap-4 pb-1 border-b border-[var(--border)]">
          <div className="flex items-center justify-between">
            <label className={labelCls}>{execMode.startsWith('cpu') ? <Cpu size={14} /> : <Zap size={14} />} Hardware</label>
            <div className="flex bg-[var(--background)] p-1 rounded-lg border border-[var(--border)]">
              <button onClick={() => setExecMode(execMode.endsWith('seq') ? 'cpu_seq' : (execMode === 'gpu_par' ? 'cpu_par' : execMode))} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${execMode.startsWith('cpu') ? 'bg-emerald-600 text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--foreground)]'}`}>CPU</button>
              <button onClick={() => setExecMode(execMode.endsWith('seq') ? 'gpu_seq' : 'gpu_par')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${execMode.startsWith('gpu') ? 'bg-blue-600 text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--foreground)]'}`}>GPU</button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className={labelCls}>Mode</label>
            <div className="flex bg-[var(--background)] p-1 rounded-lg border border-[var(--border)]">
              <button onClick={() => setExecMode(execMode.startsWith('cpu') ? 'cpu_seq' : 'gpu_seq')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${execMode.endsWith('seq') ? 'bg-[var(--surface-hover)] text-[var(--foreground)]' : 'text-[var(--text-dim)]'}`}>Seq</button>
              <button onClick={() => setExecMode(execMode.startsWith('cpu') ? 'cpu_par' : 'gpu_par')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${execMode.endsWith('par') ? 'bg-[var(--surface-hover)] text-[var(--foreground)]' : 'text-[var(--text-dim)]'}`}>MPI/CUDA</button>
              {execMode.startsWith('cpu') && (
                <button onClick={() => setExecMode('cpu_omp')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${execMode === 'cpu_omp' ? 'bg-[var(--surface-hover)] text-[var(--foreground)]' : 'text-[var(--text-dim)]'}`}>OMP</button>
              )}
            </div>
          </div>
          {(execMode === 'cpu_par' || execMode === 'cpu_omp') && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm font-semibold"><span className="text-[var(--text-muted)]">Workers / Threads</span><span className="text-emerald-400 font-black">{processes}</span></div>
              <input type="range" min="1" max={maxCores} value={processes} onChange={e => setProcesses(parseInt(e.target.value))} className="w-full h-1.5 rounded-lg bg-[var(--border)] accent-emerald-500" />
            </div>
          )}
        </div>
      )}

      {/* BENCHMARK */}
      {currentTab === 'benchmark' && (
        <div className="pb-1 border-b border-[var(--border)] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label className={labelCls}>Target</label>
            <div className="flex bg-[var(--background)] p-1 rounded-lg border border-[var(--border)]">
              <button onClick={() => setBenchmarkTarget('all')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${benchmarkTarget === 'all' ? 'bg-[var(--surface-hover)] text-[var(--foreground)]' : 'text-[var(--text-dim)] hover:text-[var(--foreground)]'}`}>All Run</button>
              <button onClick={() => setBenchmarkTarget('cpu')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${benchmarkTarget === 'cpu' ? 'bg-emerald-600 text-white' : 'text-[var(--text-dim)] hover:text-[var(--foreground)]'}`}>CPU Only</button>
              <button onClick={() => setBenchmarkTarget('gpu')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${benchmarkTarget === 'gpu' ? 'bg-blue-600 text-white' : 'text-[var(--text-dim)] hover:text-[var(--foreground)]'}`}>GPU Only</button>
            </div>
          </div>
          {(benchmarkTarget === 'all' || benchmarkTarget === 'cpu') && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm font-semibold"><span className="text-[var(--text-muted)]">Workers / Threads</span><span className="text-emerald-400 font-black">{processes}</span></div>
              <input type="range" min="1" max={maxCores} value={processes} onChange={e => setProcesses(parseInt(e.target.value))} className="w-full h-1.5 rounded-lg bg-[var(--border)] accent-emerald-500" />
            </div>
          )}
          <p className="text-xs text-[var(--text-dim)] font-semibold leading-relaxed">Runs selected hardware modes and compares execution times.</p>
        </div>
      )}

      {/* BFS + SSSP */}
      {currentTab === 'bfs' && (
        <div className="flex flex-col gap-4 pb-1 border-b border-[var(--border)]">
          <div className="flex flex-col gap-3">
            <span className="text-xs text-[var(--text-dim)] font-black uppercase tracking-widest flex items-center gap-1.5"><GitBranch size={12} /> BFS Settings</span>
            <div className="flex items-center justify-between">
              <label className={labelCls}>Mode</label>
              <div className="flex bg-[var(--background)] p-1 rounded-lg border border-[var(--border)]">
                <button onClick={() => setBfsMode('bfs_seq')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${bfsMode === 'bfs_seq' ? 'bg-emerald-600 text-white' : 'text-[var(--text-dim)]'}`}>Seq</button>
                <button onClick={() => setBfsMode('bfs_mpi')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${bfsMode === 'bfs_mpi' ? 'bg-emerald-600 text-white' : 'text-[var(--text-dim)]'}`}>MPI</button>
                <button onClick={() => setBfsMode('bfs_omp')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${bfsMode === 'bfs_omp' ? 'bg-emerald-600 text-white' : 'text-[var(--text-dim)]'}`}>OMP</button>
              </div>
            </div>
            {(bfsMode === 'bfs_mpi' || bfsMode === 'bfs_omp') && (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm font-semibold"><span className="text-[var(--text-muted)]">Workers / Threads</span><span className="text-blue-400 font-black">{bfsProcesses}</span></div>
                <input type="range" min="1" max={maxCores} value={bfsProcesses} onChange={e => setBfsProcesses(parseInt(e.target.value))} className="w-full h-1.5 rounded-lg bg-[var(--border)] accent-blue-500" />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Source Node</label>
              <input type="number" min="0" value={bfsSource} onChange={e => setBfsSource(parseInt(e.target.value)||0)} className={inputCls} />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-3 border-t border-[var(--border)]">
            <span className="text-xs text-[var(--text-dim)] font-black uppercase tracking-widest flex items-center gap-1.5"><GitMerge size={12} /> SSSP — Shortest Path</span>
            
            <div className="flex items-center justify-between">
              <label className={labelCls}>Mode</label>
              <div className="flex bg-[var(--background)] p-1 rounded-lg border border-[var(--border)]">
                <button onClick={() => setSspMode('sssp_seq')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sspMode === 'sssp_seq' ? 'bg-purple-600 text-white' : 'text-[var(--text-dim)]'}`}>Seq</button>
                <button onClick={() => setSspMode('sssp_omp')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${sspMode === 'sssp_omp' ? 'bg-purple-600 text-white' : 'text-[var(--text-dim)]'}`}>OMP</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-[var(--text-muted)] font-semibold">From</label>
                <input type="number" min="0" value={sspSource} onChange={e => setSspSource(parseInt(e.target.value)||0)} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-[var(--text-muted)] font-semibold">To</label>
                <input type="number" min="0" value={sspTarget} onChange={e => setSspTarget(parseInt(e.target.value)||0)} className={inputCls} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCRAPE */}
      {currentTab === 'scrape' && (
        <div className="flex flex-col gap-4 pb-1 border-b border-[var(--border)]">
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Target URL</label>
            <input type="url" placeholder="https://example.com" value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)} className={inputCls + ' focus:ring-purple-500'} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-sm font-semibold"><span className="text-[var(--text-muted)]">Crawl Depth</span><span className="text-purple-400 font-black">{maxDepth}</span></div>
            <input type="range" min="0" max="5" value={maxDepth} onChange={e => setMaxDepth(parseInt(e.target.value))} className="w-full accent-purple-500 h-1.5 rounded-lg bg-[var(--border)] cursor-pointer" />
          </div>
          <p className="text-xs text-[var(--text-dim)] font-medium leading-relaxed">Constructs a live topology graph from HTML links. Generates a dataset for PageRank or BFS.</p>
        </div>
      )}

      {/* Action Buttons */}
      {currentTab === 'run' && (
        <button onClick={() => onRun({ dataset, mode: execMode, processes })} disabled={loading || !dataset}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all text-sm">
          {loading ? <Activity className="animate-spin" size={18} /> : <Play size={18} />}
          {loading ? 'Running...' : 'Run Simulation'}
        </button>
      )}

      {currentTab === 'benchmark' && (
        <button onClick={() => onBenchmark({ dataset, processes, target: benchmarkTarget })} disabled={loading || !dataset}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-30 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-lg active:scale-95 transition-all text-sm">
          {loading ? <Activity className="animate-spin" size={18} /> : <BarChart3 size={18} />}
          {loading ? 'Benchmarking...' : 'Start Benchmark'}
        </button>
      )}

      {currentTab === 'bfs' && (
        <div className="flex flex-col gap-2.5">
          <button onClick={() => onBFS?.({ dataset, mode: bfsMode, processes: bfsProcesses, source: bfsSource })} disabled={loading || !dataset}
            className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white p-3.5 rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-lg active:scale-95 transition-all text-sm">
            {loading ? <Activity className="animate-spin" size={16} /> : <GitBranch size={16} />}
            {loading ? 'Traversing...' : 'Run BFS'}
          </button>
          <button onClick={() => onSSP?.({ dataset, source: sspSource, target: sspTarget, mode: sspMode, processes: bfsProcesses })} disabled={loading || !dataset}
            className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white p-3.5 rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-lg active:scale-95 transition-all text-sm">
            {loading ? <Activity className="animate-spin" size={16} /> : <GitMerge size={16} />}
            {loading ? 'Tracing...' : `Find Path ${sspSource} → ${sspTarget}`}
          </button>
        </div>
      )}

      {currentTab === 'scrape' && (
        <button onClick={() => onScrape({ startUrl: scrapeUrl, maxDepth })} disabled={loading || !scrapeUrl}
          className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-30 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2.5 shadow-lg active:scale-95 transition-all text-sm">
          {loading ? <Activity className="animate-spin" size={18} /> : <Search size={18} />}
          {loading ? 'Crawling...' : 'Generate Graph'}
        </button>
      )}
    </div>
  );
}
