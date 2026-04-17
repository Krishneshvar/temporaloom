# Temporaloom: Parallel Graph Analytics Engine
**A Distributed Framework via MPI, OpenMP, and CUDA**

---

## Slide 1: Problem Definition

- **Computational Bottlenecks:** Important graph algorithms such as PageRank, Breadth-First Search (BFS), and Single-Source Shortest Path (SSSP) become computationally intensive on massive datasets.
- **Sequential Constraints:** Traditional single-threaded processing models hit strict memory bandwidth and processing hardware limits, causing exponential execution delays.
- **Distributed Complexity:** Scaling graph analysis efficiently is difficult due to the "Communication vs. Computation" trade-off, where inter-node data transfer can cause diminishing returns on larger clusters.
- **Lack of Observability:** Understanding real-time iteration convergence and thread synchronization bottlenecks is abstract and rarely demonstrated via clear UI tools.

---

## Slide 2: Objective

- **High-Performance Infrastructure:** Develop a distributed, engine-level processing system for large-scale graph architectures.
- **Multi-Paradigm Implementations:** Engineer parallel solutions using the three industry standards—MPI (Distributed Memory), OpenMP (Shared Memory threads), and CUDA (GPU Acceleration).
- **Rigorous Benchmarking:** Profile the system dynamically measuring Execution Time, Process Scaling, Node Speedup, and Cluster Efficiency metrics against sequential baselines.
- **Interactive Visualization Dashboard:** Build a high-fidelity web platform for visualizing real-time analytical iteration convergence, hardware resource mapping, and execution metrics.

---

## Slide 3: Scope

- **Supported Algorithms:** 
  - Parallel PageRank algorithm
  - Breadth-First Search (BFS)
  - Single-Source Shortest Path (SSSP)
- **Execution Modalities:**
  - Sequential Baseline execution (for ground-truth measurement)
  - Message Passing Interface (MPI) distributed execution
  - OpenMP for multi-core processors
  - CUDA integration for massive SIMT processing
- **Performance Tooling:** Native dynamic process scaling based on host hardware, iteration state exporting, and options to run "headless" simulations without visualizations for massive topology loads.
- **Full-Stack Architecture:** C-based analytical engine wrapped by a Node.js orchestration backend and served via a Next.js / D3.js visualization dashboard.

---

## Slide 4: Parallel Concepts

- **Domain Decomposition:** Implementing strategic workload partitioning so graph adjacency matrices are split uniformly across workers to avoid process starvation.
- **Distributed vs. Shared Memory:** Applying distinct parallel strategies based on computing architecture (MPI payload exchanges vs. OpenMP thread-safe cache utilization).
- **Global Synchronization Data Loops:** Leveraging powerful collective hardware procedures (such as `MPI_Allreduce`) to securely synchronize worker states during mathematical convergence without deadlocking.
- **Amdahl’s Law Validations:** Demonstrating the scalability constraints created by sequential code (I/O reading, bootstrapping) and proving when parallel communication overtakes logical processing efficiency bounds.

---

## Slide 5: Technology Used

- **Low-Level Computation Core:** 
  - C Programming Language
  - Open MPI (Message Passing Interface)
  - OpenMP Framework 
  - NVIDIA CUDA Toolkit
- **Process Orchestration & Backend:** 
  - Node.js (Task allocation, result streaming pipelines, standard IPC networking)
- **Frontend & Visualization UI:** 
  - Next.js (React routing and framework scaffolding)
  - D3.js (Interactive graph topologies and visual representation loops)
  - Recharts Dashboard Integration (Charting historical and active runtime metrics)
- **Tooling & Build Ecosystem:** 
  - GCC, mpicc, nvcc (Cross-compilation pipelines)
  - GNU Make Automation (Engine integrations)
