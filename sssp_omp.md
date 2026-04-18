# `sssp_omp.c` — OpenMP Parallel Single-Source Shortest Path

Parallel SSSP on an **unweighted** directed graph using OpenMP, extended from the
BFS algorithm to also reconstruct the shortest path between a source and target node.

---

## Relationship to BFS

On an unweighted graph, the shortest path distance between two nodes equals the
minimum hop count — which is exactly what BFS computes. This file is a direct
extension of `bfs_omp.c` with one addition: a `parent[]` array that records how
each node was reached, enabling path reconstruction after the traversal.

The core parallel frontier expansion loop is identical to `bfs_omp.c`. Refer to
`bfs_omp.md` for explanation of:
- Level-synchronous BFS structure
- `__sync_bool_compare_and_swap` for atomic frontier claiming
- `__sync_fetch_and_add` for lock-free slot reservation
- Pointer swap for zero-copy level transition
- `schedule(dynamic, 256)` for load balancing

---

## Parent Array

```c
int *parent = malloc(n * sizeof(int));
// initialised to -1 (no parent)
```

Inside the frontier expansion:
```c
if (__sync_bool_compare_and_swap(&dist[nb], INF, level + 1)) {
    parent[nb] = v;   // record which node we arrived from
    ...
}
```

The `parent[nb] = v` write happens immediately after the CAS succeeds, so only one
thread sets it per node. If two threads race to claim the same `nb`, only one wins
the CAS and enters this block — making `parent[nb]` effectively race-free.

> **Note:** In practice, two threads could race to write `parent[nb]` *and both win*
> in an unlikely window if the compiler reorders the assignment after the CAS. In
> that edge case, both writers would store a valid parent from the same BFS level, so
> the reconstructed path remains a valid shortest path — just not necessarily the
> same one across runs.

---

## Path Reconstruction

```c
if (target >= 0 && target < n && dist[target] != INF) {
    int cur = target;
    while (cur != -1 && path_len < 4096) {
        path_buf[path_len++] = cur;
        cur = parent[cur];
    }
    // reverse in-place for source→target order
    for (int i = 0; i < path_len / 2; i++) { swap(path_buf[i], path_buf[path_len-1-i]); }
}
```

Walks backward from `target` through `parent[]` until reaching the source (whose
parent is `-1`). The resulting array is reversed to give the path in
source → target order. The buffer is capped at 4096 nodes to prevent runaway on
extremely deep paths.

---

## Output Modes

- **With `-t <target>`:** Prints the specific source → target distance and path.
- **Without `-t`:** Prints global reachability statistics (number of reachable
  nodes, maximum distance from source) — identical to BFS output behaviour.

---

## CLI Flags

| Flag       | Effect |
|------------|--------|
| `-j`       | Output JSON |
| `-s <n>`   | Source node (default: 0) |
| `-t <n>`   | Target node for path reconstruction (optional) |
| `-p <n>`   | Number of threads |

---

## Worker Telemetry

```c
#pragma omp parallel
{
    fprintf(stderr, "[WORKER %d] status SSSP processing iteration %d\n", omp_get_thread_num() + 1, level);
    fflush(stderr);
    // ... loop ...
}
```

Like the BFS implementation, SSSP emits real-time telemetry from every thread. This feeds the "Active Processing Units" dashboard in the UI, enabling live monitoring of how the shortest-path frontier is being distributed across the CPU hardware.

