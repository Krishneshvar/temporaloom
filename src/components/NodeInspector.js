'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, ArrowUpRight, ArrowDownLeft, Hash, TrendingUp, Network } from 'lucide-react';

export default function NodeInspector({ node, onClose }) {
  return (
    <AnimatePresence>
      {node && (
        <motion.div
          key={node.id}
          initial={{ opacity: 0, x: 24, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 24, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="absolute top-16 right-4 z-30 w-64 bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Node Inspector</span>
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-all"
            >
              <X size={13} />
            </button>
          </div>

          {/* Node ID */}
          <div className="px-4 pt-4 pb-2 border-b border-white/5">
            <div className="text-[9px] text-white/30 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
              <Hash size={10} /> Node ID
            </div>
            <div className="text-4xl font-black font-mono tracking-tighter text-white leading-none">
              {node.id}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-px bg-white/5 border-b border-white/5">
            <StatCell
              icon={<TrendingUp size={11} />}
              label="PageRank"
              value={typeof node.rank === 'number' ? node.rank.toFixed(6) : '—'}
              color="text-blue-400"
            />
            <StatCell
              icon={<Network size={11} />}
              label="Centrality"
              value={typeof node.rank === 'number' ? (node.rank * 100).toFixed(3) + '%' : '—'}
              color="text-purple-400"
            />
            <StatCell
              icon={<ArrowUpRight size={11} />}
              label="Out-Degree"
              value={node.outDegree ?? '—'}
              color="text-emerald-400"
            />
            <StatCell
              icon={<ArrowDownLeft size={11} />}
              label="In-Degree"
              value={node.inDegree ?? '—'}
              color="text-amber-400"
            />
          </div>

          {/* Neighbors */}
          {(node.outNeighbors?.length > 0 || node.inNeighbors?.length > 0) && (
            <div className="px-4 py-3 space-y-3">
              {node.outNeighbors?.length > 0 && (
                <div>
                  <div className="text-[9px] text-emerald-500/60 font-black uppercase tracking-widest mb-2 flex items-center gap-1">
                    <ArrowUpRight size={9} /> Out-Neighbors ({node.outNeighbors.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {node.outNeighbors.slice(0, 8).map(nb => (
                      <span key={nb} className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[10px] font-mono text-emerald-400">
                        {nb}
                      </span>
                    ))}
                    {node.outNeighbors.length > 8 && (
                      <span className="px-1.5 py-0.5 text-[10px] text-white/20 font-mono">+{node.outNeighbors.length - 8}</span>
                    )}
                  </div>
                </div>
              )}
              {node.inNeighbors?.length > 0 && (
                <div>
                  <div className="text-[9px] text-amber-500/60 font-black uppercase tracking-widest mb-2 flex items-center gap-1">
                    <ArrowDownLeft size={9} /> In-Neighbors ({node.inNeighbors.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {node.inNeighbors.slice(0, 8).map(nb => (
                      <span key={nb} className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md text-[10px] font-mono text-amber-400">
                        {nb}
                      </span>
                    ))}
                    {node.inNeighbors.length > 8 && (
                      <span className="px-1.5 py-0.5 text-[10px] text-white/20 font-mono">+{node.inNeighbors.length - 8}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="px-4 py-2 border-t border-white/5 text-[9px] text-white/15 font-mono">
            Click another node to inspect · ESC to close
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatCell({ icon, label, value, color }) {
  return (
    <div className="bg-black/30 px-3 py-2.5">
      <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest opacity-50 mb-1 ${color}`}>
        {icon}{label}
      </div>
      <div className="text-sm font-black font-mono text-white leading-none">{value}</div>
    </div>
  );
}
