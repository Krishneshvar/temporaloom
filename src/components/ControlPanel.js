'use client';

import { useState, useEffect } from 'react';
import { Play, Activity, Cpu, Database, Settings2, Globe, Search, BarChart3, Zap } from 'lucide-react';

export default function ControlPanel({ onRun, onBenchmark, onScrape, loading, status, currentTab, setCurrentTab }) {
  const [datasets, setDatasets] = useState([]);
  const [dataset, setDataset] = useState('');
  
  // Execution State
  const [execMode, setExecMode] = useState('cpu_seq'); // cpu_seq, cpu_par, gpu_seq, gpu_par
  const [processes, setProcesses] = useState(4);

  // Scraper State
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(2);

  const fetchDatasets = () => {
    fetch('/api/datasets').then(res => res.json()).then(setDatasets);
  };

  useEffect(() => {
    fetchDatasets();
  }, []);

  // Poll datasets after successful scrape to show new option
  useEffect(() => {
    if (status && status.includes('Scraped')) {
      fetchDatasets();
    }
  }, [status]);

  const handleRun = () => {
    onRun({ dataset, mode: execMode, processes });
  };

  const handleBenchmark = () => {
    onBenchmark({ dataset, processes });
  };

  const handleScrape = () => {
    onScrape({ startUrl: scrapeUrl, maxDepth });
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#111] backdrop-blur-xl bg-opacity-80 rounded-2xl border border-[#222] shadow-2xl h-full font-sans transition-all">
      <div className="flex items-center gap-2 text-white font-bold opacity-80 mb-2">
        <Settings2 size={18} />
        <span>Control Center</span>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#1a1a1a] p-1 rounded-xl border border-[#333]">
        <button 
          onClick={() => setCurrentTab('run')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentTab === 'run' ? 'bg-[#333] text-white shadow' : 'text-[#555] hover:text-white'}`}
        >
          <Play size={14} /> Run
        </button>
        <button 
          onClick={() => setCurrentTab('benchmark')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentTab === 'benchmark' ? 'bg-[#333] text-white shadow' : 'text-[#555] hover:text-white'}`}
        >
          <BarChart3 size={14} /> Benchmark
        </button>
        <button 
          onClick={() => setCurrentTab('scrape')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${currentTab === 'scrape' ? 'bg-[#333] text-white shadow' : 'text-[#555] hover:text-white'}`}
        >
          <Globe size={14} /> Scrape
        </button>
      </div>

      {currentTab !== 'scrape' && (
        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
          <label className="text-white text-xs font-semibold opacity-50 flex items-center gap-1">
            <Database size={12} />
            Dataset Selection
          </label>
          <select 
            value={dataset} 
            onChange={(e) => setDataset(e.target.value)}
            className="bg-[#1a1a1a] border border-[#333] text-white p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
          >
            <option value="">Select a Graph...</option>
            {datasets.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      {currentTab === 'run' && (
        <div className="flex flex-col gap-4 py-4 border-y border-[#222] animate-in fade-in slide-in-from-top-2">
          
          {/* Hardware Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-white text-xs font-semibold opacity-50 flex items-center gap-1">
              {execMode.startsWith('cpu') ? <Cpu size={12} /> : <Zap size={12} />}
              Hardware
            </label>
            <div className="flex bg-[#1a1a1a] p-1 rounded-lg border border-[#333]">
              <button 
                onClick={() => setExecMode(prev => prev.replace('gpu', 'cpu'))}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${execMode.startsWith('cpu') ? 'bg-emerald-600 text-white' : 'text-[#555] hover:text-white'}`}
              >
                CPU
              </button>
              <button 
                onClick={() => setExecMode(prev => prev.replace('cpu', 'gpu'))}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${execMode.startsWith('gpu') ? 'bg-blue-600 text-white' : 'text-[#555] hover:text-white'}`}
              >
                GPU
              </button>
            </div>
          </div>

          {/* Parallelism Toggle */}
          <div className="flex items-center justify-between mt-2">
            <label className="text-white text-xs font-semibold opacity-50 flex items-center gap-1">
              Topology
            </label>
            <div className="flex bg-[#1a1a1a] p-1 rounded-lg border border-[#333]">
              <button 
                onClick={() => setExecMode(prev => prev.replace('par', 'seq'))}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${execMode.endsWith('seq') ? 'bg-[#444] text-white' : 'text-[#555] hover:text-white'}`}
              >
                Sequential
              </button>
              <button 
                onClick={() => setExecMode(prev => prev.replace('seq', 'par'))}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${execMode.endsWith('par') ? 'bg-[#444] text-white' : 'text-[#555] hover:text-white'}`}
              >
                Parallel
              </button>
            </div>
          </div>

          {execMode === 'cpu_par' && (
            <div className="flex flex-col gap-2 mt-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-white opacity-50">MPI Processes</span>
                <span className="text-emerald-400">{processes}</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="8" 
                value={processes} 
                onChange={(e) => setProcesses(parseInt(e.target.value))}
                className="w-full h-1 rounded-lg bg-[#222]" 
              />
            </div>
          )}
        </div>
      )}

      {currentTab === 'scrape' && (
        <div className="flex flex-col gap-4 py-4 border-y border-[#222] animate-in fade-in slide-in-from-top-2">
           <div className="flex flex-col gap-2">
              <label className="text-white text-xs font-semibold opacity-50 flex items-center gap-1">
                Target URL
              </label>
              <input 
                type="url"
                placeholder="https://example.com"
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                className="bg-[#1a1a1a] border border-[#333] text-white p-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all text-sm w-full"
              />
           </div>
           
           <div className="flex flex-col gap-2 mt-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-white opacity-50 flex items-center gap-1">Crawl Depth</span>
                <span className="text-purple-400">{maxDepth}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="5" 
                value={maxDepth} 
                onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                className="w-full accent-purple-500 h-1 rounded-lg bg-[#222] cursor-pointer" 
              />
           </div>

           <p className="text-[10px] text-[#555] font-semibold leading-relaxed">
             Crawls HTML links recursively to construct an adjacent mapping representation of the target routing topology.
           </p>
        </div>
      )}

      {/* Action Buttons */}
      {currentTab === 'run' && (
        <button
          onClick={handleRun}
          disabled={loading || !dataset}
          className="mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all text-sm group"
        >
          {loading ? <Activity className="animate-spin" size={18} /> : <Play size={18} className="group-hover:translate-x-0.5 transition-transform" />}
           {loading ? 'Executing Engine...' : 'Run Simulation'}
        </button>
      )}

      {currentTab === 'benchmark' && (
        <button
          onClick={handleBenchmark}
          disabled={loading || !dataset}
          className="mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all text-sm group"
        >
           {loading ? <Activity className="animate-spin" size={18} /> : <BarChart3 size={18} className="group-hover:scale-110 transition-transform" />}
           {loading ? 'Evaluating Limits...' : 'Start Benchmark'}
        </button>
      )}

      {currentTab === 'scrape' && (
        <button
          onClick={handleScrape}
          disabled={loading || !scrapeUrl}
          className="mt-2 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-purple-500/20 active:scale-95 transition-all text-sm group"
        >
           {loading ? <Activity className="animate-spin" size={18} /> : <Search size={18} className="group-hover:rotate-12 transition-transform" />}
           {loading ? 'Crawling Architecture...' : 'Generate Graph'}
        </button>
      )}

      {status && (
        <div className={`mt-2 p-3 text-xs rounded-xl font-mono border overflow-hidden break-words ${status.includes('Error') ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
          {status}
        </div>
      )}
    </div>
  );
}
