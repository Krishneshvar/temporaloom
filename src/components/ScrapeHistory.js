'use client';

import { useState, useEffect, useCallback } from 'react';
import { History, Globe, Calendar, Database, Link2, ArrowRight, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function safeHostname(url) {
  try { return new URL(url).hostname; }
  catch { return url || '—'; }
}

export default function ScrapeHistory({ onRestore }) {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/scrape/history');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) setHistory(data.history || []);
    } catch (e) {
      console.warn('ScrapeHistory fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    // Refresh every 15s to pick up new sessions
    const timer = setInterval(fetchHistory, 15000);
    return () => clearInterval(timer);
  }, [fetchHistory]);

  const handleRestore = async (id) => {
    try {
      const res = await fetch(`/api/scrape/history/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && onRestore) onRestore(data.events);
    } catch (e) {
      console.warn('ScrapeHistory restore error:', e);
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <History size={16} className="text-purple-400" />
          <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Crawl History</span>
          {history.length > 0 && (
            <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full font-black">
              {history.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchHistory}
          disabled={isLoading}
          className="p-1.5 hover:bg-[var(--surface)] rounded-lg text-[var(--text-dim)] hover:text-[var(--foreground)] transition-all disabled:opacity-40"
          title="Refresh history"
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* List */}
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
        {history.length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center gap-2.5">
            <Globe size={28} className="text-[var(--border)]" />
            <span className="text-xs text-[var(--text-dim)] font-bold uppercase tracking-wider">No recent crawls</span>
            <span className="text-[10px] text-[var(--text-muted)]">Start a crawl to populate history</span>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            <AnimatePresence>
              {history.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => handleRestore(item.id)}
                  className="px-5 py-4 hover:bg-[var(--surface-hover)] cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black font-mono text-blue-400/80 group-hover:text-blue-400 transition-colors truncate max-w-[160px]">
                      {safeHostname(item.startUrl)}
                    </span>
                    <span className="text-[10px] text-[var(--text-dim)] font-bold flex items-center gap-1 shrink-0">
                      <Calendar size={10} />
                      {new Date(item.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Database size={11} className="text-blue-400/60" />
                      <span className="text-sm font-black text-[var(--foreground)]">{(item.numNodes ?? 0).toLocaleString()}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold">nodes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Link2 size={11} className="text-purple-400/60" />
                      <span className="text-sm font-black text-[var(--foreground)]">{(item.numEdges ?? 0).toLocaleString()}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold">edges</span>
                    </div>
                    <div className="flex-1" />
                    <ArrowRight size={13} className="text-[var(--border)] group-hover:text-blue-500 transition-all group-hover:translate-x-1" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
