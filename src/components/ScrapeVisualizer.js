'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Activity, Database, CheckCircle2, AlertTriangle, Loader2, Link2, XCircle, Cpu } from 'lucide-react';
import { useRef, useEffect, useMemo } from 'react';
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
    const W = svgRef.current.parentElement?.clientWidth || 320;
    const H = 320;

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
        .force('link', d3.forceLink().id(d => d.id).distance(40))
        .force('charge', d3.forceManyBody().strength(-80))
        .force('center', d3.forceCenter(W / 2, H / 2))
        .alphaDecay(0.02);
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
  const stats = {
    nodes: latestEvent?.nodes || 0,
    edges: latestEvent?.edges || 0,
    active: latestEvent?.active || 0,
    errors: events.filter(e => e.type === 'error').length,
  };

  const currentUrl = events.findLast(e => e.type === 'crawling')?.url;

  return (
    <div className="flex flex-col gap-6 h-full min-h-[500px]">
      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Database size={16} />} label="Nodes Discovered" value={stats.nodes} color="text-blue-400" />
        <StatCard icon={<Link2 size={16} />} label="Edges Mapped" value={stats.edges} color="text-purple-400" />
        <StatCard icon={<Cpu size={16} />} label="Active Workers" value={stats.active} color="text-emerald-400" />
        <StatCard icon={<AlertTriangle size={16} />} label="Errors/Skips" value={stats.errors} color="text-amber-400" />
      </div>

      {/* Main two-panel area */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">

        {/* Live Terminal/Log */}
        <div className="col-span-12 lg:col-span-7 bg-[#0a0a0a] rounded-2xl border border-[#222] flex flex-col overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-[#222] bg-[#111] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isScraping ? 'bg-emerald-500 animate-pulse' : 'bg-[#333]'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#555]">
                System Topology Log
                {events.length > MAX_LOG_EVENTS && (
                  <span className="ml-2 text-amber-500/70">(showing last {MAX_LOG_EVENTS} of {events.length})</span>
                )}
              </span>
            </div>
            {isScraping && (
              <button
                onClick={onStop}
                className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-3 py-1 rounded-lg font-bold transition-all uppercase"
              >
                Interrupt Crawl
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed">
            <AnimatePresence initial={false}>
              {displayEvents.map((event, i) => (
                <motion.div
                  key={`${i}-${event.type}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="mb-1.5 flex items-start gap-3 group"
                >
                  <span className="text-white/20 shrink-0 select-none">{(events.length - displayEvents.length + i + 1).toString().padStart(4, '0')}</span>
                  <EventLine event={event} />
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={logEndRef} />
          </div>

          {currentUrl && isScraping && (
            <div className="p-3 bg-blue-500/5 border-t border-blue-500/10 flex items-center gap-3 shrink-0">
              <Loader2 size={14} className="animate-spin text-blue-500" />
              <span className="text-[10px] text-blue-400 font-bold truncate uppercase tracking-tight">
                Crawling: <span className="text-white opacity-80">{currentUrl}</span>
              </span>
            </div>
          )}
        </div>

        {/* Live Crawl Graph */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          <div className="flex-1 bg-[#080808] rounded-2xl border border-[#222] overflow-hidden relative shadow-2xl">
            <div className="p-3 border-b border-[#222] flex items-center gap-2">
              <Globe size={12} className="text-purple-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#555]">Live Topology Graph</span>
            </div>
            <svg ref={svgRef} className="w-full" style={{ height: 300 }} />
            {stats.nodes === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-white/10">
                  <Activity size={28} className={isScraping ? 'animate-pulse' : ''} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {isScraping ? 'Building topology...' : 'Awaiting crawl'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Status card */}
          <div className="p-5 bg-gradient-to-br from-[#111] to-[#0d0d0d] rounded-2xl border border-[#222] shadow-xl">
            {isScraping ? (
              <>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 20, ease: 'linear' }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[#444]">
                  <span>Elapsed Sequence</span>
                  <span>20s Limit</span>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-[#555] font-semibold leading-relaxed text-center">
                {stats.nodes > 0
                  ? `✓ Crawl complete — ${stats.nodes} nodes, ${stats.edges} edges`
                  : 'System idle. Enter a URL and start crawl.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="p-5 bg-[#111] rounded-2xl border border-[#222] shadow-xl flex flex-col gap-1 transition-all hover:border-white/10 hover:translate-y-[-2px]">
      <div className={`flex items-center gap-1.5 font-bold text-[10px] uppercase tracking-widest opacity-40 mb-1 ${color}`}>
        {icon}{label}
      </div>
      <div className="text-2xl font-black font-mono tracking-tighter">{value.toLocaleString()}</div>
    </div>
  );
}

function EventLine({ event }) {
  switch (event.type) {
    case 'crawling':
      return <span className="text-blue-400">[FETCH] <span className="text-white/50">Depth {event.depth}</span> → {event.url}</span>;
    case 'finished':
      return <span className="text-emerald-500">[OK] <span className="text-white/50">+{event.found} edges</span> ← {event.url}</span>;
    case 'error':
      return <span className="text-red-500 font-bold">[ERR] {event.message} — {event.url}</span>;
    case 'skipped':
      return <span className="text-amber-500/60">[SKIP] {event.reason} — {event.url}</span>;
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
