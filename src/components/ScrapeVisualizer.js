'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Activity, Database, CheckCircle2, AlertTriangle, Loader2, Link2, XCircle, Cpu } from 'lucide-react';
import { useRef, useEffect, useMemo, useState } from 'react';
import * as d3 from 'd3';

const MAX_LOG_EVENTS = 300; // cap to prevent RAM explosion

export default function ScrapeVisualizer({ events, isScraping, onStop }) {
  const logEndRef = useRef(null);
  const svgRef = useRef(null);
  const liveGraphRef = useRef({ nodes: new Map(), links: [], sim: null });

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  // ── Live D3 Crawl Graph ──────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return;
    const W = svgRef.current.parentElement?.clientWidth || 500;
    const H = 500;

    const svg = d3.select(svgRef.current);

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
      .attr('stroke', '#334155')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1);

    // Nodes
    const nodeSel = g.selectAll('.live-node')
      .data(nodesArr, d => d.id)
      .join('circle')
      .attr('class', 'live-node')
      .attr('r', d => d.depth === 0 ? 9 : 5)
      .attr('fill', d => depthScale(d.depth || 0))
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1)
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) lg.sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => { if (!e.active) lg.sim.alphaTarget(0); d.fx = null; d.fy = null; }));

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
  }, [events]);

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
    };
  }, [events]);

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
    <div className="flex flex-col gap-6 h-full min-h-[500px]">
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
      <div className={`bg-[#0a0a0a] rounded-2xl border border-[#222] p-6 shadow-2xl overflow-hidden relative transition-all duration-500 ${isScraping ? 'mb-2' : ''}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Cpu size={18} className="text-emerald-400" />
            <span className="text-xs font-black uppercase tracking-widest text-[#666]">Parallel Worker Threads</span>
          </div>
          {isScraping && (
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-6 text-[10px] uppercase font-bold tracking-tight">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> <span className="text-emerald-500/80">Active</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#333]" /> <span className="text-[#666]">Idle</span></div>
              </div>
              <div className="h-6 w-px bg-[#222]" />
              <div className="flex gap-6">
                <div className="flex flex-col"><span className="text-[9px] text-[#444] font-black uppercase leading-none">Nodes</span><span className="text-sm font-mono font-bold text-blue-400 leading-none">{stats.nodes}</span></div>
                <div className="flex flex-col"><span className="text-[9px] text-[#444] font-black uppercase leading-none">Edges</span><span className="text-sm font-mono font-bold text-purple-400 leading-none">{stats.edges}</span></div>
              </div>
            </div>
          )}
        </div>
        
        <div className={`grid gap-4 transition-all duration-500 ${isScraping ? 'grid-cols-4 md:grid-cols-6 lg:grid-cols-12' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6'}`}>
          {Array.from({ length: 12 }).map((_, i) => {
            const id = i + 1;
            const worker = workerStatus[id];
            return (
              <div 
                key={id} 
                className={`transition-all duration-300 rounded-xl border ${
                  worker?.active 
                    ? 'bg-emerald-500/5 border-emerald-500/20 ring-1 ring-emerald-500/10' 
                    : 'bg-[#111] border-[#222] opacity-30 shadow-none'
                } ${isScraping ? 'p-3' : 'p-4'}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] font-black uppercase tracking-tighter ${worker?.active ? 'text-emerald-400' : 'text-[#444]'}`}>
                    #{id.toString().padStart(2, '0')}
                  </span>
                </div>
                {!isScraping || worker?.active ? (
                  <div className="h-4 overflow-hidden">
                    {worker?.url ? (
                      <div className="text-[10px] text-white/50 font-mono truncate leading-none">
                        {new URL(worker.url).pathname}
                      </div>
                    ) : (
                      <div className="text-[9px] text-[#222] font-bold uppercase truncate">...</div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main two-panel area */}
      <div className={`flex-1 grid grid-cols-12 gap-6 min-h-0 transition-all duration-700 ${isScraping ? 'flex-grow' : ''}`}>

        {/* Live Terminal/Log */}
        <div className={`bg-[#0a0a0a] rounded-2xl border border-[#222] flex flex-col overflow-hidden shadow-2xl transition-all duration-500 ${isScraping ? 'col-span-12 lg:col-span-4' : 'col-span-12 lg:col-span-7'}`}>
          <div className="p-4 border-b border-[#222] bg-[#111] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isScraping ? 'bg-emerald-500 animate-pulse' : 'bg-[#333]'}`} />
              <span className="text-xs font-black uppercase tracking-widest text-[#666]">
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

          <div className={`overflow-y-auto p-4 font-mono text-xs leading-relaxed custom-scrollbar bg-black/40 ${isScraping ? 'h-[600px]' : 'h-[400px]'}`}>
            <AnimatePresence initial={false}>
              {displayEvents.map((event, i) => (
                <motion.div
                  key={`${i}-${event.type}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.1 }}
                  className="mb-1 flex items-start gap-2 group border-l border-white/5 pl-2"
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
                Crawling: <span className="text-white opacity-80">{currentUrl}</span>
              </span>
            </div>
          )}
        </div>

        {/* Live Crawl Graph */}
        <div className={`flex flex-col gap-4 transition-all duration-700 ${isScraping ? 'col-span-12 lg:col-span-8' : 'col-span-12 lg:col-span-5'}`}>
          <div className="flex-1 bg-[#080808] rounded-2xl border border-[#222] overflow-hidden relative shadow-2xl flex flex-col">
            <div className="p-4 border-b border-[#222] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-purple-400" />
                <span className="text-xs font-black uppercase tracking-widest text-[#666]">Live Topology Visualizer</span>
              </div>
              {isScraping && (
                <div className="flex items-center gap-4 px-4 py-1.5 bg-white/5 rounded-full border border-white/5">
                   <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" /> <span className="text-[10px] font-black text-white/40 uppercase">NODES: {stats.nodes}</span></div>
                   <div className="w-px h-3 bg-white/10" />
                   <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500" /> <span className="text-[10px] font-black text-white/40 uppercase">EDGES: {stats.edges}</span></div>
                </div>
              )}
            </div>
            <div className={`flex-1 relative transition-all duration-500 ${isScraping ? 'h-[600px]' : 'h-[400px]'}`}>
              <svg ref={svgRef} className="w-full h-full cursor-move" />
              {stats.nodes === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-white/10">
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
            <div className="p-5 bg-gradient-to-br from-[#111] to-[#0d0d0d] rounded-2xl border border-[#222] shadow-xl">
               <p className="text-[11px] text-[#555] font-semibold leading-relaxed text-center">
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
    <div className="p-6 bg-[#111] rounded-2xl border border-[#222] shadow-xl flex flex-col gap-2 transition-all hover:border-white/10 hover:translate-y-[-2px]">
      <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-widest opacity-40 mb-1 ${color}`}>
        {icon}{label}
      </div>
      <div className="text-3xl font-black font-mono tracking-tighter">{value.toLocaleString()}</div>
    </div>
  );
}

function EventLine({ event }) {
  const workerBadge = event.workerId ? (
    <span className="shrink-0 scale-90 origin-left bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[9px] font-black text-white/40 group-hover:text-white/60 transition-colors uppercase tracking-tight">
      W#{event.workerId}
    </span>
  ) : null;

  switch (event.type) {
    case 'crawling':
      return (
        <span className="text-blue-400 flex items-center gap-2">
          {workerBadge}
          <span>[FETCH] <span className="text-white/50">Depth {event.depth}</span> → {event.url}</span>
        </span>
      );
    case 'finished':
      return (
        <span className="text-emerald-500 flex items-center gap-2">
          {workerBadge}
          <span>[OK] <span className="text-white/50">+{event.found} edges</span> ← {event.url}</span>
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
