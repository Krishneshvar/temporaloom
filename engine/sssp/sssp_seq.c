#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "../graph/graph_loader.h"

/*
 * Sequential Single-Source Shortest Path (SSSP) — unweighted BFS with path trace
 * Output (JSON with -j flag):
 * {
 *   "mode": "sssp_seq",
 *   "source": 0, "target": 9,
 *   "distance": 3,
 *   "path": [0, 3, 7, 9],
 *   "all_reachable": 7, "total_nodes": 10,
 *   "execution_time": 0.000012
 * }
 * When -t is omitted, outputs full distance table only (no path).
 */

#define INF -1

int main(int argc, char *argv[]) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <dataset> [-j] [-s <src>] [-t <target>]\n", argv[0]);
        return 1;
    }

    int json_output = 0, source = 0, target = -1;
    for (int i = 2; i < argc; i++) {
        if (!strcmp(argv[i], "-j"))                   json_output = 1;
        if (!strcmp(argv[i], "-s") && i+1<argc)       source = atoi(argv[++i]);
        if (!strcmp(argv[i], "-t") && i+1<argc)       target = atoi(argv[++i]);
    }

    Graph *g = load_graph_from_file(argv[1]);
    if (!g) return 1;

    int n = g->num_nodes;
    int *dist   = malloc(n * sizeof(int));
    int *parent = malloc(n * sizeof(int));
    int *queue  = malloc(n * sizeof(int));

    for (int i = 0; i < n; i++) { dist[i] = INF; parent[i] = -1; }

    dist[source] = 0;
    int head = 0, tail = 0;
    queue[tail++] = source;

    struct timespec ts0, ts1;
    clock_gettime(CLOCK_MONOTONIC, &ts0);

    while (head < tail) {
        int v = queue[head++];
        for (int e = 0; e < g->nodes[v].out_degree; e++) {
            int nb = g->nodes[v].edges[e];
            if (dist[nb] == INF) {
                dist[nb] = dist[v] + 1;
                parent[nb] = v;
                queue[tail++] = nb;
            }
        }
    }

    clock_gettime(CLOCK_MONOTONIC, &ts1);
    double elapsed = (ts1.tv_sec - ts0.tv_sec) + (ts1.tv_nsec - ts0.tv_nsec) / 1e9;

    // Reconstruct path source → target
    int path_len = 0;
    int path_buf[4096];
    int path_valid = 0;
    if (target >= 0 && target < n && dist[target] != INF) {
        path_valid = 1;
        int cur = target;
        while (cur != -1) {
            path_buf[path_len++] = cur;
            cur = parent[cur];
        }
        // Reverse
        for (int i = 0; i < path_len / 2; i++) {
            int tmp = path_buf[i];
            path_buf[i] = path_buf[path_len - 1 - i];
            path_buf[path_len - 1 - i] = tmp;
        }
    }

    int reachable = 0, max_dist = 0;
    for (int i = 0; i < n; i++) {
        if (dist[i] != INF) { reachable++; if (dist[i] > max_dist) max_dist = dist[i]; }
    }

    if (json_output) {
        printf("{\n");
        printf("  \"mode\": \"sssp_seq\",\n");
        printf("  \"source\": %d,\n", source);
        if (target >= 0) printf("  \"target\": %d,\n", target);
        printf("  \"nodes\": %d,\n", n);
        printf("  \"edges\": %d,\n", g->num_edges);
        printf("  \"all_reachable\": %d,\n", reachable);
        printf("  \"max_distance\": %d,\n", max_dist);
        printf("  \"execution_time\": %.6f,\n", elapsed);

        if (target >= 0) {
            if (path_valid) {
                printf("  \"distance\": %d,\n", dist[target]);
                printf("  \"path\": [");
                for (int i = 0; i < path_len; i++) printf("%d%s", path_buf[i], i<path_len-1?",":"");
                printf("],\n");
            } else {
                printf("  \"distance\": -1,\n");
                printf("  \"path\": [],\n");
            }
        }

        // Full distance array (capped at 500)
        int limit = n < 500 ? n : 500;
        printf("  \"distances\": [");
        for (int i = 0; i < limit; i++) printf("%d%s", dist[i], i<limit-1?",":"");
        printf("]\n}\n");
    } else {
        if (target >= 0 && path_valid)
            printf("SSSP: %d→%d distance=%d  time=%.6f\n", source, target, dist[target], elapsed);
        else
            printf("SSSP from %d: reachable=%d max_dist=%d time=%.6f\n", source, reachable, max_dist, elapsed);
    }

    free(dist); free(parent); free(queue);
    free_graph(g);
    return 0;
}
