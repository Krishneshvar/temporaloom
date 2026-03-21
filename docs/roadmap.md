# 1. Target Architecture (What You're Building)

At the end, your system should look like this:

```
+----------------------------+
|        Web Interface       |
|     (Next.js + D3.js)      |
+-------------▲--------------+
              |
          HTTP / WS
              |
+-------------|--------------+
|        Node.js Backend     |
|----------------------------|
| API endpoints              |
| Run MPI jobs               |
| Stream iteration data      |
| Dataset management         |
+-------------▲--------------+
              |
          CLI / IPC
              |
+-------------|--------------+
|      MPI PageRank Engine   |
|        (C + OpenMPI)       |
|----------------------------|
| Graph loader               |
| Graph generator            |
| Sequential baseline        |
| MPI parallel PageRank      |
| Performance metrics        |
+----------------------------+
```

Your repo already contains the **frontend**, so we'll grow around it.

---

# 2. Recommended Project Structure

Restructure to this early:

```
temporaloom
│
├── engine
│   ├── sequential
│   │   └── pagerank_seq.c
│   │
│   ├── mpi
│   │   └── pagerank_mpi.c
│   │
│   ├── graph
│   │   ├── graph_loader.c
│   │   ├── graph_loader.h
│   │   ├── graph_generator.c
│   │   └── graph_generator.h
│   │
│   ├── pagerank
│   │   ├── pagerank_core.c
│   │   └── pagerank_core.h
│   │
│   └── Makefile
│
├── datasets
│
├── backend
│   └── server.js
│
├── src
│   └── app
│
├── results
│
└── README.md
```

This separates:

```
engine      → C computation
backend     → job orchestration
frontend    → visualization
datasets    → graph inputs
results     → experiment output
```

---

# 3. Development Phases

You should build this **layer by layer**.

---

# Phase 1 — Core PageRank Engine

Goal: **Clean PageRank implementation**

Tasks:

### Graph Module

Implement reusable graph loader.

```
engine/graph/graph_loader.c
```

Responsibilities:

```
load graph from file
store adjacency matrix/list
print graph info
```

Example dataset format:

```
# nodes edges
6 8
0 1
0 2
1 2
2 0
2 3
3 4
4 5
5 3
```

---

### Graph Generator

```
graph_generator.c
```

Generate graphs like:

```
random graph
scale-free graph
web-like graph
```

Command:

```
./generate_graph 5000 > graph.txt
```

This helps benchmarking.

---

### PageRank Core

```
pagerank_core.c
```

This file contains **the actual algorithm**.

Functions:

```
initialize ranks
compute iteration
calculate convergence
```

Both sequential and MPI will call this.

---

### Sequential Baseline

```
pagerank_seq.c
```

Responsibilities:

```
load graph
run sequential PageRank
measure execution time
export results
```

---

### MPI Version

```
pagerank_mpi.c
```

Responsibilities:

```
MPI init
graph partitioning
parallel iteration
rank exchange
convergence detection
```

---

# Phase 2 — Performance Benchmarking

Goal: **prove parallel improvement**

Add benchmarking features.

Metrics:

```
execution time
speedup
efficiency
scalability
```

Example output:

```
Nodes: 5000
Edges: 25000

Sequential: 3.1 s
MPI(2): 1.9 s
MPI(4): 1.1 s
MPI(8): 0.7 s

Speedup(4): 2.8x
```

Save results:

```
results/performance.json
```

---

# Phase 3 — Data Export for Visualization

The engine should export data like:

```
iteration
node_id
rank
```

Example:

```
results/iteration_1.json
results/iteration_2.json
```

Example JSON:

```
{
 "iteration": 3,
 "nodes": [
  {"id":0,"rank":0.22},
  {"id":1,"rank":0.11}
 ]
}
```

Also export:

```
graph structure
performance stats
```

---

# Phase 4 — Node.js Backend

Create:

```
backend/server.js
```

Responsibilities:

```
run MPI engine
serve datasets
serve iteration results
```

Example endpoints:

```
GET /datasets
POST /run-pagerank
GET /results
GET /iterations
```

Example job trigger:

```
mpirun -np 4 ./pagerank_mpi dataset.txt
```

---

# Phase 5 — Visualization Layer

Your **Next.js frontend** becomes a **graph analytics dashboard**.

---

## Visualization 1 — Graph Viewer

Use:

```
D3.js
```

Display:

```
nodes
edges
```

Node size = PageRank score.

---

## Visualization 2 — Iteration Animation

Slider:

```
iteration 1 → iteration 50
```

Node sizes update.

Shows **PageRank convergence visually**.

---

## Visualization 3 — Performance Dashboard

Charts:

```
Processes vs runtime
Speedup graph
Efficiency graph
```

Libraries:

```
Recharts
Chart.js
```

---

## Visualization 4 — Graph Statistics

Display:

```
nodes
edges
average degree
iterations to converge
```

---

# Phase 6 — Final Demonstration Features

Add **polish features**.

---

### Graph Size Selection

UI:

```
Small graph
Medium graph
Large graph
```

---

### Parallelism Control

User chooses:

```
Processes = 1 / 2 / 4 / 8
```

---

### Live Simulation Mode

Show PageRank evolving.

```
Iteration 1
Iteration 2
Iteration 3
```

Animated.

---

# 4. Timeline Plan (1 Month)

You said **weekly reviews**.

---

# Week 1 — Core Engine

Deliver:

```
sequential pagerank
MPI pagerank
small dataset support
performance comparison
```

Demo:

```
seq vs MPI runtime
```

---

# Week 2 — Graph System

Deliver:

```
graph loader
graph generator
large dataset tests
performance metrics
```

Demo:

```
1000+ node graph
speedup graphs
```

---

# Week 3 — Backend + Visualization

Deliver:

```
Node backend
JSON result export
basic graph visualization
```

Demo:

```
PageRank animation
```

---

# Week 4 — Final System

Deliver:

```
interactive dashboard
performance charts
large graph experiments
```

Demo:

```
live PageRank system
```

---

# 5. Final Deliverables

Your project becomes:

```
Parallel PageRank Engine
+
Interactive Graph Analytics Dashboard
```

You will show:

```
algorithm
parallelization
performance
visual analytics
```

That’s **much stronger than a typical MPI assignment**.

---

# 6. One Thing That Will Make This Project Stand Out

Add **one extra algorithm** later:

```
Parallel BFS
or
Parallel Shortest Path
```

Then your system becomes a **mini graph analytics engine** instead of just PageRank.

That alone can elevate the project significantly.

---

If you want, I can also show you **the clean MPI PageRank architecture used in real research papers**, which will make your implementation **much faster and cleaner than your current code**.
