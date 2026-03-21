'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

export default function GraphViewer({ dataset, iterationData }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);
  const [structure, setStructure] = useState(null);

  // Load Graph Structure (Once per dataset)
  useEffect(() => {
    if (!dataset) return;

    fetch(`/api/datasets/${dataset}`)
      .then(res => res.text())
      .then(text => {
        const lines = text.split('\n');
        const nodeSet = new Set();
        const links = [];

        lines.forEach(line => {
          if (line.startsWith('#') || !line.trim()) return;
          const parts = line.trim().split(/\s+/);
          if (parts.length === 2) {
            const u = parseInt(parts[0]);
            const v = parseInt(parts[1]);
            nodeSet.add(u);
            nodeSet.add(v);
            links.push({ source: u, target: v });
          }
        });

        setStructure({
          nodes: Array.from(nodeSet).map(id => ({ id, rank: 0 })),
          links
        });
      });
  }, [dataset]);

  // Initial D3 Setup
  useEffect(() => {
    if (!structure || !svgRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = 500;

    const svg = d3.select(svgRef.current).attr('viewBox', [0, 0, width, height]);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('class', 'main-group');

    const simulation = d3.forceSimulation(structure.nodes)
      .force('link', d3.forceLink(structure.links).id(d => d.id).distance(50))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2));

    simulationRef.current = simulation;

    const link = g.append('g')
      .selectAll('line')
      .data(structure.links)
      .join('line')
      .attr('stroke', '#4b5563')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1);

    const node = g.append('g')
      .selectAll('circle')
      .data(structure.nodes)
      .join('circle')
      .attr('class', 'node-circle')
      .attr('r', 8)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .call(d3.drag()
        .on('start', (e, d) => {
          if (!e.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (e, d) => {
          d.fx = e.x; d.fy = e.y;
        })
        .on('end', (e, d) => {
          if (!e.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        }));

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
    });

    return () => simulation.stop();
  }, [structure]);

  // Update Visual Attributes (Rank) without re-seeding the simulation
  useEffect(() => {
    if (!iterationData || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const nodes = svg.selectAll('.node-circle');

    nodes.transition()
      .duration(200)
      .attr('r', d => {
        const update = iterationData.nodes.find(n => n.id === d.id);
        const rank = update ? update.rank : 0;
        return 5 + Math.sqrt(rank) * 60;
      })
      .attr('fill', d => {
        const update = iterationData.nodes.find(n => n.id === d.id);
        const rank = update ? update.rank : 0;
        return d3.interpolateBlues(0.2 + rank * 5);
      });

  }, [iterationData]);

  return (
    <div ref={containerRef} className="w-full bg-[#0a0a0a] rounded-2xl overflow-hidden shadow-2xl relative h-[500px]">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
