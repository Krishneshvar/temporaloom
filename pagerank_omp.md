# `pagerank_omp.c` — OpenMP Shared-Memory PageRank

Shared-memory parallelism using OpenMP. All threads run inside a single process and
share the same address space — no explicit message passing is needed.

---

## Thread Count

```c
int num_threads = omp_get_max_threads(); // default: all available hardware threads
omp_set_num_threads(num_threads);        // can be overridden with -t flag
```

The default reads from the `OMP_NUM_THREADS` environment variable or the hardware
maximum reported by the OS. The UI passes the `-t` flag to set an exact count
(capped at the physical core count detected by `/api/system`).

---

## Parallel Initialisation

```c
#pragma omp parallel for
for (int i = 0; i < n; i++) ranks[i] = 1.0 / n;
```

Rank initialisation is embarrassingly parallel — no dependencies between iterations
— so it's parallelised directly.

---

## Contribution Phase

```c
#pragma omp parallel for reduction(+:local_dangling_sum) schedule(dynamic, 64)
for (int i = 0; i < n; i++) {
    ...
    #pragma omp atomic
    new_ranks[dest] += contribution;
    ...
}
```

### `reduction(+:local_dangling_sum)`
Each thread keeps a private copy of the dangling-node accumulator. OpenMP sums all
private copies automatically at the barrier, eliminating the need for a lock on this
variable.

### `schedule(dynamic, 64)`
Rather than splitting the node loop into equal static chunks, dynamic scheduling
assigns blocks of 64 nodes to whichever thread is free next. This handles load
imbalance: high-degree hub nodes (common in scale-free social/web graphs) take much
longer to process than low-degree nodes, so equal-sized chunks would cause threads
to wait on whichever thread got the hubs.

### `#pragma omp atomic`
Multiple threads may compute rank contributions to the same destination node `dest`
at the same time (because multiple source nodes can point to the same target).
The `atomic` directive ensures each `+=` is not torn by concurrent writes. It is
cheaper than a mutex lock and correct because floating-point addition is the only
operation needed.

---

## Update Phase

```c
double base_rank = (1.0 - config.damping) / n;
double dangling_contribution = config.damping * (local_dangling_sum / n);

#pragma omp parallel for reduction(+:diff)
for (int i = 0; i < n; i++) {
    new_ranks[i] += base_rank + dangling_contribution;
    diff += fabs(new_ranks[i] - ranks[i]);
    ranks[i] = new_ranks[i];
}
```

After contributions are accumulated, the teleportation term (`base_rank`) and the
dangling redistribution (`dangling_contribution`) are added uniformly to every node.
The convergence diff is computed in the same pass using another parallel reduction.

---

## Timing

`omp_get_wtime()` measures wall-clock time — the correct metric for parallel
speedup, as opposed to `clock()` which would sum CPU time across all threads.

---

## CLI Flags

| Flag       | Effect |
|------------|--------|
| `-j`       | Output results as JSON |
| `-e`       | Export per-iteration snapshots |
| `-t <n>`   | Use exactly `n` threads |

---

## Worker Telemetry

```c
#pragma omp parallel
{
    fprintf(stderr, "[WORKER %d] status processing iteration %d\n", omp_get_thread_num() + 1, iter);
    fflush(stderr);
    // ... loop ...
}
```

To drive the real-time processing dashboard in the UI, every thread reports its current status to `stderr` at the start of each iteration. The `omp_get_thread_num()` identifier is used to map hardware threads to the "Processing Units" grid in the Next.js visualizer.

