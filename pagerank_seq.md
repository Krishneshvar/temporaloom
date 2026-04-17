# `pagerank_seq.c` — Sequential PageRank

Single-threaded, single-process implementation. No parallelism. The baseline used
for all speedup comparisons.

---

## Algorithm Parameters

| Constant   | Value  | Meaning |
|------------|--------|---------|
| `DAMPING`  | 0.85   | Probability a random surfer follows a link vs. teleporting to a random page. Prevents rank from pooling in sink nodes. |
| `EPSILON`  | 1e-6   | Convergence threshold — stop when the total absolute change across all ranks in one iteration drops below this. |
| `MAX_ITER` | 100    | Hard safety cap. Most real-world graphs converge in 20–50 iterations before hitting this limit. |

PageRank formula applied each iteration:

```
PR(u) = (1 - d) / N  +  d * Σ  PR(v) / OutDegree(v)
                              v→u
```

---

## `export_iteration()`

Writes the full rank vector at a given iteration number to
`../results/iteration_N.json`. This is consumed by the Next.js frontend's iteration
playback slider — the UI reads these files via `/api/iterations/:id` and re-colours
the graph nodes as you scrub through iterations.

---

## CLI Flags

| Flag | Effect |
|------|--------|
| `-j` | Output results as JSON (parsed by the Next.js API layer) |
| `-e` | Export per-iteration snapshots for UI playback |

---

## Main Loop

1. Loads the full graph with `load_graph_from_file()`.
2. Allocates two rank arrays: `ranks` (current) and `new_ranks` (next iteration).
3. Initialises all ranks to `1/N` via `initialize_ranks()`.
4. Timing uses `clock()` / `CLOCKS_PER_SEC` (CPU time).
5. Each iteration:
   - Optionally exports the current rank snapshot.
   - Calls `compute_local_contributions(g, 0, n, ...)` — passes the full range
     `[0, n)` because sequential processes the whole graph itself. The same
     function is reused by the MPI version with a sub-range.
   - Calls `apply_global_updates()` which adds the teleportation and dangling terms
     and swaps rank arrays, returning the total absolute diff.
   - Checks `has_converged(diff, config)` — breaks early if true.
