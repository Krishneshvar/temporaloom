'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Layers } from 'lucide-react';
import NodeInspector from '@/components/NodeInspector';

const LAYOUTS = [
  { id: 'force',    label: 'Force',  icon: '⬡' },
  { id: 'circular', label: 'Circle', icon: '◯' },
  { id: 'radial',   label: 'Radial', icon: '✦' },
];

export default function GraphViewer({ dataset, iterationData, onNodeClick, onGraphLoaded }) {
  const svgRef       = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);
  const zoomRef      = useRef(null);
  // Store raw (pre-D3) link list for neighbour lookup
  const rawLinksRef  = useRef([]);

  const [structure, setStructure] = useState(null);
  const [layout, setLayout]      = useState('force');
  const [tooltip, setTooltip]    = useState(null);
  const [selected, setSelected]  = useState(null); // node shown in inspector

  // ── Load graph structure ──────────────────────────────────────────────────
  useEffect(() => {
    if (!dataset) return;
    setSelected(null);
    fetch(`/api/datasets/${dataset}`)
      .then(r => r.text())
      .then(text => {
        const lines = text.split('\n');
        const nodeSet = new Set();
        const links = [];
        let headerRead = false;
        lines.forEach(line => {
          if (line.startsWith('#') || !line.trim()) return;
          const parts = line.trim().split(/\s+/);
          if (parts.length !== 2) return;
          const a = parseInt(parts[0]), b = parseInt(parts[1]);
          if (isNaN(a) || isNaN(b)) return;
          if (!headerRead) { headerRead = true; return; }
          nodeSet.add(a); nodeSet.add(b);
          links.push({ source: a, target: b });
        });

        rawLinksRef.current = links;

        // Pre-compute in/out degree maps
        const outDeg = new Map();
        const inDeg  = new Map();
        const outNb  = new Map();
        const inNb   = new Map();
        nodeSet.forEach(id => { outDeg.set(id, 0); inDeg.set(id, 0); outNb.set(id, []); inNb.set(id, []); });
        links.forEach(({ source, target }) => {
          outDeg.set(source, (outDeg.get(source) || 0) + 1);
          inDeg.set(target,  (inDeg.get(target)  || 0) + 1);
          outNb.get(source)?.push(target);
          inNb.get(target)?.push(source);
        });

        const nodes = Array.from(nodeSet).map(id => ({
          id, rank: 0,
          outDegree: outDeg.get(id) || 0,
          inDegree:  inDeg.get(id)  || 0,
          outNeighbors: outNb.get(id) || [],
          inNeighbors:  inNb.get(id)  || [],
        }));

        const avgDeg = links.length / Math.max(nodes.length, 1);

        // Degree distribution
        const degCount = new Map();
        nodes.forEach(n => degCount.set(n.outDegree, (degCount.get(n.outDegree) || 0) + 1));
        const degreeDistribution = Array.from(degCount.entries())
          .sort((a, b) => a[0] - b[0])
          .slice(0, 20)
          .map(([degree, count]) => ({ degree, count }));

        setStructure({ nodes, links });
        onGraphLoaded?.({ nodes: nodes.length, edges: links.length, avgDegree: parseFloat(avgDeg.toFixed(2)), degreeDistribution });
      });
  }, [dataset, onGraphLoaded]);

  // ── Zoom helpers ─────────────────────────────────────────────────────────
  const zoomBy    = useCallback((f) => { if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, f); }, []);
  const resetZoom = useCallback(() => { if (svgRef.current && zoomRef.current) d3.select(svgRef.current).transition().duration(400).call(zoomRef.current.transform, d3.zoomIdentity); }, []);

  // ── Layout ────────────────────────────────────────────────────────────────
  const applyLayout = useCallback((nodes, links, W, H, lt) => {
    if (simulationRef.current) simulationRef.current.stop();

    if (lt === 'circular') {
      const r = Math.min(W, H) * 0.38;
      nodes.forEach((n, i) => { const a = 2 * Math.PI * i / nodes.length; n.x = W/2 + r*Math.cos(a); n.y = H/2 + r*Math.sin(a); n.fx = n.x; n.fy = n.y; });
      return null;
    }

    if (lt === 'radial') {
      const bfs = new Map(), visited = new Set(), adj = new Map();
      nodes.forEach(n => adj.set(n.id, []));
      links.forEach(l => { const s = typeof l.source==='object'?l.source.id:l.source, t = typeof l.target==='object'?l.target.id:l.target; adj.get(s)?.push(t); });
      const q = [nodes[0]?.id ?? 0]; bfs.set(q[0], 0); visited.add(q[0]);
      while (q.length) { const v = q.shift(); (adj.get(v)||[]).forEach(nb => { if (!visited.has(nb)) { visited.add(nb); bfs.set(nb, bfs.get(v)+1); q.push(nb); } }); }
      const maxL = Math.max(...bfs.values(), 0), lc = new Map(), li = new Map();
      bfs.forEach(l => lc.set(l, (lc.get(l)||0)+1));
      nodes.forEach(n => {
        const lvl = bfs.get(n.id) ?? maxL, idx = li.get(lvl)||0; li.set(lvl, idx+1);
        const a = 2*Math.PI*idx/(lc.get(lvl)||1), r = (lvl/(maxL+1))*Math.min(W,H)*0.42;
        n.x = W/2+r*Math.cos(a); n.y = H/2+r*Math.sin(a); n.fx = n.x; n.fy = n.y;
      });
      return null;
    }

    nodes.forEach(n => { delete n.fx; delete n.fy; });
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(60))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(W/2, H/2))
      .force('collide', d3.forceCollide(12));
    simulationRef.current = sim;
    return sim;
  }, []);

  // ── Build D3 scene ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!structure || !svgRef.current || !containerRef.current) return;

    const W = containerRef.current.clientWidth || 800, H = 500;
    const svg = d3.select(svgRef.current).attr('viewBox', [0, 0, W, H]);
    svg.selectAll('*').remove();

    const zoom = d3.zoom().scaleExtent([0.04, 10]).on('zoom', e => g.attr('transform', e.transform));
    zoomRef.current = zoom;
    svg.call(zoom);

    // Click on SVG background → deselect
    svg.on('click', () => { setSelected(null); onNodeClick?.(null); });

    const g = svg.append('g');
    const nodes = structure.nodes.map(n => ({ ...n }));
    const links = structure.links.map(l => ({ ...l }));

    const linkSel = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', '#2d3748').attr('stroke-opacity', 0.6).attr('stroke-width', 1);

    const nodeSel = g.append('g').selectAll('circle').data(nodes).join('circle')
      .attr('class', 'node-circle')
      .attr('r', 7).attr('fill', '#3b82f6').attr('stroke', '#1e40af').attr('stroke-width', 1.5)
      .attr('cursor', 'pointer')
      .on('mouseenter', (e, d) => {
        d3.select(e.currentTarget).transition().duration(150).attr('r', (d._r||7)*1.4).attr('stroke', '#60a5fa').attr('stroke-width', 2.5);
        setTooltip({ id: d.id, rank: d._rank ?? 0, x: e.offsetX, y: e.offsetY });
      })
      .on('mousemove', e => setTooltip(p => p ? { ...p, x: e.offsetX, y: e.offsetY } : null))
      .on('mouseleave', (e, d) => {
        d3.select(e.currentTarget).transition().duration(150).attr('r', d._r||7).attr('stroke', selected?.id === d.id ? '#60a5fa' : '#1e40af').attr('stroke-width', selected?.id === d.id ? 2 : 1.5);
        setTooltip(null);
      })
      .on('click', (e, d) => {
        e.stopPropagation();
        const nodeInfo = {
          id: d.id,
          rank: d._rank ?? 0,
          outDegree: d.outDegree ?? 0,
          inDegree:  d.inDegree  ?? 0,
          outNeighbors: d.outNeighbors ?? [],
          inNeighbors:  d.inNeighbors  ?? [],
        };
        setSelected(nodeInfo);
        onNodeClick?.(nodeInfo);
      })
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active && simulationRef.current) simulationRef.current.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end',   (e, d) => { if (!e.active && simulationRef.current) simulationRef.current.alphaTarget(0); d.fx = null; d.fy = null; }));

    const tick = () => {
      linkSel.attr('x1', d => d.source.x??0).attr('y1', d => d.source.y??0).attr('x2', d => d.target.x??0).attr('y2', d => d.target.y??0);
      nodeSel.attr('cx', d => d.x).attr('cy', d => d.y);
    };

    const sim = applyLayout(nodes, links, W, H, layout);
    if (sim) sim.on('tick', tick); else tick();
    return () => { if (simulationRef.current) simulationRef.current.stop(); };
  }, [structure, layout, applyLayout, onNodeClick]);

  // Highlight selected node ring
  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).selectAll('.node-circle')
      .attr('stroke', d => selected?.id === d.id ? '#60a5fa' : '#1e40af')
      .attr('stroke-width', d => selected?.id === d.id ? 2.5 : 1.5);
  }, [selected]);

  // ── O(1) rank update ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!iterationData || !svgRef.current) return;
    const rankMap = new Map(iterationData.nodes.map(n => [n.id, n.rank]));
    d3.select(svgRef.current).selectAll('.node-circle')
      .each(function(d) { d._rank = rankMap.get(d.id) ?? 0; })
      .transition().duration(250)
      .attr('r', d => { const r = 5 + Math.sqrt(d._rank) * 55; d._r = r; return r; })
      .attr('fill', d => d3.interpolateBlues(0.25 + Math.min(d._rank * 6, 0.75)));
  }, [iterationData]);

  // ESC closes inspector
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') { setSelected(null); onNodeClick?.(null); } };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNodeClick]);

  return (
    <div ref={containerRef} className="w-full bg-[#060606] rounded-2xl overflow-hidden shadow-2xl relative h-[500px]">
      <svg ref={svgRef} className="w-full h-full" />

      {/* Node Inspector (inline) */}
      <NodeInspector node={selected} onClose={() => { setSelected(null); onNodeClick?.(null); }} />

      {/* Layout Presets */}
      <div className="absolute top-4 right-4 flex gap-1">
        {LAYOUTS.map(l => (
          <button key={l.id} onClick={() => setLayout(l.id)} title={l.label}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${layout === l.id ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-white/30 hover:text-white/60'}`}>
            {l.icon} {l.label}
          </button>
        ))}
      </div>

      {/* Zoom Controls */}
      <div className="absolute bottom-16 right-4 flex flex-col gap-1">
        <button onClick={() => zoomBy(1.5)} className="w-8 h-8 bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg text-white text-lg font-bold flex items-center justify-center transition-all border border-white/10">+</button>
        <button onClick={resetZoom}         className="w-8 h-8 bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg text-white/60 text-[10px] font-bold flex items-center justify-center transition-all border border-white/10">FIT</button>
        <button onClick={() => zoomBy(0.67)} className="w-8 h-8 bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg text-white text-lg font-bold flex items-center justify-center transition-all border border-white/10">−</button>
      </div>

      {/* Hover Tooltip */}
      {tooltip && (
        <div className="absolute z-20 pointer-events-none bg-black/90 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-mono shadow-2xl" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
          <div className="text-white/40 text-[9px] uppercase tracking-widest mb-1">Node</div>
          <div className="text-white font-black text-base leading-none">#{tooltip.id}</div>
          <div className="text-blue-400 mt-1">PageRank: <span className="text-white">{(tooltip.rank||0).toFixed(6)}</span></div>
          <div className="text-white/30 text-[9px] mt-0.5">Click to inspect</div>
        </div>
      )}

      {/* Empty state */}
      {!dataset && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-white/10">
            <Layers size={40} />
            <span className="text-xs font-bold uppercase tracking-widest">No dataset loaded</span>
          </div>
        </div>
      )}
    </div>
  );
}
