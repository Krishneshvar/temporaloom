# Phase 3 — (Corrected) Unified Next.js Backend & Data Export

Instead of a separate Node.js module, the backend has been fully integrated into the **Next.js App Router** for a cleaner, full-stack architecture.

## ✅ Accomplishments

### 1. Data Export for Visualization
- **Persistent Engine Changes**: Modified the C-binaries (`pagerank_seq` and `pagerank_mpi`) to support a new `-e` (export) flag.
- **Iteration Streaming**: The engine now writes iteration results as JSON files in the `results/` directory, used for time-progression animations in the frontend.

### 2. Unified Next.js Backend (Route Handlers)
- Deleted the separate `backend/` directory and migrated all orchestration logic to Next.js **Route Handlers** in `src/app/api/...`.
- **Endpoints Implemented**:
  * **`GET /api/datasets`**: Lists available graph `.txt` files in `datasets/`.
  * **`POST /api/run`**: Orchestrates the C engine (both sequential and MPI jobs). It returns the parsed results directly once the child process completes.
  * **`GET /api/results/performance`**: Serves benchmarking data generated during Phase 2.
  * **`GET /api/iterations/[id]`**: Serves specific iteration snapshots for the visual playback loop.
- **Shared Library (`src/lib/engine.js`)**: Centralized file-system path resolution and results cleanup logic within the project source.

### 3. Execution Design
- **Single Process Control**: spwaning binary jobs directly from Next.js server context.
- **Improved Maintainability**: No need to manage separate dependencies (`cors`, `express`, etc.) or multiple running processes during development.

---

## 🚀 How it Works
Next.js now acts as a true full-stack framework for this project. When you run `npm run dev`, you are serving both the interactive UI and the analytics engine orchestration layer from a single server.

---

## ⏭️ Next Steps (Phase 4)
- **Frontend Development**: Building the main dashboard in `src/app/page.js`.
- **D3.js Visualization**: Implementing the core graph viewer and iteration animator.
- **Dynamic Controls**: Building the UI to trigger PageRank runs on various datasets with custom process counts.
