#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <mpi.h>
#include "../graph/graph_loader.h"

#define INF -1

/*
 * Parallel BFS using MPI (level-synchronous frontier expansion)
 *
 * Strategy:
 *   - Every process holds the full graph (simple model, matches PageRank MPI approach)
 *   - Each process owns a contiguous partition of nodes [start, end)
 *   - Each iteration: local frontier expansion -> MPI_Allreduce to merge discovered nodes
 *   - Output (rank 0 only) is identical JSON schema to bfs_seq for UI compatibility
 */

int main(int argc, char *argv[]) {
    MPI_Init(&argc, &argv);

    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    if (argc < 2) {
        if (rank == 0) fprintf(stderr, "Usage: mpirun -np <P> %s <dataset> [-j] [-s <src>]\n", argv[0]);
        MPI_Finalize();
        return 1;
    }

    int json_output = 0;
    int source = 0;

    for (int i = 2; i < argc; i++) {
        if (strcmp(argv[i], "-j") == 0) json_output = 1;
        if (strcmp(argv[i], "-s") == 0 && i + 1 < argc) source = atoi(argv[++i]);
    }

    Graph *g = load_graph_from_file(argv[1]);
    if (!g) { MPI_Finalize(); return 1; }

    int n = g->num_nodes;
    if (source < 0 || source >= n) {
        if (rank == 0) fprintf(stderr, "Source %d out of range [0, %d)\n", source, n);
        free_graph(g);
        MPI_Finalize();
        return 1;
    }

    /* Partition */
    int nodes_per_proc = n / size;
    int start_node = rank * nodes_per_proc;
    int end_node   = (rank == size - 1) ? n : start_node + nodes_per_proc;

    int *distance      = (int*)malloc(n * sizeof(int));
    int *local_visited = (int*)malloc(n * sizeof(int)); /* 1 if newly discovered this iter */
    int *global_new    = (int*)malloc(n * sizeof(int));

    for (int i = 0; i < n; i++) distance[i] = INF;
    distance[source] = 0;

    double start_time = MPI_Wtime();

    int current_level = 0;
    int any_new = 1;

    while (any_new) {
        memset(local_visited, 0, n * sizeof(int));

        /* Each process expands its partition of nodes at current_level */
        for (int v = start_node; v < end_node; v++) {
            if (distance[v] != current_level) continue;
            for (int e = 0; e < g->nodes[v].out_degree; e++) {
                int nb = g->nodes[v].edges[e];
                if (distance[nb] == INF) {
                    local_visited[nb] = 1; /* mark as "newly found" */
                }
            }
        }

        /* Merge discoveries across all processes */
        MPI_Allreduce(local_visited, global_new, n, MPI_INT, MPI_MAX, MPI_COMM_WORLD);

        any_new = 0;
        for (int i = 0; i < n; i++) {
            if (global_new[i] && distance[i] == INF) {
                distance[i] = current_level + 1;
                any_new = 1;
            }
        }

        current_level++;
    }

    double end_time = MPI_Wtime();

    if (rank == 0) {
        int max_dist = 0, reachable = 0;
        for (int i = 0; i < n; i++) {
            if (distance[i] != INF) {
                reachable++;
                if (distance[i] > max_dist) max_dist = distance[i];
            }
        }

        if (json_output) {
            printf("{\n");
            printf("  \"mode\": \"bfs_mpi\",\n");
            printf("  \"processes\": %d,\n", size);
            printf("  \"source\": %d,\n", source);
            printf("  \"nodes\": %d,\n", n);
            printf("  \"edges\": %d,\n", g->num_edges);
            printf("  \"reachable\": %d,\n", reachable);
            printf("  \"max_distance\": %d,\n", max_dist);
            printf("  \"execution_time\": %.6f,\n", end_time - start_time);

            printf("  \"levels\": [\n");
            for (int d = 0; d <= max_dist; d++) {
                printf("    {\"distance\": %d, \"node_ids\": [", d);
                int first = 1;
                for (int i = 0; i < n; i++) {
                    if (distance[i] == d) {
                        if (!first) printf(", ");
                        printf("%d", i);
                        first = 0;
                    }
                }
                printf("]}%s\n", d == max_dist ? "" : ",");
            }
            printf("  ],\n");

            int limit = n < 500 ? n : 500;
            printf("  \"distances\": [");
            for (int i = 0; i < limit; i++) {
                printf("%d%s", distance[i], i == limit - 1 ? "" : ",");
            }
            printf("]\n}\n");
        } else {
            printf("MPI BFS from node %d: reachable=%d, max_distance=%d, procs=%d, time=%.6fs\n",
                   source, reachable, max_dist, size, end_time - start_time);
        }
    }

    free(distance);
    free(local_visited);
    free(global_new);
    free_graph(g);
    MPI_Finalize();
    return 0;
}
