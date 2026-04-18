# `pagerank_mpi.c` — MPI Distributed PageRank

Distributed-memory parallelism using MPI. Each process is a separate OS process —
they communicate only via explicit message passing, with no shared memory.

---

## Initialisation

```c
MPI_Init(&argc, &argv);
MPI_Comm_rank(MPI_COMM_WORLD, &rank);  // this process's ID (0 … size-1)
MPI_Comm_size(MPI_COMM_WORLD, &size);  // total number of processes
```

---

## Graph Loading — Replicated Data

Every process independently loads the full graph from disk. This is a replicated
(not partitioned) data model — each process holds a full copy of the graph in
memory. This trades memory usage for simplicity: no ghost node communication or
graph partitioning logic is needed, which would be required in a true
distributed-memory graph cut scheme.

---

## Node Partitioning — Uniform Block Assignment

```c
int nodes_per_proc = n / size;
int start_node = rank * nodes_per_proc;
int end_node   = (rank == size - 1) ? n : start_node + nodes_per_proc;
```

The node ID space `[0, n)` is divided into `size` contiguous blocks. The last
process absorbs any remainder to guarantee full coverage. Each process is
responsible only for computing rank contributions for its slice of nodes.

---

## Three Rank Buffers

Three arrays are needed (vs. two in the sequential version):

| Buffer | Purpose |
|--------|---------|
| `ranks` | Global current rank vector — identical on all processes after each reduce |
| `temp_new_ranks` | This process's *partial* contributions for the next iteration (non-zero only in `[start_node, end_node)`) |
| `new_ranks` | The globally accumulated next-rank vector produced by Allreduce |

---

## Communication — `MPI_Allreduce`

Two collective operations are called every iteration:

```c
MPI_Allreduce(&local_dangling_sum, &total_dangling_sum, 1, MPI_DOUBLE, MPI_SUM, MPI_COMM_WORLD);
MPI_Allreduce(temp_new_ranks, new_ranks, n, MPI_DOUBLE, MPI_SUM, MPI_COMM_WORLD);
```

1. **Dangling sum:** Nodes with zero out-degree are "dangling" — their rank must
   be redistributed uniformly to prevent rank from leaking out of the graph. Each
   process accumulates its partition's dangling total; the Allreduce globally sums
   them.

2. **Rank vector:** Each process contributes its partial `temp_new_ranks` (zeros
   outside its assigned range). Summing across all processes produces the complete
   `new_ranks`. After this, every process has an identical, globally-correct rank
   vector and can proceed to the next iteration without additional synchronisation.

The Allreduce pattern means this implementation scales well on small to medium
process counts but becomes communication-bound at high core counts due to the
O(n) vector reduction every iteration.

---

## Timing

`MPI_Wtime()` measures wall-clock time across all processes — the correct metric
for parallel performance. `clock()` would accumulate CPU time across all processes
and produce meaningless results.

---

## Output

Only rank-0 prints results and writes iteration export files, preventing all
processes from writing to stdout simultaneously.

---

## CLI Flags

| Flag | Effect |
|------|--------|
| `-j` | Output results as JSON |
| `-e` | Export per-iteration snapshots (rank 0 only) |

---

## Worker Telemetry

```c
// At the start of every iteration, each rank reports its status
fprintf(stderr, "[WORKER %d] status processing iteration %d\n", rank + 1, iter);
fflush(stderr);
```

Every distributed MPI process sends a heartbeat signal to `stderr`. The frontend maps these `rank+1` identifiers to the processing grid, allowing real-time monitoring of each node's activity within the cluster/CPU.

