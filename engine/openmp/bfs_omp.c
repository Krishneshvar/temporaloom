#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <omp.h>
#include "../graph/graph_loader.h"

#define INF -1

int main(int argc, char *argv[]) {
    if (argc < 2) {
        fprintf(stderr, "Usage: %s <dataset_file> [-j] [-s <source_node>] [-t <num_threads>]\n", argv[0]);
        return 1;
    }

    int json_output = 0;
    int source = 0;
    int num_threads = omp_get_max_threads();

    for (int i = 2; i < argc; i++) {
        if (strcmp(argv[i], "-j") == 0) json_output = 1;
        if (strcmp(argv[i], "-s") == 0 && i + 1 < argc) source = atoi(argv[++i]);
        if (strcmp(argv[i], "-t") == 0 && i + 1 < argc) num_threads = atoi(argv[++i]);
    }

    omp_set_num_threads(num_threads);

    Graph *g = load_graph_from_file(argv[1]);
    if (!g) return 1;

    int n = g->num_nodes;
    if (source < 0 || source >= n) {
        fprintf(stderr, "Source node %d out of range [0, %d)\n", source, n);
        free_graph(g);
        return 1;
    }

    int *distance = (int*)malloc(n * sizeof(int));
    int *frontier = (int*)malloc(n * sizeof(int));
    int *next_frontier = (int*)malloc(n * sizeof(int));

    #pragma omp parallel for
    for (int i = 0; i < n; i++) distance[i] = INF;

    distance[source] = 0;
    frontier[0] = source;
    int frontier_size = 1;

    double start_time = omp_get_wtime();

    int level = 0;
    while (frontier_size > 0) {
        int next_frontier_size = 0;

        #pragma omp parallel
        {
            fprintf(stderr, "[WORKER %d] status processing level %d\n", omp_get_thread_num() + 1, level);
            fflush(stderr);

            #pragma omp for schedule(dynamic, 256)
            for (int i = 0; i < frontier_size; i++) {
                int curr = frontier[i];
                for (int e = 0; e < g->nodes[curr].out_degree; e++) {
                    int nb = g->nodes[curr].edges[e];
                    if (__sync_bool_compare_and_swap(&distance[nb], INF, level + 1)) {
                        int pos = __sync_fetch_and_add(&next_frontier_size, 1);
                        next_frontier[pos] = nb;
                    }
                }
            }
        }

        frontier_size = next_frontier_size;
        int *temp = frontier;
        frontier = next_frontier;
        next_frontier = temp;

        level++;
    }

    double exec_time = omp_get_wtime() - start_time;

    int max_dist = 0, reachable = 0;
    for (int i = 0; i < n; i++) {
        if (distance[i] != INF) {
            reachable++;
            if (distance[i] > max_dist) max_dist = distance[i];
        }
    }

    if (json_output) {
        printf("{\n");
        printf("  \"mode\": \"bfs_omp\",\n");
        printf("  \"threads\": %d,\n", num_threads);
        printf("  \"source\": %d,\n", source);
        printf("  \"reachable\": %d,\n", reachable);
        printf("  \"max_distance\": %d,\n", max_dist);
        printf("  \"execution_time\": %.6f\n", exec_time);
        printf("}\n");
    } else {
        printf("OpenMP BFS from node %d: reachable=%d, max_distance=%d, time=%.6fs using %d threads\n",
               source, reachable, max_dist, exec_time, num_threads);
    }

    free(distance);
    free(frontier);
    free(next_frontier);
    free_graph(g);
    return 0;
}
