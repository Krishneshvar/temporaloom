'use client';

import { useMemo } from 'react';
import { Cpu, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RunWorkerStats({ events, loading }) {
  // workerStatus derived just like in ScrapeVisualizer
  const workerStatus = useMemo(() => {
    const status = {};
    // Traverse backwards to get the most recent state for each worker
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev.workerId && !status[ev.workerId]) {
        status[ev.workerId] = {
          message: ev.message,
          active: true, // If we got an event recently, it's active
          timestamp: i
         };
      }
    }
    return status;
  }, [events]);

  const activeWorkerIds = Object.keys(workerStatus).map(Number).sort((a, b) => a - b);
  const maxWorkers = activeWorkerIds.length > 0 ? Math.max(...activeWorkerIds) : 0;
  
  if (events.length === 0 && !loading) return null;

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-2xl overflow-hidden relative">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Cpu size={18} className="text-blue-400" />
          <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
            Active Processing Units
          </span>
        </div>
        {loading && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
            <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">
              Engine Executing...
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-3">
        {Array.from({ length: Math.max(8, maxWorkers) }).map((_, i) => {
          const id = i + 1;
          const worker = workerStatus[id];
          // Use a larger window for activity to handle fast engine runs
          const isActive = worker && (events.length - worker.timestamp < 100); 

          return (
            <motion.div
              key={id}
              initial={false}
              animate={{ 
                scale: isActive ? [1, 1.05, 1] : 1,
                opacity: (worker || loading) ? 1 : 0.2
              }}
              className={`p-3 rounded-xl border transition-all duration-300 ${
                isActive 
                  ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                  : (worker ? 'bg-[var(--surface-hover)] border-[var(--border)] opacity-60' : 'bg-[var(--surface-hover)] border-[var(--border)] opacity-30')
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className={`text-[9px] font-black uppercase tracking-tighter ${isActive ? 'text-blue-400' : 'text-[var(--text-muted)]'}`}>
                  Unit #{id.toString().padStart(2, '0')}
                </span>
                <div className="h-4 flex items-center">
                  {isActive ? (
                    <div className="flex gap-0.5">
                      {[1, 2, 3].map(b => (
                        <motion.div
                          key={b}
                          animate={{ height: [2, 8, 2] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: b * 0.1 }}
                          className="w-1 bg-blue-500 rounded-full"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="w-full h-0.5 bg-[var(--border)] rounded-full" />
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Mini-Log of engine status */}
      <div className="mt-6 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={12} className="text-[var(--text-dim)]" />
          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-dim)]">
            Engine Telemetry
          </span>
        </div>
        <div className="h-8 overflow-hidden font-mono text-[10px] text-[var(--text-muted)] italic">
          <AnimatePresence mode="wait">
            {events.length > 0 && (
              <motion.div
                key={events.length}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="truncate"
              >
                {`[WORKER ${events[events.length-1].workerId}] ${events[events.length-1].message}`}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
