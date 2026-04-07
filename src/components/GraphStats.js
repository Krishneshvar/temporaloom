'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Trophy, Zap, Activity, GitMerge } from 'lucide-react';

export default function GraphStats({ runResult, iterationData, graphStats }) {
  const top10 = useMemo(() => {
    if (!iterationData?.nodes) return [];
    return [...iterationData.nodes]
      .sort((a, b) => b.rank - a.rank)
      .slice(0, 10);
  }, [iterationData]);

  const maxRank = top10[0]?.rank ?? 1;

  if (!runResult) return null;

  const stats = [
    { label: 'Convergence Speed', value: runResult.iterations ? `${runResult.iterations} iters` : '—', sub: runResult.execution_time ? `${runResult.execution_time.toFixed(4)}s` : null, color: 'text-blue-400', icon: <Zap size={14} /> },
    { label: 'Graph Nodes', value: graphStats?.nodes != null ? graphStats.nodes.toLocaleString() : (runResult.nodes ?? '—').toLocaleString?.() ?? '—', sub: 'vertices', color: 'text-purple-400', icon: <Activity size={14} /> },
    { label: 'Graph Edges', value: graphStats?.edges != null ? graphStats.edges.toLocaleString() : (runResult.edges ?? '—').toLocaleString?.() ?? '—', sub: 'directed links', color: 'text-emerald-400', icon: <GitMerge size={14} /> },
    { label: 'Avg Degree', value: graphStats?.avgDegree?.toFixed(2) ?? '—', sub: 'out-edges/node', color: 'text-amber-400', icon: <BarChart2 size={14} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="p-4 bg-[#111] rounded-2xl border border-[#222] hover:border-white/10 transition-all"
          >
            <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest opacity-40 mb-2 ${s.color}`}>
              {s.icon}{s.label}
            </div>
            <div className="text-2xl font-black font-mono tracking-tighter">{s.value}</div>
            {s.sub && <div className="text-[10px] text-white/25 font-semibold mt-0.5">{s.sub}</div>}
          </motion.div>
        ))}
      </div>

      {/* Top-10 PageRank leaderboard */}
      {top10.length > 0 && (
        <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
            <Trophy size={14} className="text-amber-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#555]">
              Top-10 Nodes by PageRank — Iteration {iterationData?.iteration ?? '?'}
            </span>
          </div>
          <div className="p-4 flex flex-col gap-2">
            {top10.map((node, i) => {
              const pct = maxRank > 0 ? (node.rank / maxRank) * 100 : 0;
              return (
                <motion.div
                  key={node.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 group"
                >
                  <span className={`text-[10px] font-black font-mono w-4 shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-orange-600' : 'text-white/20'}`}>
                    {i + 1}
                  </span>
                  <span className="text-[11px] font-mono text-white/60 shrink-0 w-10">#{node.id}</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.05 + 0.2, duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-blue-400 shrink-0 w-20 text-right">
                    {node.rank.toFixed(6)}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Degree distribution mini-chart */}
      {graphStats?.degreeDistribution && graphStats.degreeDistribution.length > 0 && (
        <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1e1e1e] flex items-center gap-2">
            <BarChart2 size={14} className="text-purple-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[#555]">Out-Degree Distribution</span>
          </div>
          <div className="p-4">
            <DegreeBar data={graphStats.degreeDistribution} />
          </div>
        </div>
      )}
    </div>
  );
}

function DegreeBar({ data }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => {
        const h = (d.count / maxCount) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative" title={`Degree ${d.degree}: ${d.count} nodes`}>
            <motion.div
              className="w-full bg-purple-500/30 group-hover:bg-purple-500/60 rounded-t-sm transition-colors"
              style={{ height: `${h}%` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.02, duration: 0.3, ease: 'easeOut', origin: 'bottom' }}
            />
            {data.length <= 15 && (
              <span className="text-[8px] text-white/20 font-mono">{d.degree}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
