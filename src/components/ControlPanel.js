'use client';

import { useState, useEffect } from 'react';
import { Play, Activity, Cpu, Database, Settings2 } from 'lucide-react';

export default function ControlPanel({ onRun, loading, status }) {
  const [datasets, setDatasets] = useState([]);
  const [dataset, setDataset] = useState('');
  const [useMPI, setUseMPI] = useState(true);
  const [processes, setProcesses] = useState(4);

  useEffect(() => {
    fetch('/api/datasets').then(res => res.json()).then(setDatasets);
  }, []);

  const handleRun = () => {
    onRun({ dataset, useMPI, processes });
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-[#111] backdrop-blur-xl bg-opacity-80 rounded-2xl border border-[#222] shadow-2xl h-full font-sans">
      <div className="flex items-center gap-2 text-white font-bold opacity-80 mb-2">
        <Settings2 size={18} />
        <span>Control Center</span>
      </div>

      <div className="flex flex-col gap-2">
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

      <div className="flex flex-col gap-4 py-4 border-y border-[#222]">
        <div className="flex items-center justify-between">
          <label className="text-white text-xs font-semibold opacity-50 flex items-center gap-1">
            <Cpu size={12} />
            Execution Mode
          </label>
          <div className="flex bg-[#1a1a1a] p-1 rounded-lg border border-[#333]">
            <button 
              onClick={() => setUseMPI(false)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${!useMPI ? 'bg-blue-600 text-white' : 'text-[#555] hover:text-white'}`}
            >
              Sequential
            </button>
            <button 
              onClick={() => setUseMPI(true)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${useMPI ? 'bg-blue-600 text-white' : 'text-[#555] hover:text-white'}`}
            >
              MPI (Parallel)
            </button>
          </div>
        </div>

        {useMPI && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-white opacity-50">MPI Process Count</span>
              <span className="text-blue-400">{processes}</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="8" 
              value={processes} 
              onChange={(e) => setProcesses(parseInt(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer h-1 rounded-lg bg-[#222]" 
            />
          </div>
        )}
      </div>

      <button
        onClick={handleRun}
        disabled={loading || !dataset}
        className="mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-blue-500/20 active:scale-95 transition-all text-sm group"
      >
        {loading ? (
          <Activity className="animate-spin" size={18} />
        ) : (
          <Play size={18} className="group-hover:translate-x-0.5 transition-transform" />
        )}
        {loading ? 'Executing PageRank...' : 'Run Simulation'}
      </button>

      {status && (
        <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs rounded-xl font-mono">
          {status}
        </div>
      )}
    </div>
  );
}
