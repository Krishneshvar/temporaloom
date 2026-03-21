# Phase 2 — Performance Benchmarking Report

This phase focused on proving parallel performance improvements and understanding the scalability of the PageRank engine.

## ✅ Accomplishments

### 1. Instrumentation for Metrics
Both the sequential and MPI engines were updated to support standardized performance reporting:
- Added a `-j` flag to output metrics (execution time, iterations, node/edge counts) in **JSON format**.
- Standardized timing using `clock_t` for sequential and `MPI_Wtime()` for parallel runs.

### 2. Automated Benchmarking Framework
Created a Python-based benchmarking suite in `scripts/benchmark.py`:
- Automates the generation of diverse test datasets (1K to 150K nodes).
- Executes sequential and MPI jobs across multiple process counts (1, 2, 4, 8).
- Calculates key parallel metrics:
  - **Speedup**: $T_{seq} / T_{mpi}$
  - **Efficiency**: $Speedup / P$
- Exports aggregated results to `results/performance.json`.

---

## 📊 Benchmarking Results

The following tests were performed on a system with 4 physical cores.

### Execution Time vs. Graph Size
| Nodes | Edges | Seq Time (s) | MPI(2) (s) | MPI(4) (s) | Max Speedup |
|-------|-------|--------------|------------|------------|-------------|
| 1,000 | 5K | 0.000049 | 0.000724 | 0.002104 | 0.07x |
| 10,000 | 50K | 0.001103 | 0.001469 | 0.005900 | 0.75x |
| 50,000 | 500K | 0.007168 | 0.005536 | 0.010777 | 1.29x |
| 150,000 | 1.5M | 0.043604 | 0.030549 | 0.022123 | **1.97x** |

### 📈 Key Observations

1.  **Overhead Threshold**: For small graphs (< 10K nodes), parallel overhead (MPI startup and `MPI_Allreduce`) outweighs the computation gains.
2.  **Parallel Scaling**: As graph size increases, the computation-to-communication ratio improves.
3.  **Speedup**: We achieved a **~2.0x speedup** on 150K nodes using 4 processes, demonstrating significant improvement.
4.  **Resource Limits**: Performance dropped when using 8 processes on a 4-core system due to context switching and resource contention.

---

## 📦 Deliverables
- **`scripts/benchmark.py`**: The automated testing suite.
- **`results/performance.json`**: raw data for future dashboard integration.
- **Improved C Binaries**: Support for JSON output and high-resolution timing.

---

## ⏭️ Next Steps (Phase 3)
In the next phase, we will pivot to the **Web Integration layer**:
- Setting up the Node.js Backend.
- Implementing the binary execution orchestration.
- Exporting per-iteration data for the visualization dashboard.
