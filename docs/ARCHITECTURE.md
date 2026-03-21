# System Architecture — Temporaloom

This document describes the internal architecture of the Temporaloom system.

---

## 🧩 High-Level Architecture

```
+-----------------------------+
|        Web Interface        |
|   (Next.js + D3.js)         |
+-------------▲---------------+
              |
       HTTP / WebSocket
              |
+-------------|---------------+
| Node.js Backend             |
| --------------------------- |
| Job orchestration           |
| Dataset management          |
| Result streaming            |
+-------------▲---------------+
              |
          CLI / IPC
              |
+-------------|---------------+
| MPI PageRank Engine (C)     |
| --------------------------- |
| Graph processing            |
| Parallel computation        |
| Communication (MPI)         |
+-----------------------------+
```

---

## 🔧 Engine Layer (C + MPI)

### Components

#### 1. Graph Module

Responsible for:

- Loading graph from file
- Generating synthetic graphs
- Storing adjacency structure

Formats supported:

```
node_id node_id
```

---

#### 2. PageRank Core

Implements:

```
PR(i) = (1-d)/N + d * Σ(PR(j)/L(j))
```

Responsibilities:

- Rank initialization
- Iterative computation
- Convergence detection

---

#### 3. Sequential Engine

- Runs PageRank on a single process
- Used as baseline for benchmarking

---

#### 4. MPI Engine

Implements distributed PageRank.

### Workflow

1. Initialize MPI
2. Partition graph across processes
3. Iterate:
   * Compute local contributions
   * Exchange data (MPI_Allreduce)
   * Update ranks
4. Check convergence
5. Output results

---

### Partitioning Strategy

```
Nodes: N
Processes: P

Each process handles:
N / P nodes
```

---

### Communication Model

- Local computation per process
- Global synchronization using:

```
MPI_Allreduce
```

Used for:

- Aggregating rank contributions
- Computing convergence error

---

## 🔄 Data Flow

```
Graph → Engine → Iterations → JSON → Backend → Frontend
```

---

## 📦 Output Format

### Iteration Data

```json
{
  "iteration": 5,
  "nodes": [
    {"id": 0, "rank": 0.23},
    {"id": 1, "rank": 0.11}
  ]
}
```

---

### Performance Data

```json
{
  "nodes": 2500,
  "processes": 4,
  "execution_time": 0.42,
  "speedup": 2.1,
  "efficiency": 0.52
}
```

---

## 🌐 Backend Layer

### Responsibilities

* Trigger MPI jobs
* Serve datasets
* Provide API endpoints
* Stream results to frontend

### Example API

```
POST /run
GET /results
GET /iterations
GET /datasets
```

---

## 🎨 Frontend Layer

Built using:

* Next.js
* D3.js

### Features

#### Graph Visualization

* Nodes and edges
* Node size proportional to PageRank

#### Iteration Playback

* Slider for iteration steps
* Animated convergence

#### Performance Dashboard

* Runtime vs processes
* Speedup charts
* Efficiency graphs

---

## ⚖️ Performance Considerations

### Trade-offs

| Factor        | Impact                   |
| ------------- | ------------------------ |
| Computation   | improves with scale      |
| Communication | increases with processes |
| Small graphs  | MPI slower               |
| Large graphs  | MPI faster               |

---

## 🚧 Limitations

* Uses adjacency matrix (memory heavy)
* Single-machine MPI (not cluster-scale)
* Basic partitioning strategy

---

## 🔮 Future Improvements

* Adjacency list representation
* Distributed file loading
* Advanced partitioning (edge cuts)
* Asynchronous communication
* GPU acceleration

---

## 🧠 Key Insight

Parallel performance depends on:

```
Computation >> Communication
```

Temporaloom demonstrates this trade-off clearly through experimentation.
