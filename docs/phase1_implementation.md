# Implementation Plan - Phase 1: Core PageRank Engine

## ✅ Accomplishments

### 1. Project Restructuring
- Created the following directory structure as per the roadmap:
  - `engine/graph/`: Graph data structures and utilities.
  - `engine/pagerank/`: Shared core algorithm logic.
  - `engine/sequential/`: Sequential execution wrapper.
  - `engine/mpi/`: Parallel execution wrapper using OpenMPI.
  - `datasets/`: Storage for graph data.

### 2. Graph Module (`engine/graph/`)
- **`graph.h` / `graph.c`**: Implemented an efficient **Adjacency List** representation.
- **`graph_loader.c`**: Added functionality to load graphs from text files (supports edge lists).
- **`graph_generator.c`**: Implemented two generation models:
  - **Random Graph**: Simple random edges.
  - **Scale-Free Graph**: Barabási–Albert preferential attachment model.

### 3. PageRank Core (`engine/pagerank/`)
- Implemented the PageRank formula with:
  - Configurable damping factor ($\alpha = 0.85$).
  - Convergence detection ($\epsilon = 10^{-7}$).
  - **Dangling node handling**: Optimized to $O(N)$ for distributed environments.

### 4. Sequential Baseline (`engine/sequential/`)
- Refactored the original sequential code to use the new modular architecture.
- Included precise timing using `clock_t`.

### 5. MPI Parallel Version (`engine/mpi/`)
- Implemented distributed PageRank using `MPI_Allreduce`.
- **Partitioning**: Uniform node distribution across processes.
- **Synchronization**: Efficient rank exchange and convergence error aggregation.

---

## 🚀 How to Run

### Build
Navigate to the `engine` directory and run:
```bash
make all
```

### Execution
**Sequential:**
```bash
./pagerank_seq ../datasets/sample.txt
```

**MPI (4 processors):**
```bash
mpirun -np 4 ./pagerank_mpi ../datasets/sample.txt
```

**Generate Test Data:**
```bash
./generate_graph random 100 5 > ../datasets/test_100.txt
```

---

## 📊 Verification Results (sample.txt)
Both versions converge in identical iterations (88) with matching ranks:
- Node 3: ~0.275
- Node 4: ~0.259
- Node 5: ~0.245
- Convergence: ~88 iterations
