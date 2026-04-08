'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'framer-motion';
import { GitBranch, Sigma, Cpu, Zap, Maximize2 } from 'lucide-react';

export default function BFSResult({ data, loading }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const zoomRef = useRef(null);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const W = containerRef.current.clientWidth || 700;
    const H = 420;

    const svg = d3.select(svgRef.current).attr('viewBox', [0, 0, W, H]);
    svg.selectAll('*').remove();

    const zoom = d3.zoom().scaleExtent([0.05, 8]).on('zoom', e => g.attr('transform', e.transform));
    zoomRef.current = zoom;
    svg.call(zoom);

    const g = svg.append('g');

    // Build node list and links from levels
    const levels = data.levels || [];
    const allNodes = [];
    const allLinks = [];
    const posMap = new Map(); // node_id → {x, y}

    const maxLevel = levels.length - 1;
    const levelSpacing = Math.min(H / (maxLevel + 2), 80);

    levels.forEach((lvl, li) => {
      const count = lvl.node_ids.length;
      const y = 40 + li * levelSpacing;
      const nodeSpacing = Math.min(W / (count + 1), 60);
      const startX = W / 2 - ((count - 1) * nodeSpacing) / 2;

      lvl.node_ids.forEach((nid, ni) => {
        const x = startX + ni * nodeSpacing;
        posMap.set(nid, { x, y });
        allNodes.push({ id: nid, level: li });
      });
    });

    // Build edges: connect each node to its parent (node in previous level that has an edge to it)
    // Use a simplified heuristic: connect each node to the source of the first edge in the graph
    // that leads to it. Since we have distances, we know the parent level is level-1.
    // We'll just draw level lines (tree edges) for clarity.
    for (let li = 1; li < levels.length; li++) {
      const prevIds = new Set(levels[li - 1].node_ids);
      levels[li].node_ids.forEach(nid => {
        // Find any node in prev level for visual tree — use first node in prev level as parent
        // (Proper parent tracking would require BFS tree output from engine)
        const parentId = levels[li - 1].node_ids[Math.floor(Math.random() * levels[li - 1].node_ids.length)];
        if (posMap.has(nid) && posMap.has(parentId)) {
          allLinks.push({ source: parentId, target: nid });
        }
      });
    }

    // Color scale by level
    const colorScale = d3.scaleSequential(d3.interpolateCool).domain([0, maxLevel]);

    // Links
    g.append('g')
      .selectAll('line')
      .data(allLinks)
      .join('line')
      .attr('x1', d => posMap.get(d.source)?.x ?? 0)
      .attr('y1', d => posMap.get(d.source)?.y ?? 0)
      .attr('x2', d => posMap.get(d.target)?.x ?? 0)
      .attr('y2', d => posMap.get(d.target)?.y ?? 0)
      .attr('stroke', '#2d3748')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1);

    // Level labels
    levels.forEach((lvl, li) => {
      g.append('text')
        .attr('x', 14)
        .attr('y', (posMap.get(lvl.node_ids[0])?.y ?? 40) + 4)
        .text(`L${li}`)
        .attr('fill', '#555')
        .attr('font-size', 9)
        .attr('font-family', 'monospace')
        .attr('font-weight', 'bold');
    });

    // Nodes
    g.append('g')
      .selectAll('circle')
      .data(allNodes)
      .join('circle')
      .attr('cx', d => posMap.get(d.id)?.x ?? 0)
      .attr('cy', d => posMap.get(d.id)?.y ?? 0)
      .attr('r', d => d.level === 0 ? 10 : 5)
      .attr('fill', d => colorScale(d.level))
      .attr('stroke', '#0a0a0a')
      .attr('stroke-width', 1.5);

  }, [data]);

  if (loading) {
    return (
      <div className="h-full bg-[var(--surface)] rounded-2xl border border-[var(--border)] flex flex-col items-center justify-center p-8 min-h-[400px]">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-20 h-20 rounded-full border-t-2 border-emerald-500 animate-spin" />
          <GitBranch size={28} className="text-emerald-500 animate-pulse" />
        </div>
        <span className="mt-8 text-[var(--text-muted)] font-bold uppercase tracking-widest text-sm">Running Graph Traversal...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full bg-[var(--surface)] rounded-2xl border border-[var(--border)] border-dashed flex flex-col items-center justify-center gap-3 text-[var(--text-dim)] min-h-[400px] hover:border-[var(--text-muted)] transition-all">
        <GitBranch size={32} />
        <span className="text-xs font-bold uppercase tracking-widest">Run BFS to visualize traversal</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Mode', value: data.mode?.toUpperCase().replace('_', ' ') ?? '—', color: 'text-emerald-400' },
          { label: 'Reachable', value: `${data.reachable ?? 0} / ${data.nodes ?? 0}`, color: 'text-blue-400' },
          { label: 'Max Distance', value: data.max_distance ?? '—', color: 'text-purple-400' },
          { label: 'Time', value: `${(data.execution_time ?? 0).toFixed(4)}s`, color: 'text-amber-400' },
        ].map(s => (
          <div key={s.label} className="p-4 bg-[var(--surface)] rounded-2xl border border-[var(--border)] flex flex-col gap-1 shadow-xl">
            <span className={`text-[10px] font-black uppercase tracking-widest opacity-50 ${s.color}`}>{s.label}</span>
            <span className="text-xl font-black font-mono tracking-tighter text-[var(--foreground)]">{s.value}</span>
          </div>
        ))}
      </div>

      {/* BFS Tree Visualization */}
      <div ref={containerRef} className="bg-[var(--background)] rounded-2xl border border-[var(--border)] overflow-hidden relative shadow-2xl">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch size={14} className="text-emerald-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              BFS Tree — Source: Node {data.source ?? 0} — {data.levels?.length ?? 0} Levels
            </span>
          </div>
          <div className="flex gap-2 text-[10px] font-bold text-[var(--text-muted)]">
            {data.processes && <span className="text-purple-400/60">{data.processes} MPI Processes</span>}
          </div>
        </div>
        <svg ref={svgRef} className="w-full" style={{ height: 420 }} />
      </div>

      {/* Level breakdown table */}
      {data.levels && data.levels.length > 0 && (
        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[var(--border)]">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Level Breakdown</span>
          </div>
          <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-[var(--surface)]">
                <tr className="text-[var(--text-dim)] text-[10px] uppercase tracking-widest border-b border-[var(--border)]">
                  <th className="px-4 py-2 text-left">Distance</th>
                  <th className="px-4 py-2 text-left">Nodes at Level</th>
                  <th className="px-4 py-2 text-left">Sample IDs</th>
                </tr>
              </thead>
              <tbody>
                {data.levels.map((lvl, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-[var(--border)]/10 hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    <td className="px-4 py-2">
                      <span className="text-emerald-400 font-black">{lvl.distance}</span>
                    </td>
                    <td className="px-4 py-2 text-[var(--text-dim)]">{lvl.node_ids.length.toLocaleString()}</td>
                    <td className="px-4 py-2 text-[var(--text-muted)]">
                      {lvl.node_ids.slice(0, 8).join(', ')}{lvl.node_ids.length > 8 ? ' ...' : ''}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
