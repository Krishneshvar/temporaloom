# Temporaloom — Parallel PageRank Engine

Temporaloom is a distributed graph analytics system that implements the PageRank algorithm using MPI (Message Passing Interface) in C, with an interactive web-based visualization layer.

The system demonstrates how large-scale graph computations can be parallelized and analyzed in real time.

---

## 🚀 Features

- Sequential PageRank baseline (C)
- MPI-based parallel PageRank
- Graph dataset loader and generator
- Performance benchmarking (time, speedup, efficiency)
- Iterative PageRank state export (JSON)
- Interactive visualization (Next.js + D3)
- Configurable graph size and process count

---

## 🧠 Core Idea

PageRank is an iterative algorithm used to rank nodes in a graph based on link structure.

This project focuses on:

- Scaling PageRank using distributed computation
- Understanding communication vs computation trade-offs
- Visualizing convergence of ranking over time

---

## 🧱 Project Structure

```
temporaloom/
│
├── engine/              # C + MPI computation layer
│   ├── sequential/
│   ├── mpi/
│   ├── graph/
│   ├── pagerank/
│   └── Makefile
│
├── backend/             # Node.js orchestration layer
├── datasets/            # Input graphs
├── results/             # Output (JSON, metrics)
├── src/                 # Next.js frontend
└── README.md
```

---

## ⚙️ How It Works

1. Load or generate a graph
2. Run PageRank (sequential or MPI)
3. Export iteration data + performance metrics
4. Visualize results in the web UI

---

## 📊 Metrics

The system measures:

- Execution time
- Speedup
- Efficiency
- Convergence rate

---

## 🧪 Example Usage

### Sequential

```bash
gcc pagerank_seq.c -o seq -lm
./seq dataset.txt
```

### Parallel (MPI)

```bash
mpicc pagerank_mpi.c -o mpi_pr -lm
mpirun -np 4 ./mpi_pr dataset.txt
```

---

## 📅 Roadmap

### Phase 1

* Sequential + MPI PageRank
* Small graph testing

### Phase 2

* Large graph support
* Performance benchmarking

### Phase 3

* Data export (JSON)
* Backend API

### Phase 4

* Visualization dashboard
* Interactive graph analytics

---

## 🎯 Goals

* Demonstrate practical parallel computing
* Build a mini distributed graph engine
* Provide intuitive visualization of PageRank dynamics

---

## 📌 Future Enhancements

* Parallel BFS / shortest path
* Graph partitioning strategies
* Streaming PageRank updates
* GPU acceleration (CUDA/OpenCL)
* Distributed cluster deployment

---

## 🧾 License

MIT
