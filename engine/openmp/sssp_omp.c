#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <omp.h>
#include "../graph/graph_loader.h"

#define INF -1

int main(int argc, char *argv[]) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <dataset> [-j] [-s <src>] [-t <target>] [-p <threads>]\n", argv[0]);
        return 1;
    }

    int json_output = 0, source = 0, target = -1;
    int num_threads = omp_get_max_threads();
    
    for (int i = 2; i < argc; i++) {
        if (!strcmp(argv[i], "-j"))                   json_output = 1;
        if (!strcmp(argv[i], "-s") && i+1<argc)       source = atoi(argv[++i]);
        if (!strcmp(argv[i], "-t") && i+1<argc)       target = atoi(argv[++i]);
        if (!strcmp(argv[i], "-p") && i+1<argc)       num_threads = atoi(argv[++i]);
    }
    omp_set_num_threads(num_threads);

    Graph *g = load_graph_from_file(argv[1]);
    if (!g) return 1;

    int n = g->num_nodes;
    int *dist   = malloc(n * sizeof(int));
    int *parent = malloc(n * sizeof(int));
    int *frontier = malloc(n * sizeof(int));
    int *next_frontier = malloc(n * sizeof(int));

    #pragma omp parallel for
    for (int i = 0; i < n; i++) { dist[i] = INF; parent[i] = -1; }

    dist[source] = 0;
    frontier[0] = source;
    int frontier_size = 1;

    double start_time = omp_get_wtime();

    int level = 0;
    while (frontier_size > 0) {
        int next_frontier_size = 0;

        #pragma omp parallel for schedule(dynamic, 256)
        for (int i = 0; i < frontier_size; i++) {
            int v = frontier[i];
            for (int e = 0; e < g->nodes[v].out_degree; e++) {
                int nb = g->nodes[v].edges[e];
                if (__sync_bool_compare_and_swap(&dist[nb], INF, level + 1)) {
                    parent[nb] = v; // race condition on parent doesn't break path, just might give different valid path
                    int pos = __sync_fetch_and_add(&next_frontier_size, 1);
                    next_frontier[pos] = nb;
                }
            }
        }
        
        frontier_size = next_frontier_size;
        int *temp = frontier;
        frontier = next_frontier;
        next_frontier = temp;
        
        level++;
    }

    double elapsed = omp_get_wtime() - start_time;

    int path_len = 0;
    int path_buf[4096];
    int path_valid = 0;
    if (target >= 0 && target < n && dist[target] != INF) {
        path_valid = 1;
        int cur = target;
        while (cur != -1 && path_len < 4096) {
            path_buf[path_len++] = cur;
            cur = parent[cur];
        }
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
        printf("  \"mode\": \"sssp_omp\",\n");
        printf("  \"threads\": %d,\n", num_threads);
        printf("  \"source\": %d,\n", source);
        if (target >= 0) printf("  \"target\": %d,\n", target);
        printf("  \"all_reachable\": %d,\n", reachable);
        printf("  \"max_distance\": %d,\n", max_dist);
        printf("  \"execution_time\": %.6f\n", elapsed);
        printf("}\n");
    } else {
        if (target >= 0 && path_valid)
            printf("OpenMP SSSP: %d→%d distance=%d time=%.6fs threads=%d\n", source, target, dist[target], elapsed, num_threads);
        else
            printf("OpenMP SSSP from %d: reachable=%d max_dist=%d time=%.6fs threads=%d\n", source, reachable, max_dist, elapsed, num_threads);
    }

    free(dist); free(parent); free(frontier); free(next_frontier);
    free_graph(g);
    return 0;
}
