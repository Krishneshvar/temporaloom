'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ChevronDown, ChevronUp, Trash2, Activity, Cpu, Database, Zap } from 'lucide-react';

const MODE_COLORS = {
  cpu_seq: 'text-blue-400',
  cpu_par: 'text-emerald-400',
  mpi:     'text-emerald-400',
  gpu_seq: 'text-amber-400',
  gpu_par: 'text-orange-400',
};

function fmtTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(isoStr) {
  const d = new Date(isoStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return 'Today';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function RunHistory({ onRestore }) {
  const [history, setHistory] = useState([]);
  const [open, setOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchHistory = () => {
    fetch('/api/history').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setHistory(data);
    }).catch(() => {});
  };

  useEffect(() => { fetchHistory(); }, []);

  // Refresh when panel is opened
  useEffect(() => { if (open) fetchHistory(); }, [open]);

  const clearAll = async () => {
    setClearing(true);
    await fetch('/api/history', { method: 'DELETE' });
    setHistory([]);
    setClearing(false);
  };

  const totalRuns = history.length;
  const fastestRun = history.reduce((best, r) => {
    const t = r.execution_time ?? Infinity;
    return t < (best.execution_time ?? Infinity) ? r : best;
  }, {});

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-hover)] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-1.5 h-1.5 rounded-full ${totalRuns > 0 ? 'bg-blue-500' : 'bg-[var(--text-muted)]'}`} />
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-dim)]">
            Run History
          </span>
          {totalRuns > 0 && (
            <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-bold">
              {totalRuns}
            </span>
          )}
        </div>
        <div className="text-[var(--text-dim)]">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border)]">
              {/* Summary stats */}
              {totalRuns > 0 && (
                <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
                  <div className="bg-[var(--surface-hover)] px-4 py-2.5 text-center">
                    <div className="text-[9px] text-[var(--text-dim)] font-bold uppercase leading-none mb-1">Total Runs</div>
                    <div className="text-lg font-black font-mono text-[var(--foreground)]">{totalRuns}</div>
                  </div>
                  <div className="bg-[var(--surface-hover)] px-4 py-2.5 text-center">
                    <div className="text-[9px] text-[var(--text-dim)] font-bold uppercase leading-none mb-1">Fastest</div>
                    <div className="text-lg font-black font-mono text-emerald-400">
                      {fastestRun.execution_time ? `${fastestRun.execution_time.toFixed(3)}s` : '—'}
                    </div>
                  </div>
                </div>
              )}

              {/* List */}
              <div className="max-h-[280px] overflow-y-auto">
                {history.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-dim)]/50">
                    <Clock size={22} className="mx-auto mb-2 opacity-30" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">No runs yet</p>
                  </div>
                ) : (
                  history.map((run, i) => (
                    <motion.button
                      key={run.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => onRestore?.(run)}
                      className="w-full flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]/10 hover:bg-[var(--surface-hover)] transition-colors text-left group"
                    >
                      <div className={`p-1.5 rounded-lg bg-[var(--background)] shrink-0 ${MODE_COLORS[run.mode] || 'text-[var(--text-dim)]'}`}>
                        {run.mode?.startsWith('gpu') ? <Zap size={11} /> : run.mode?.includes('par') || run.mode === 'mpi' ? <Activity size={11} /> : <Cpu size={11} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[var(--foreground)] group-hover:text-blue-400 transition-colors truncate">{run.dataset}</p>
                        <p className="text-[9px] text-[var(--text-dim)] font-mono mt-0.5">
                          {run.iterations ?? '?'} iters · {run.execution_time != null ? `${run.execution_time.toFixed(3)}s` : '—'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className={`text-[9px] font-black uppercase ${MODE_COLORS[run.mode] || 'text-[var(--text-dim)]'}`}>
                          {(run.mode || '—').replace('_', ' ')}
                        </span>
                        <span className="text-[9px] text-[var(--text-dim)] font-mono mt-0.5 opacity-50">
                          {fmtDate(run.timestamp)} {fmtTime(run.timestamp)}
                        </span>
                      </div>
                    </motion.button>
                  ))
                )}
              </div>

              {/* Footer */}
              {history.length > 0 && (
                <div className="px-4 py-3 border-t border-[var(--border)] flex justify-end">
                  <button
                    onClick={clearAll}
                    disabled={clearing}
                    className="flex items-center gap-1.5 text-[10px] text-red-500/40 hover:text-red-400 font-bold uppercase tracking-wider transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={11} /> {clearing ? 'Clearing...' : 'Clear All'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
