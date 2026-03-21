'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function PerformanceChart({ results }) {
  if (!results) return null;

  let data = [];
  
  // Case A: Full Benchmark data (Array from results/performance.json)
  if (Array.isArray(results)) {
     const bench = results[0]; // For now just show first bench
     data = [
       { name: 'SEQ', time: bench.sequential_time, fill: '#6366f1' },
       ...(bench.mpi_runs || []).map(run => ({
         name: `MPI(${run.processes})`,
         time: run.execution_time,
         fill: '#3b82f6'
       }))
     ];
  } 
  // Case B: Single Job result from /api/run
  else if (results.mode) {
    data = [
      { 
        name: results.mode.toUpperCase() + (results.processes ? `(${results.processes})` : ''), 
        time: results.execution_time, 
        fill: results.mode === 'mpi' ? '#3b82f6' : '#6366f1' 
      }
    ];
  }

  if (data.length === 0) return null;

  return (
    <div className="bg-[#111] p-6 rounded-2xl border border-[#222] shadow-2xl h-full font-sans transition-all hover:border-blue-500/20">
      <div className="text-white text-xs font-bold opacity-30 uppercase tracking-widest mb-4">Execution Time (s)</div>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#222" />
            <XAxis 
              dataKey="name" 
              stroke="#555" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
            />
            <YAxis 
              stroke="#555" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
            />
            <Tooltip 
              cursor={{ fill: '#ffffff05' }}
              contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
            />
            <Bar dataKey="time" radius={[8, 8, 8, 8]} barSize={40}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} className="transition-all hover:opacity-80" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
