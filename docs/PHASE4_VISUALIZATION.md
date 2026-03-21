# Phase 4 — Dynamic Graph Analytics Dashboard

Phase 4 transformed Temporaloom from a command-line engine into a premium, interactive web-based analytics dashboard.

## ✅ Accomplishments

### 1. Interactive Graph Visualization (D3.js)
- Implemented a standard **Force-Directed Graph** viewer using `d3-force`.
- **Dynamic Node Scaling**: Node visual radii and color intensities are bound to real-time PageRank scores. As you navigate the simulation, nodes physically grow or shrink based on their rank.
- **Interactive Manipulation**: Added drag-and-drop support and a force-recalculation engine for manual graph exploration.

### 2. High-Fidelity Dashboard UI
- **Unified Controls**: Built a "Control Center" for selecting datasets, toggling Parallel/Sequential execution, and configuring MPI process counts.
- **Advanced State Management**: Implemented an iteration-based results cache to enable seamless "time travel" through the PageRank convergence history.
- **Iteration Navigation Overlay**: Added a sleek navigation slider that lets you playback the simulation frame-by-frame after the run completes.

### 3. Performance Analytics (Recharts)
- Integrated a **Metrics Dashboard** that compares sequential runtime against MPI configurations.
- Real-time calculation of **Speedup** and **Efficiency** displayed as premium metric cards.

### 4. Full-Stack Data Integration
- Extended Next.js Route Handlers to serve raw dataset content for frontend graph parsing.
- Linked UI state directly to the `/api/run` and `/api/iterations` endpoints built in Phase 3.

---

## 🎨 Visual Identity
- **Theme**: Obsidian Dark with Glassmorphic overlays.
- **Typography**: Industrial 'Inter' sans-serif for a technical, high-performance feel.
- **Micro-interactions**: Framer Motion transitions for smooth UI state changes.

---

## 🚀 How to Launch
1. Ensure `next dev` is running:
   ```bash
   npm run dev
   ```
2. Open locally at `http://localhost:3000`.

---

## 🏁 Final Deliverables
- `src/components/GraphViewer.js`: Core D3 engine.
- `src/components/ControlPanel.js`: Simulation controls.
- `src/components/PerformanceChart.js`: Parallel metrics visualizer.
- `src/app/page.js`: The central dashboard logic.
