#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "../graph/graph_loader.h"

#define INF -1

/*
 * Sequential Breadth-First Search
 * Output format (JSON with -j flag):
 * {
 *   "mode": "bfs_seq",
 *   "source": 0,
 *   "nodes": <N>,
 *   "edges": <E>,
 *   "reachable": <count>,
 *   "max_distance": <d>,
 *   "execution_time": <s>,
 *   "levels": [
 *     { "distance": 0, "node_ids": [0] },
 *     { "distance": 1, "node_ids": [1, 2] },
 *     ...
 *   ]
 * }
 */

int main(int argc, char *argv[]) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <dataset_file> [-j] [-s <source_node>]\n", argv[0]);
        return 1;
    }

    int json_output = 0;
    int source = 0;

    for (int i = 2; i < argc; i++) {
        if (strcmp(argv[i], "-j") == 0) json_output = 1;
        if (strcmp(argv[i], "-s") == 0 && i + 1 < argc) {
            source = atoi(argv[++i]);
        }
    }

    Graph *g = load_graph_from_file(argv[1]);
    if (!g) return 1;

    int n = g->num_nodes;
    if (source < 0 || source >= n) {
        fprintf(stderr, "Source node %d out of range [0, %d)\n", source, n);
        free_graph(g);
        return 1;
    }

    int *distance = (int*)malloc(n * sizeof(int));
    int *queue    = (int*)malloc(n * sizeof(int));

    for (int i = 0; i < n; i++) distance[i] = INF;

    distance[source] = 0;
    int head = 0, tail = 0;
    queue[tail++] = source;

    struct timespec ts_start, ts_end;
    clock_gettime(CLOCK_MONOTONIC, &ts_start);

    while (head < tail) {
        int curr = queue[head++];
        for (int e = 0; e < g->nodes[curr].out_degree; e++) {
            int nb = g->nodes[curr].edges[e];
            if (distance[nb] == INF) {
                distance[nb] = distance[curr] + 1;
                queue[tail++] = nb;
            }
        }
    }

    clock_gettime(CLOCK_MONOTONIC, &ts_end);
    double exec_time = (ts_end.tv_sec - ts_start.tv_sec) +
                       (ts_end.tv_nsec - ts_start.tv_nsec) / 1e9;

    // Compute stats
    int max_dist = 0, reachable = 0;
    for (int i = 0; i < n; i++) {
        if (distance[i] != INF) {
            reachable++;
            if (distance[i] > max_dist) max_dist = distance[i];
        }
    }

    if (json_output) {
        printf("{\n");
        printf("  \"mode\": \"bfs_seq\",\n");
        printf("  \"source\": %d,\n", source);
        printf("  \"nodes\": %d,\n", n);
        printf("  \"edges\": %d,\n", g->num_edges);
        printf("  \"reachable\": %d,\n", reachable);
        printf("  \"max_distance\": %d,\n", max_dist);
        printf("  \"execution_time\": %.6f,\n", exec_time);

        /* Build levels array */
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

        /* Flat distances array (truncated to first 500 for large graphs) */
        int limit = n < 500 ? n : 500;
        printf("  \"distances\": [");
        for (int i = 0; i < limit; i++) {
            printf("%d%s", distance[i], i == limit - 1 ? "" : ",");
        }
        printf("]\n}\n");
    } else {
        printf("BFS from node %d: reachable=%d, max_distance=%d, time=%.6fs\n",
               source, reachable, max_dist, exec_time);
    }

    free(distance);
    free(queue);
    free_graph(g);
    return 0;
}
