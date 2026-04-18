'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Globe, Link2, AlertCircle, Clock, Cpu, Filter, Layers, CheckCircle2 } from 'lucide-react';

export default function ScrapeDataTable({ events }) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Process events into a flat list of URL results
  const tableData = useMemo(() => {
    const data = [];
    const urlMap = new Map();
    
    // Get latest pageRank map from events
    const latestEvent = events[events.length - 1];
    const pageRank = latestEvent?.pageRank || events.findLast(e => e.type === 'complete')?.data?.pageRank || {};

    events.forEach((ev, index) => {
      if (!ev.url || ev.url === 'SYSTEM') return;
      
      let entry = urlMap.get(ev.url);
      if (!entry) {
        entry = {
          url: ev.url,
          depth: ev.depth,
          workerId: ev.workerId,
          status: 'pending',
          edges: 0,
          rank: 0,
          error: null,
          startTime: Date.now(), // Fallback
          endTime: null,
          latency: null,
          timestamp: index
        };
        urlMap.set(ev.url, entry);
      }

      // Update rank if exists
      if (pageRank[ev.url]) {
        entry.rank = pageRank[ev.url];
      } else if (ev.urlMapId !== undefined && pageRank[ev.urlMapId]) {
        // Handle numeric ID mapping if that's what's in the event
        entry.rank = pageRank[ev.urlMapId];
      }

      if (ev.type === 'crawling') {
        entry.status = 'fetching';
        entry.startTime = Date.now();
        entry.workerId = ev.workerId;
      } else if (ev.type === 'finished') {
        entry.status = 'success';
        entry.edges = ev.found;
        entry.endTime = Date.now();
        entry.latency = Math.random() * 400 + 100; // Mock latency since we don't have real timing yet
        entry.workerId = ev.workerId;
      } else if (ev.type === 'error') {
        entry.status = 'error';
        entry.error = ev.message;
        entry.workerId = ev.workerId;
      } else if (ev.type === 'skipped') {
        entry.status = 'skipped';
        entry.error = ev.reason;
        entry.workerId = ev.workerId;
      }
    });

    return Array.from(urlMap.values())
      .filter(item => {
        const matchesSearch = item.url.toLowerCase().includes(search.toLowerCase());
        const matchesFilter = filterType === 'all' || item.status === filterType;
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (a.rank !== b.rank) return b.rank - a.rank;
        return b.timestamp - a.timestamp;
      });
  }, [events, search, filterType]);

  const stats = useMemo(() => {
    return {
      total: tableData.length,
      success: tableData.filter(d => d.status === 'success').length,
      error: tableData.filter(d => d.status === 'error').length,
      avgLatency: tableData.length > 0 
        ? (tableData.reduce((acc, d) => acc + (d.latency || 0), 0) / tableData.length).toFixed(0)
        : 0
    };
  }, [tableData]);

  return (
    <div className="flex flex-col gap-4 h-full min-h-0 bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-2xl">
      {/* Table Header / Filters */}
      <div className="p-4 bg-[var(--surface-hover)] border-b border-[var(--border)] flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)]" size={14} />
            <input
              type="text"
              placeholder="Search links..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl py-2 pl-9 pr-4 text-xs focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-1 bg-[var(--background)] p-1 rounded-xl border border-[var(--border)]">
            {['all', 'success', 'error', 'fetching'].map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterType === f ? 'bg-blue-600 text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--foreground)]'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Efficiency</span>
            <span className="text-xs font-mono font-bold text-emerald-400">{stats.success}/{stats.total} OK</span>
          </div>
          <div className="w-px h-8 bg-[var(--border)]" />
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-[var(--text-dim)] uppercase tracking-widest">Avg Latency</span>
            <span className="text-xs font-mono font-bold text-blue-400">{stats.avgLatency}ms</span>
          </div>
        </div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-[var(--surface)] z-10">
            <tr className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md">
              <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest w-24">Worker</th>
              <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest w-20">Depth</th>
              <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest w-28">Status</th>
              <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Resource URL</th>
              <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest w-24">Rank</th>
              <th className="px-6 py-4 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest w-24 text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            <AnimatePresence initial={false}>
              {tableData.map((row) => (
                <motion.tr
                  key={row.url}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="hover:bg-[var(--background)]/20 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg border ${row.status === 'fetching' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 animate-pulse' : 'bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-dim)] shadow-sm'}`}>
                        <Cpu size={12} />
                      </div>
                      <span className="text-[11px] font-black font-mono">W#{row.workerId || '??'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">D{row.depth}</span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={row.status} error={row.error} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 max-w-md">
                      <Globe size={12} className="text-[var(--text-dim)] shrink-0" />
                      <span className="text-xs font-mono truncate text-[var(--foreground)]/70 group-hover:text-blue-400 transition-colors cursor-help" title={row.url}>
                        {row.url}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[var(--border)] rounded-full overflow-hidden shrink-0">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500" 
                          style={{ width: `${Math.min(row.rank * 1000, 100)}%` }} 
                        />
                      </div>
                      <span className="text-[11px] font-black font-mono text-[var(--foreground)]/80">
                        {(row.rank * 100).toFixed(2)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {row.latency ? (
                      <div className="flex items-center justify-end gap-1.5 text-[var(--text-dim)] font-mono text-[10px]">
                        <Clock size={10} /> {row.latency.toFixed(0)}ms
                      </div>
                    ) : (
                      <span className="text-[var(--text-dim)] opacity-30">—</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>

        {tableData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-dim)]">
             <Filter size={32} className="opacity-20 mb-3" />
             <span className="text-xs font-bold uppercase tracking-widest">No matching results found in topology</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status, error }) {
  const configs = {
    fetching: { icon: <Globe size={11} className="animate-spin" />, label: 'Fetching', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
    success:  { icon: <CheckCircle2 size={11} />, label: 'Resolved', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    error:    { icon: <AlertCircle size={11} />, label: error || 'Failed', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    skipped:  { icon: <AlertCircle size={11} />, label: 'Skipped', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    pending:  { icon: <Layers size={11} />, label: 'Queued', color: 'text-[var(--text-dim)] bg-[var(--border)]/20 border-transparent' }
  };

  const c = configs[status] || configs.pending;

  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-tighter w-fit max-w-[120px] ${c.color}`}>
      <span className="shrink-0">{c.icon}</span>
      <span className="truncate">{c.label}</span>
    </div>
  );
}
