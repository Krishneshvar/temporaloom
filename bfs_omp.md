# `bfs_omp.c` — OpenMP Parallel Breadth-First Search

Parallel BFS using a level-synchronous frontier strategy with OpenMP. Each level of
the BFS tree is expanded in parallel; threads race to claim unvisited neighbours
using lock-free atomic operations.

---

## Algorithm: Level-Synchronous BFS

BFS is inherently sequential in its level structure — level `k+1` cannot begin until
level `k` is fully explored. This implementation parallelises *within* each level:
all nodes in the current frontier are expanded simultaneously by multiple threads.

```
frontier  = { source }          distance[source] = 0
level = 0

WHILE frontier is not empty:
    PARALLEL: for each node in frontier
        for each unvisited neighbour nb:
            atomically claim nb → add to next_frontier
    swap frontier ↔ next_frontier
    level++
```

---

## Concurrency-Safe Frontier Building

```c
if (__sync_bool_compare_and_swap(&distance[nb], INF, level + 1)) {
    int pos = __sync_fetch_and_add(&next_frontier_size, 1);
    next_frontier[pos] = nb;
}
```

### `__sync_bool_compare_and_swap` (GCC atomic builtin)
Atomically checks that `distance[nb]` is still `INF` and writes `level + 1` only
if it is. Returns `true` for the single thread that wins the race. This guarantees
each node is added to `next_frontier` exactly once — no mutex, no critical section.

### `__sync_fetch_and_add`
Atomically reserves a unique slot index in `next_frontier` and increments the
counter. Threads never overwrite each other's entries because each gets a distinct
`pos`.

---

## Pointer Swap — Zero-Copy Level Transition

```c
int *temp = frontier;
frontier = next_frontier;
next_frontier = temp;
```

Only the pointers are swapped at the end of each level. The old frontier buffer
becomes the write target for the next level. No copying of node arrays is needed.

---

## Load Balancing — `schedule(dynamic, 256)`

High-degree hub nodes in social/web graphs take far longer to expand than low-degree
nodes. Dynamic scheduling with a chunk of 256 nodes prevents one thread from
stalling on a hub while others finish their chunks and sit idle.

---

## Output

Reports the number of reachable nodes from the source and the maximum BFS distance
(the graph's eccentricity from that source). In `-j` mode, outputs JSON consumed
by the Next.js BFS visualisation.

---

## CLI Flags

| Flag       | Effect |
|------------|--------|
| `-j`       | Output JSON |
| `-s <n>`   | Source node (default: 0) |
| `-t <n>`   | Number of threads |

---

## Worker Telemetry

```c
#pragma omp parallel
{
    fprintf(stderr, "[WORKER %d] status processing level %d\n", omp_get_thread_num() + 1, level);
    fflush(stderr);
    // ... parallel frontier search ...
}
```

Every OpenMP hardware thread communicates its current BFS level progress to the UI via `stderr` heartbeats. This allows the lecturer to see the level-synchronous expansion being processed by multiple threads in real-time.

