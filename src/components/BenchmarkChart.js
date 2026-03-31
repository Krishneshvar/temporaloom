'use client';

import { motion } from 'framer-motion';
import { BarChart, Activity, Cpu, Zap } from 'lucide-react';

export default function BenchmarkChart({ data, loading }) {
  if (loading) {
    return (
      <div className="h-full bg-[#111] rounded-2xl border border-[#222] flex flex-col items-center justify-center p-8 min-h-[400px]">
         <div className="relative flex items-center justify-center">
            <div className="absolute w-24 h-24 rounded-full border-t-2 border-blue-500 animate-spin" />
            <Activity size={32} className="text-blue-500 animate-pulse" />
         </div>
         <span className="mt-8 text-white/70 font-bold uppercase tracking-widest text-sm">Evaluating Performance Envelope...</span>
         <p className="text-xs text-[#555] mt-2 max-w-sm text-center">Executing 4-stage hardware iterations. This may take longer on large scale topologies.</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-full bg-[#111] rounded-2xl border border-[#222] border-dashed flex flex-col items-center justify-center gap-3 text-white/10 min-h-[400px] hover:border-white/20 transition-all">
        <BarChart size={32} />
        <span className="text-xs font-bold uppercase tracking-widest">No benchmark data available</span>
      </div>
    );
  }

  // Find max time to scale bars
  const maxTime = Math.max(...data.map(d => d.data?.execution_time || 0));

  return (
    <div className="bg-[#111] rounded-2xl border border-[#222] shadow-2xl p-6 min-h-[400px]">
       <div className="flex items-center gap-3 mb-8">
           <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20 text-purple-400">
               <Zap size={18} />
           </div>
           <div>
               <h3 className="text-white font-bold text-lg leading-tight">Hardware Benchmark Profiles</h3>
               <p className="text-[#555] text-xs font-semibold">Comparing execution vectors across CPU and CUDA paradigms</p>
           </div>
       </div>

       <div className="flex flex-col gap-6">
         {data.map((result, idx) => {
            const hasError = !!result.error;
            const execTime = result.data?.execution_time || 0;
            const percentage = hasError ? 0 : (execTime / maxTime) * 100;
            const isGpu = result.id.startsWith('gpu');
            
            return (
              <div key={result.id} className="flex flex-col gap-2">
                 <div className="flex justify-between items-end">
                    <span className="text-sm font-bold flex items-center gap-2 text-white/90">
                       {isGpu ? <Zap size={14} className="text-blue-400" /> : <Cpu size={14} className="text-emerald-400" />}
                       {result.name}
                    </span>
                    <span className={`text-xs font-mono font-bold ${hasError ? 'text-red-400' : 'text-white/50'}`}>
                       {hasError ? 'FAILED' : `${execTime.toFixed(4)}s`}
                    </span>
                 </div>
                 
                 <div className="w-full bg-[#222] h-4 rounded-full overflow-hidden relative">
                    {!hasError && (
                       <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(percentage, 2)}%` }}
                          transition={{ duration: 1, delay: idx * 0.2 }}
                          className={`h-full relative ${isGpu ? 'bg-gradient-to-r from-blue-600 to-indigo-500' : 'bg-gradient-to-r from-emerald-600 to-teal-500'}`}
                       />
                    )}
                 </div>
                 {hasError && (
                   <div className="text-[10px] text-red-500/80 font-mono mt-1 break-all bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                      ERR: {result.error.substring(0, 100)}...
                   </div>
                 )}
              </div>
            );
         })}
       </div>

       {/* Quick metric callout */}
       {data.every(d => !d.error) && data.length === 4 && (
         <div className="mt-8 p-4 bg-[#1a1a1a] rounded-xl border border-[#333] flex justify-between items-center">
            <div className="flex flex-col">
               <span className="text-[10px] text-[#555] uppercase font-bold tracking-widest">Top Performer</span>
               <span className="text-white font-bold">{data.reduce((prev, curr) => (prev.data.execution_time < curr.data.execution_time) ? prev : curr).name}</span>
            </div>
            <div className="w-[1px] h-8 bg-[#333]" />
            <div className="flex flex-col text-right">
               <span className="text-[10px] text-[#555] uppercase font-bold tracking-widest">Max Delta</span>
               <span className="text-blue-400 font-bold font-mono text-lg leading-none">
                  {((maxTime / Math.min(...data.map(d => d.data.execution_time)))).toFixed(1)}x
               </span>
            </div>
         </div>
       )}
    </div>
  );
}
