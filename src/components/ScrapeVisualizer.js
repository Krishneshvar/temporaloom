'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Activity, Database, CheckCircle2, AlertTriangle, Loader2, Link2, XCircle, Cpu, AlertCircle, Info, Hash, Search, X, Maximize2, GitBranch, Layout, TrendingUp, Table, Share2, BarChart3 } from 'lucide-react';
import { useRef, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@/components/ThemeProvider';
import ScrapeDataTable from './ScrapeDataTable';
import ScrapePerformance from './ScrapePerformance';

const MAX_LOG_EVENTS = 300; // cap to prevent RAM explosion

export default function ScrapeVisualizer({ events, isScraping, onStop }) {
  const { theme } = useTheme();
  const logContainerRef = useRef(null);
  const logEndRef = useRef(null);
  const svgRef = useRef(null);
  const liveGraphRef = useRef({ nodes: new Map(), links: [], sim: null });
  
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [concurrency, setConcurrency] = useState(12);
  const [showDNA, setShowDNA] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [viewMode, setViewMode] = useState('graph'); // 'graph' | 'table' | 'analysis'
  const [latencies, setLatencies] = useState({}); // Tracking start times

  // Auto-scroll log (restricted to log container)
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }

    // Update latencies
    const latest = events[events.length - 1];
    if (latest?.type === 'crawling') {
      setLatencies(prev => ({ ...prev, [latest.url]: Date.now() }));
    } else if (latest?.type === 'finished' || latest?.type === 'error') {
      const startTime = latencies[latest.url];
      if (startTime) {
        const duration = Date.now() - startTime;
        latest.latency = duration;
      }
    }
  }, [events]);

  // ── Live D3 Crawl Graph ──────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const parent = svgRef.current.parentElement;
    const W = parent?.clientWidth || 500;
    const H = parent?.clientHeight || 640;

    const svg = d3.select(svgRef.current);
    const colorScale = d3.scaleSequential(d3.interpolateViridis); // Heatmap scale

    if (svg.select('g').empty()) {
      svg.attr('viewBox', [0, 0, W, H]);
      const zoom = d3.zoom().scaleExtent([0.1, 8]).on('zoom', e => svg.select('g').attr('transform', e.transform));
      svg.call(zoom);
      svg.append('g');
    }

    const g = svg.select('g');
    const lg = liveGraphRef.current;

    // Initialize simulation once
    if (!lg.sim) {
      lg.sim = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(60))
        .force('charge', d3.forceManyBody().strength(-150))
        .force('center', d3.forceCenter(W / 2, H / 2))
        .force('collision', d3.forceCollide().radius(20))
        .alphaDecay(0.015);
    }

    // Process new finished events to add nodes/links
    const newFinished = events.filter(e => e.type === 'finished' || e.type === 'crawling');
    let graphChanged = false;

    newFinished.forEach(ev => {
      if (!lg.nodes.has(ev.url)) {
        lg.nodes.set(ev.url, { id: ev.url, depth: ev.depth || 0 });
        graphChanged = true;
      }
    });

    // Add edges from finished events
    events.filter(e => e.type === 'finished').forEach(ev => {
      // The crawled URL is the source; we don't have individual targets here,
      // but we can link it to the start node for a visual "crawl tree"
      const startUrl = events.find(e => e.type === 'crawling' && e.depth === 0)?.url;
      if (startUrl && ev.url !== startUrl && !lg.links.find(l => l.source === startUrl && l.target === ev.url)) {
        lg.links.push({ source: startUrl, target: ev.url });
        graphChanged = true;
      }
    });

    if (!graphChanged) return;

    const nodesArr = Array.from(lg.nodes.values());
    const linksArr = lg.links.slice();

    // Colour by depth
    const depthScale = d3.scaleSequential(d3.interpolateCool).domain([0, 5]);

    // Links
    const linkSel = g.selectAll('.live-link')
      .data(linksArr, d => `${d.source}|${d.target}`)
      .join('line')
      .attr('class', 'live-link')
      .attr('stroke', theme === 'dark' ? '#334155' : '#cbd5e1')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1);

    // Nodes
    const nodeSel = g.selectAll('.live-node')
      .data(nodesArr, d => d.id)
      .join('circle')
      .attr('class', 'live-node')
      .attr('stroke', d => selectedNode?.id === d.id ? (theme === 'dark' ? '#fff' : '#000') : (theme === 'dark' ? '#0f172a' : '#f8fafc'))
      .attr('stroke-width', d => selectedNode?.id === d.id ? 2 : 1)
      .on('click', (e, d) => setSelectedNode(d))
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) lg.sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => { if (!e.active) lg.sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    // Heatmap Color Adjustment based on Live PageRank
    const pageRank = latestEvent?.pageRank || {};
    const maxPR = Math.max(...Object.values(pageRank), 0.0001);

    nodeSel.transition().duration(500)
      .attr('r', d => {
        const base = d.depth === 0 ? 9 : 5;
        const prBonus = pageRank[d.id] ? (pageRank[d.id] / maxPR) * 10 : 0;
        return base + prBonus;
      })
      .attr('fill', d => {
        const score = pageRank[d.id] || 0;
        return colorScale(score / maxPR);
      })
      .attr('opacity', d => {
        if (!searchQuery) return 1;
        return d.id.toLowerCase().includes(searchQuery.toLowerCase()) ? 1 : 0.2;
      });

    lg.sim.nodes(nodesArr).on('tick', () => {
      linkSel
        .attr('x1', d => (typeof d.source === 'object' ? d.source.x : 0) ?? 0)
        .attr('y1', d => (typeof d.source === 'object' ? d.source.y : 0) ?? 0)
        .attr('x2', d => (typeof d.target === 'object' ? d.target.x : 0) ?? 0)
        .attr('y2', d => (typeof d.target === 'object' ? d.target.y : 0) ?? 0);
      nodeSel.attr('cx', d => d.x ?? 0).attr('cy', d => d.y ?? 0);
    });

    lg.sim.force('link').links(linksArr);
    lg.sim.alpha(0.4).restart();
  }, [events, theme, selectedNode, searchQuery]);

  // Reset graph state when new crawl starts
  useEffect(() => {
    if (isScraping && events.length === 0) {
      liveGraphRef.current = { nodes: new Map(), links: [], sim: null };
      if (svgRef.current) d3.select(svgRef.current).selectAll('*').remove();
    }
  }, [isScraping, events.length]);

  // Windowed events to prevent memory explosion
  const displayEvents = useMemo(() => {
    if (events.length <= MAX_LOG_EVENTS) return events;
    return events.slice(events.length - MAX_LOG_EVENTS);
  }, [events]);

  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  // Persist stats even when the 'complete' event arrives (which lacks top-level node/edge fields)
  const stats = useMemo(() => {
    // Find the last event that had stats
    const lastStatEvent = [...events].reverse().find(e => e.nodes !== undefined);
    
    // If complete event, it might have stats in .data
    const completeEvent = events.find(e => e.type === 'complete');
    
    return {
      nodes: lastStatEvent?.nodes || completeEvent?.data?.numNodes || 0,
      edges: lastStatEvent?.edges || completeEvent?.data?.numEdges || 0,
      active: lastStatEvent?.active || 0,
      errors: events.filter(e => e.type === 'error').length,
      analytics: lastStatEvent?.analytics || { degreeDist: {}, maxDegree: 0 }
    };
  }, [events]);

  const handleConcurrencyChange = async (val) => {
    setConcurrency(val);
    try {
      await fetch('/api/scrape', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concurrency: val })
      });
    } catch (e) {}
  };

  const currentUrl = events.findLast(e => e.type === 'crawling')?.url;

  const workerStatus = useMemo(() => {
    const status = {};
    // We only care about the most recent activity for each worker
    // Traverse backwards for efficiency
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev.workerId && !status[ev.workerId]) {
        status[ev.workerId] = {
          url: ev.url,
          type: ev.type,
          active: ev.type === 'crawling',
          timestamp: i
         };
      }
    }
    return status;
  }, [events]);

  return (
    <div className="flex flex-col gap-6 h-full min-h-0">
      {/* Header Stats - Hidden during active scrape for maximum visibility */}
      {!isScraping && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Database size={16} />} label="Nodes Discovered" value={stats.nodes} color="text-blue-400" />
          <StatCard icon={<Link2 size={16} />} label="Edges Mapped" value={stats.edges} color="text-purple-400" />
          <StatCard icon={<Cpu size={16} />} label="Active Workers" value={stats.active} color="text-emerald-400" />
          <StatCard icon={<AlertTriangle size={16} />} label="Errors/Skips" value={stats.errors} color="text-amber-400" />
        </div>
      )}

      {/* Worker Dashboard - New Parallelism Visualization */}
      <div className={`bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-6 shadow-2xl overflow-hidden relative transition-all duration-500 ${isScraping ? 'mb-2' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-emerald-400" />
            <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">Parallel Worker Threads</span>
          </div>
          {isScraping && (
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-6 text-[10px] uppercase font-bold tracking-tight">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> <span className="text-emerald-500/80">Active</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[var(--border)]" /> <span className="text-[var(--text-muted)]">Idle</span></div>
              </div>
              <div className="h-6 w-px bg-[var(--border)]" />
              <div className="flex gap-6">
                <div className="flex flex-col"><span className="text-[9px] text-[var(--text-muted)] font-black uppercase leading-none">Nodes</span><span className="text-sm font-mono font-bold text-blue-400 leading-none">{stats.nodes}</span></div>
                <div className="flex flex-col"><span className="text-[9px] text-[var(--text-muted)] font-black uppercase leading-none">Edges</span><span className="text-sm font-mono font-bold text-purple-400 leading-none">{stats.edges}</span></div>
              </div>
            </div>
          )}
        </div>
        
        <div className={`grid gap-4 transition-all duration-500 ${isScraping ? 'grid-cols-4 md:grid-cols-6 lg:grid-cols-12' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'}`}>
          {Array.from({ length: 24 }).map((_, i) => {
            const id = i + 1;
            const worker = workerStatus[id];
            if (id > (isScraping ? concurrency : 12)) return null;
            return (
              <div 
                key={id} 
                className={`transition-all duration-300 rounded-xl border ${
                  worker?.active 
                    ? 'bg-emerald-500/5 border-emerald-500/20 ring-1 ring-emerald-500/10' 
                    : 'bg-[var(--surface-hover)] border-[var(--border)] opacity-30 shadow-none'
                } ${isScraping ? 'p-3' : 'p-4'}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-black uppercase tracking-tighter ${worker?.active ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                    #{id.toString().padStart(2, '0')}
                  </span>
                </div>
                {!isScraping || worker?.active ? (
                  <div className="h-4 overflow-hidden">
                    {worker?.url ? (
                      <div className="text-[10px] text-[var(--foreground)] opacity-50 font-mono truncate leading-none">
                        {new URL(worker.url).pathname}
                      </div>
                    ) : (
                      <div className="text-[9px] text-[var(--border)] font-bold uppercase truncate">...</div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {isScraping && (
          <div className="mt-8 pt-6 border-t border-[var(--border)] flex flex-col lg:flex-row lg:items-center gap-8 bg-[var(--background)]/20 p-4 rounded-2xl">
            <div className="flex items-center gap-4 min-w-[300px]">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest">Dynamic Worker Scaling</span>
                <span className="text-xl font-mono font-bold text-emerald-400">{concurrency} Threads</span>
              </div>
              <input 
                type="range" min="1" max="24" value={concurrency} 
                onChange={(e) => handleConcurrencyChange(parseInt(e.target.value))}
                className="flex-1 accent-emerald-500 h-1.5 rounded-lg bg-[var(--border)] cursor-pointer"
              />
            </div>
            <div className="h-10 w-px bg-[var(--border)] hidden lg:block" />
            <div className="flex-1 flex flex-col gap-2">
               <div className="flex items-center gap-2 text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest">
                  <Search size={14} /> Search Topology
               </div>
               <input 
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Find URL in graph or keyword..." 
                className="bg-[var(--surface-hover)] border border-[var(--border)] p-3 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none text-xs text-[var(--foreground)]/80 w-full placeholder:text-[var(--text-muted)]"
               />
            </div>
          </div>
        )}
      </div>


      {/* Main two-panel area */}
      <div className={`flex-1 grid grid-cols-12 gap-6 min-h-0 transition-all duration-700 ${isScraping ? 'flex-grow' : ''}`}>

        {/* Live Terminal/Log */}
        <div className={`bg-[var(--surface)] rounded-2xl border border-[var(--border)] flex flex-col overflow-hidden shadow-2xl transition-all duration-500 ${isScraping ? 'col-span-12 lg:col-span-4' : 'col-span-12 lg:col-span-7'}`}>
          <div className="p-4 border-b border-[var(--border)] bg-[var(--surface-hover)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isScraping ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--border)]'}`} />
              <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                System Topology Log
              </span>
            </div>
            {isScraping && (
              <button
                onClick={onStop}
                className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-4 py-1.5 rounded-lg font-bold transition-all uppercase"
              >
                Stop
              </button>
            )}
          </div>

          <div 
            ref={logContainerRef}
            className="overflow-y-scroll p-4 font-mono text-xs leading-none custom-scrollbar bg-[var(--background)]/40 flex-1 max-h-[500px]"
            style={{ scrollbarWidth: 'thin' }}
          >
            <AnimatePresence initial={false}>
              {displayEvents.map((event, i) => (
                <motion.div
                  key={`${i}-${event.type}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.1 }}
                  className="mb-1 flex items-start gap-2 group border-l border-[var(--border)] pl-2"
                >
                  <EventLine event={event} />
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={logEndRef} />
          </div>

          {!isScraping && currentUrl && (
            <div className="p-3 bg-blue-500/5 border-t border-blue-500/10 flex items-center gap-3 shrink-0">
              <Loader2 size={14} className="animate-spin text-blue-500" />
              <span className="text-[10px] text-blue-400 font-bold truncate uppercase tracking-tight">
                Crawling: <span className="text-[var(--foreground)] opacity-80">{currentUrl}</span>
              </span>
            </div>
          )}
        </div>

        <div className={`flex flex-col gap-4 transition-all duration-700 ${isFullScreen ? 'fixed inset-0 z-[100] bg-[var(--background)] p-8' : isScraping ? 'col-span-12 lg:col-span-8' : 'col-span-12 lg:col-span-5'}`}>
          <div className="flex-1 bg-[var(--background)] rounded-2xl border border-[var(--border)] overflow-hidden relative shadow-2xl flex flex-col">
            <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Globe size={14} className="text-purple-400" />
                <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                  {viewMode === 'graph' ? (isFullScreen ? 'Topology Deep-Dive' : 'Live Topology Visualizer') : 'Tabular Topology Data'}
                </span>
                
                <div className="flex bg-[var(--surface-hover)] p-1 rounded-lg border border-[var(--border)] ml-4">
                  <button 
                    onClick={() => setViewMode('graph')}
                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'graph' ? 'bg-blue-600 text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--foreground)]'}`}
                  >
                    <Share2 size={12} /> Graph
                  </button>
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--foreground)]'}`}
                  >
                    <Table size={12} /> Table
                  </button>
                  <button 
                    onClick={() => setViewMode('analysis')}
                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all flex items-center gap-2 ${viewMode === 'analysis' ? 'bg-blue-600 text-white shadow-lg' : 'text-[var(--text-dim)] hover:text-[var(--foreground)]'}`}
                  >
                    <BarChart3 size={12} /> Analytics
                  </button>
                </div>

                {viewMode === 'graph' && (
                  <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-1 flex items-center gap-1">
                    <div className="w-12 h-2 bg-gradient-to-r from-purple-800 to-yellow-400 rounded-sm" />
                    <span className="text-[8px] font-black text-[var(--text-dim)] uppercase">Heatmap (PageRank)</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowDNA(!showDNA)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${showDNA ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-[var(--surface-hover)] border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--foreground)]'}`}
                  >
                    <TrendingUp size={12} /> Graph DNA
                  </button>
                  <button 
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className={`p-1.5 rounded-lg transition-all shadow-sm border ${isFullScreen ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-[var(--surface-hover)] text-[var(--text-dim)] border-[var(--border)] hover:text-white'}`}
                    title={isFullScreen ? "Exit Fullscreen" : "Fullscreen Mode"}
                  >
                    {isFullScreen ? <X size={14} /> : <Maximize2 size={14} />}
                  </button>
                </div>
                {(isScraping || isFullScreen) && (
                  <div className="flex items-center gap-4 px-4 py-1.5 bg-[var(--surface)] font-mono rounded-full border border-[var(--border)]">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" /> <span className="text-[10px] font-black text-[var(--text-dim)] uppercase">NODES: {stats.nodes}</span></div>
                    <div className="w-px h-3 bg-[var(--border)]" />
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500" /> <span className="text-[10px] font-black text-[var(--text-dim)] uppercase">EDGES: {stats.edges}</span></div>
                  </div>
                )}
              </div>
            </div>
            
            <div className={`flex-1 relative transition-all duration-500 ${viewMode === 'graph' ? 'min-h-[400px]' : 'bg-[var(--background)]'}`}>
              {viewMode === 'graph' && <svg ref={svgRef} className="w-full h-full cursor-crosshair" />}
              {viewMode === 'table' && <ScrapeDataTable events={events} />}
              {viewMode === 'analysis' && <ScrapePerformance events={events} isScraping={isScraping} />}
              
              {/* Node Inspector Overlay */}
              <AnimatePresence>
                {selectedNode && (
                  <motion.div 
                    initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }}
                    className="absolute right-4 top-4 bottom-4 w-72 bg-[var(--surface)]/90 backdrop-blur-xl border border-[var(--border)] rounded-2xl shadow-3xl p-6 overflow-hidden z-20 flex flex-col gap-6"
                   >
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-4">
                      <div className="flex items-center gap-2">
                        <Maximize2 size={16} className="text-blue-400" />
                        <span className="text-xs font-black uppercase tracking-widest text-[var(--foreground)]/80">Node Inspector</span>
                      </div>
                      <button onClick={() => setSelectedNode(null)} className="text-[var(--text-dim)] hover:text-[var(--foreground)] transition-colors">
                        <X size={18} />
                      </button>
                    </div>

                    <div className="flex flex-col gap-2">
                       <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-tighter">Canonical Identity</span>
                       <div className="text-xs font-mono text-emerald-400 break-all leading-relaxed p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                         {selectedNode.url}
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-[var(--background)]/5 border border-[var(--border)] rounded-xl flex flex-col gap-1">
                        <span className="text-[9px] font-black text-[var(--text-dim)] uppercase">Centrality</span>
                        <span className="text-lg font-mono font-bold text-yellow-500">
                          {((latestEvent?.pageRank?.[selectedNode.id] || 0) * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="p-4 bg-[var(--background)]/5 border border-[var(--border)] rounded-xl flex flex-col gap-1">
                        <span className="text-[9px] font-black text-[var(--text-dim)] uppercase">Neighbors</span>
                        <span className="text-lg font-mono font-bold text-blue-500">
                          {liveGraphRef.current.links.filter(l => l.source.id === selectedNode.id || l.target.id === selectedNode.id).length}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                       <span className="text-[10px] font-black text-[var(--text-dim)] uppercase tracking-widest flex items-center gap-2">
                         <GitBranch size={12} /> Proximal Relations
                       </span>
                       <div className="h-48 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                          {liveGraphRef.current.links.filter(l => l.source.id === selectedNode.id || l.target.id === selectedNode.id).slice(0, 10).map((l, i) => {
                            const neighbor = l.source.id === selectedNode.id ? l.target : l.source;
                            return (
                              <div key={i} className="flex items-center gap-2 p-2 bg-[var(--background)]/3 border border-[var(--border)] rounded-lg">
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${l.source.id === selectedNode.id ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                                  {l.source.id === selectedNode.id ? 'OUT' : 'IN'}
                                </span>
                                <span className="text-[9px] font-mono text-[var(--text-dim)] truncate flex-1">{neighbor.name}</span>
                              </div>
                            );
                          })}
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Graph DNA Overlay (Power Law Chart) */}
              <AnimatePresence>
                {showDNA && (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                    className="absolute left-6 bottom-6 w-80 bg-[var(--surface)]/90 backdrop-blur-xl border border-[var(--border)] rounded-3xl p-6 z-20"
                  >
                    <div className="flex items-center gap-2 mb-6 border-b border-[var(--border)] pb-4">
                      <TrendingUp size={18} className="text-emerald-400" />
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase text-[var(--foreground)]/80">Graph DNA Analysis</span>
                        <span className="text-[8px] font-black text-[var(--text-dim)] uppercase tracking-widest">Live Power-Law Calculation</span>
                      </div>
                    </div>
                    
                    <div className="h-40 flex items-end gap-1.5 border-b border-[var(--border)] pb-2">
                       {Object.entries(stats.analytics.degreeDist).sort((a,b) => Number(a[0])-Number(b[0])).slice(0, 20).map(([degree, count]) => {
                         const height = (count / stats.nodes) * 100;
                         return (
                           <div key={degree} className="flex-1 flex flex-col gap-1 items-center group">
                             <div 
                              className="w-full bg-emerald-500/40 border border-emerald-500/20 rounded-t-sm transition-all hover:bg-emerald-400" 
                              style={{ height: `${Math.max(height * 2, 4)}%` }} 
                             />
                             <span className="text-[7px] text-[var(--text-dim)] font-black group-hover:text-emerald-400">{degree}</span>
                           </div>
                         );
                       })}
                    </div>
                    <div className="mt-4 flex justify-between">
                       <div className="flex flex-col">
                         <span className="text-[8px] font-black text-[var(--text-dim)] uppercase leading-none">Topology Entropy</span>
                         <span className="text-sm font-mono font-bold text-[var(--foreground)]/80">{(Math.log(stats.edges || 1) / Math.log(stats.nodes || 1)).toFixed(3)}</span>
                       </div>
                       <div className="flex flex-col items-end">
                         <span className="text-[8px] font-black text-[var(--text-dim)] uppercase leading-none">Max Conn</span>
                         <span className="text-sm font-mono font-bold text-emerald-400">{stats.analytics.maxDegree}</span>
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {stats.nodes === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-[var(--text-dim)]">
                    <Activity size={32} className={isScraping ? 'animate-pulse' : ''} />
                    <span className="text-xs font-bold uppercase tracking-widest">
                      {isScraping ? 'Initializing topology...' : 'Awaiting crawl session'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!isScraping && (
            <div className="p-5 bg-gradient-to-br from-[var(--surface)] to-[var(--surface-hover)] rounded-2xl border border-[var(--border)] shadow-xl text-center">
               <p className="text-[11px] text-[var(--text-muted)] font-semibold leading-relaxed">
                  {stats.nodes > 0
                    ? `✓ Crawl complete — ${stats.nodes} nodes, ${stats.edges} edges`
                    : 'System idle. Enter a URL and start crawl.'}
                </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="p-6 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-xl flex flex-col gap-2 transition-all hover:border-[var(--text-muted)] hover:translate-y-[-2px]">
      <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-widest opacity-50 mb-1 ${color}`}>
        {icon}{label}
      </div>
      <div className="text-4xl font-black font-mono tracking-tighter text-[var(--foreground)]">{value.toLocaleString()}</div>
    </div>
  );
}

function EventLine({ event }) {
  const workerBadge = event.workerId ? (
    <span className="shrink-0 scale-90 origin-left bg-[var(--foreground)]/5 border border-[var(--border)] px-2 py-0.5 rounded text-[9px] font-black text-[var(--text-dim)] group-hover:text-[var(--foreground)]/60 transition-colors uppercase tracking-tight">
      W#{event.workerId}
    </span>
  ) : null;

  switch (event.type) {
    case 'crawling':
      return (
        <span className="text-blue-400 flex items-center gap-2">
          {workerBadge}
          <span>[FETCH] <span className="text-[var(--foreground)]/50">Depth {event.depth}</span> → {event.url}</span>
        </span>
      );
    case 'finished':
      return (
        <span className="text-emerald-500 flex items-center gap-2">
          {workerBadge}
          <span>[OK] <span className="text-[var(--foreground)]/50">+{event.found} edges</span> ← {event.url}</span>
        </span>
      );
    case 'error':
      return (
        <span className="text-red-500 font-bold flex items-center gap-2">
          {workerBadge}
          <span>[ERR] {event.message} — {event.url}</span>
        </span>
      );
    case 'skipped':
      return (
        <span className="text-amber-500/60 flex items-center gap-2">
          {workerBadge}
          <span>[SKIP] {event.reason} — {event.url}</span>
        </span>
      );
    case 'complete':
      return (
        <div className="p-2 my-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <span className="text-emerald-400 font-black flex items-center gap-2">
            <CheckCircle2 size={12} />
            CRAWL COMPLETE: {event.data?.filename}
          </span>
        </div>
      );
    case 'aborted':
      return <span className="text-red-400 font-black italic">[STOP] SEQUENCE INTERRUPTED BY USER OPERATOR</span>;
    default:
      return null;
  }
}
