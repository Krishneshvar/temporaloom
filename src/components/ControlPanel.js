'use client';

import { useState, useEffect } from 'react';
import { Play, Activity, Cpu, Database, Settings2, Globe, Search, BarChart3, Zap, GitBranch, GitMerge } from 'lucide-react';

export default function ControlPanel({ onRun, onBenchmark, onScrape, onBFS, onSSP, loading, status, currentTab, setCurrentTab, liveMode }) {
  const [datasets, setDatasets] = useState([]);
  const [dataset, setDataset]   = useState('');

  // Run state
  const [execMode, setExecMode]   = useState('cpu_seq');
  const [processes, setProcesses] = useState(4);

  // Scraper state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [maxDepth, setMaxDepth]   = useState(2);

  // BFS state
  const [bfsMode, setBfsMode]         = useState('bfs_seq');
  const [bfsProcesses, setBfsProcesses] = useState(4);
  const [bfsSource, setBfsSource]     = useState(0);

  // SSSP state
  const [sspSource, setSspSource] = useState(0);
  const [sspTarget, setSspTarget] = useState(1);

  useEffect(() => { fetch('/api/datasets').then(r => r.json()).then(d => { if (Array.isArray(d)) setDatasets(d); }).catch(() => {}); }, []);

  const TABS = [
    { id: 'run',       label: 'Run',   icon: <Play size={13} /> },
    { id: 'benchmark', label: 'Bench', icon: <BarChart3 size={13} /> },
    { id: 'bfs',       label: 'BFS',   icon: <GitBranch size={13} /> },
    { id: 'scrape',    label: 'Scrape',icon: <Globe size={13} /> },
  ];

  return (
    <div className="flex flex-col gap-5 p-6 bg-[#111] rounded-2xl border border-[#222] shadow-2xl font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-bold opacity-80">
          <Settings2 size={18} /><span>Control Center</span>
        </div>
        {liveMode && (
          <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest animate-pulse">
            ⚡ Live
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-[#1a1a1a] p-1 rounded-xl border border-[#333]">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setCurrentTab(tab.id)}
            className={`flex flex-col items-center gap-1 px-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${currentTab === tab.id ? 'bg-[#333] text-white shadow' : 'text-[#555] hover:text-white'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Dataset selector (hidden for scrape) */}
      {currentTab !== 'scrape' && (
        <div className="flex flex-col gap-2">
          <label className="text-white text-xs font-semibold opacity-50 flex items-center gap-1"><Database size={12} /> Dataset</label>
          <select value={dataset} onChange={e => setDataset(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] text-white p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer text-sm">
            <option value="">Select a graph...</option>
            {datasets.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <a href="/datasets" className="text-[10px] text-blue-500/60 hover:text-blue-400 font-bold ml-1 transition-colors">+ Manage datasets</a>
        </div>
      )}

      {/* ── RUN ── */}
      {currentTab === 'run' && (
        <div className="flex flex-col gap-4 pb-1 border-b border-[#222]">
          <div className="flex items-center justify-between">
            <label className="text-white text-xs font-semibold opacity-50 flex items-center gap-1">
              {execMode.startsWith('cpu') ? <Cpu size={12} /> : <Zap size={12} />} Hardware
            </label>
            <div className="flex bg-[#1a1a1a] p-1 rounded-lg border border-[#333]">
              <button onClick={() => setExecMode(p => p.replace('gpu','cpu'))} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${execMode.startsWith('cpu') ? 'bg-emerald-600 text-white' : 'text-[#555] hover:text-white'}`}>CPU</button>
              <button onClick={() => setExecMode(p => p.replace('cpu','gpu'))} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${execMode.startsWith('gpu') ? 'bg-blue-600 text-white' : 'text-[#555] hover:text-white'}`}>GPU</button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-white text-xs font-semibold opacity-50">Topology</label>
            <div className="flex bg-[#1a1a1a] p-1 rounded-lg border border-[#333]">
              <button onClick={() => setExecMode(p => p.replace('par','seq'))} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${execMode.endsWith('seq') ? 'bg-[#444] text-white' : 'text-[#555] hover:text-white'}`}>Seq</button>
              <button onClick={() => setExecMode(p => p.replace('seq','par'))} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${execMode.endsWith('par') ? 'bg-[#444] text-white' : 'text-[#555] hover:text-white'}`}>Par</button>
            </div>
          </div>
          {execMode === 'cpu_par' && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-semibold"><span className="text-white opacity-50">MPI Processes</span><span className="text-emerald-400">{processes}</span></div>
              <input type="range" min="1" max="8" value={processes} onChange={e => setProcesses(parseInt(e.target.value))} className="w-full h-1 rounded-lg bg-[#222]" />
            </div>
          )}
        </div>
      )}

      {/* ── BENCHMARK ── */}
      {currentTab === 'benchmark' && (
        <div className="pb-1 border-b border-[#222]">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-semibold"><span className="text-white opacity-50">MPI Processes</span><span className="text-emerald-400">{processes}</span></div>
            <input type="range" min="1" max="8" value={processes} onChange={e => setProcesses(parseInt(e.target.value))} className="w-full h-1 rounded-lg bg-[#222]" />
          </div>
          <p className="text-[10px] text-[#555] font-semibold mt-3 leading-relaxed">Runs all 4 hardware modes and compares execution times.</p>
        </div>
      )}

      {/* ── BFS + SSSP ── */}
      {currentTab === 'bfs' && (
        <div className="flex flex-col gap-4 pb-1 border-b border-[#222]">
          {/* BFS controls */}
          <div className="flex flex-col gap-3">
            <div className="text-[9px] text-white/30 font-black uppercase tracking-widest flex items-center gap-1"><GitBranch size={10} /> BFS Settings</div>
            <div className="flex items-center justify-between">
              <label className="text-white text-xs font-semibold opacity-50">Mode</label>
              <div className="flex bg-[#1a1a1a] p-1 rounded-lg border border-[#333]">
                <button onClick={() => setBfsMode('bfs_seq')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${bfsMode === 'bfs_seq' ? 'bg-emerald-600 text-white' : 'text-[#555] hover:text-white'}`}>Seq</button>
                <button onClick={() => setBfsMode('bfs_mpi')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${bfsMode === 'bfs_mpi' ? 'bg-blue-600 text-white' : 'text-[#555] hover:text-white'}`}>MPI</button>
              </div>
            </div>
            {bfsMode === 'bfs_mpi' && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-semibold"><span className="text-white opacity-50">Processes</span><span className="text-blue-400">{bfsProcesses}</span></div>
                <input type="range" min="1" max="8" value={bfsProcesses} onChange={e => setBfsProcesses(parseInt(e.target.value))} className="w-full h-1 rounded-lg bg-[#222]" />
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-white text-xs font-semibold opacity-50">Source Node</label>
              <input type="number" min="0" value={bfsSource} onChange={e => setBfsSource(parseInt(e.target.value)||0)}
                className="bg-[#1a1a1a] border border-[#333] text-white p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm w-full" />
            </div>
          </div>

          {/* SSSP controls */}
          <div className="flex flex-col gap-3 pt-3 border-t border-[#1e1e1e]">
            <div className="text-[9px] text-white/30 font-black uppercase tracking-widest flex items-center gap-1"><GitMerge size={10} /> SSSP — Shortest Path</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/40 font-bold">From</label>
                <input type="number" min="0" value={sspSource} onChange={e => setSspSource(parseInt(e.target.value)||0)}
                  className="bg-[#1a1a1a] border border-[#333] text-white p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm w-full" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-white/40 font-bold">To</label>
                <input type="number" min="0" value={sspTarget} onChange={e => setSspTarget(parseInt(e.target.value)||0)}
                  className="bg-[#1a1a1a] border border-[#333] text-white p-2 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 text-sm w-full" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SCRAPE ── */}
      {currentTab === 'scrape' && (
        <div className="flex flex-col gap-4 pb-1 border-b border-[#222]">
          <div className="flex flex-col gap-2">
            <label className="text-white text-xs font-semibold opacity-50">Target URL</label>
            <input type="url" placeholder="https://example.com" value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)}
              className="bg-[#1a1a1a] border border-[#333] text-white p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs font-semibold"><span className="text-white opacity-50">Crawl Depth</span><span className="text-purple-400">{maxDepth}</span></div>
            <input type="range" min="0" max="5" value={maxDepth} onChange={e => setMaxDepth(parseInt(e.target.value))} className="w-full accent-purple-500 h-1 rounded-lg bg-[#222] cursor-pointer" />
          </div>
          <p className="text-[10px] text-[#555] font-semibold leading-relaxed">Constructs a live topology graph from HTML links. Generates a dataset for PageRank or BFS.</p>
        </div>
      )}

      {/* ── Action Buttons ── */}
      {currentTab === 'run' && (
        <button onClick={() => onRun({ dataset, mode: execMode, processes })} disabled={loading || !dataset}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all text-sm">
          {loading ? <Activity className="animate-spin" size={18} /> : <Play size={18} />}
          {loading ? 'Running...' : 'Run Simulation'}
        </button>
      )}

      {currentTab === 'benchmark' && (
        <button onClick={() => onBenchmark({ dataset, processes })} disabled={loading || !dataset}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-sm">
          {loading ? <Activity className="animate-spin" size={18} /> : <BarChart3 size={18} />}
          {loading ? 'Benchmarking...' : 'Start Benchmark'}
        </button>
      )}

      {currentTab === 'bfs' && (
        <div className="flex flex-col gap-2">
          <button onClick={() => onBFS?.({ dataset, mode: bfsMode, processes: bfsProcesses, source: bfsSource })} disabled={loading || !dataset}
            className="bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white p-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-sm">
            {loading ? <Activity className="animate-spin" size={16} /> : <GitBranch size={16} />}
            {loading ? 'Traversing...' : 'Run BFS'}
          </button>
          <button onClick={() => onSSP?.({ dataset, source: sspSource, target: sspTarget })} disabled={loading || !dataset}
            className="bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white p-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-sm">
            {loading ? <Activity className="animate-spin" size={16} /> : <GitMerge size={16} />}
            {loading ? 'Tracing...' : `Find Path ${sspSource} → ${sspTarget}`}
          </button>
        </div>
      )}

      {currentTab === 'scrape' && (
        <button onClick={() => onScrape({ startUrl: scrapeUrl, maxDepth })} disabled={loading || !scrapeUrl}
          className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-sm">
          {loading ? <Activity className="animate-spin" size={18} /> : <Search size={18} />}
          {loading ? 'Crawling...' : 'Generate Graph'}
        </button>
      )}

      {status && (
        <div className={`p-3 text-[11px] rounded-xl font-mono border overflow-hidden break-words leading-relaxed ${status.toLowerCase().includes('error') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
          {status}
        </div>
      )}
    </div>
  );
}
