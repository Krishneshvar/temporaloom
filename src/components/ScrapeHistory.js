'use client';

import { useState, useEffect } from 'react';
import { History, Globe, Calendar, Database, Link2, Trash2, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ScrapeHistory({ onRestore }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/scrape/history');
      const data = await res.json();
      if (data.success) setHistory(data.history);
    } catch (_) {}
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    fetchHistory();
    // Poll for updates if a scrape was just finished
    const timer = setInterval(fetchHistory, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleRestore = async (id) => {
    try {
      const res = await fetch(`/api/scrape/history/${id}`);
      const data = await res.json();
      if (data.success) {
        onRestore(data.events);
      }
    } catch (_) {}
  };

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-hover)]">
        <div className="flex items-center gap-2">
          <History size={16} className="text-purple-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Crawl History</span>
        </div>
        <button onClick={fetchHistory} className="text-[10px] text-blue-400 font-bold hover:text-blue-300 transition-colors uppercase">Refresh</button>
      </div>

      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
        {history.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center gap-2">
            <Globe size={24} className="text-[var(--border)]" />
            <span className="text-[10px] text-[var(--text-dim)] font-bold uppercase">No recent crawls</span>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {history.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => handleRestore(item.id)}
                className="p-4 hover:bg-[var(--surface-hover)] cursor-pointer transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono text-blue-400/80 font-bold group-hover:text-blue-400 transition-colors">
                    {new URL(item.startUrl).hostname}
                  </span>
                  <span className="text-[10px] text-[var(--text-dim)] font-bold uppercase flex items-center gap-1">
                    <Calendar size={10} /> {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-1">
                     <Database size={10} className="text-[var(--text-dim)]" />
                     <span className="text-[11px] font-black text-[var(--foreground)]">{item.numNodes}</span>
                   </div>
                   <div className="flex items-center gap-1">
                     <Link2 size={10} className="text-[var(--text-dim)]" />
                     <span className="text-[11px] font-black text-[var(--foreground)]">{item.numEdges}</span>
                   </div>
                   <div className="flex-1" />
                   <ArrowRight size={12} className="text-[var(--border)] group-hover:text-blue-500 transition-all group-hover:translate-x-1" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
