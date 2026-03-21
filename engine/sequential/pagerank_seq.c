#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include "../graph/graph_loader.h"
#include "../pagerank/pagerank_core.h"

#include <string.h>

int main(int argc, char *argv[]) {
    if (argc < 2) {
        printf("Usage: %s <dataset_file> [-j]\n", argv[0]);
        return 1;
    }

    int json_output = 0;
    if (argc > 2 && strcmp(argv[2], "-j") == 0) {
        json_output = 1;
    }

    Graph *g = load_graph_from_file(argv[1]);
    if (!g) return 1;

    int n = g->num_nodes;
    double *ranks = (double*)malloc(n * sizeof(double));
    double *new_ranks = (double*)malloc(n * sizeof(double));

    PRConfig config = {DAMPING, EPSILON, MAX_ITER};
    initialize_ranks(ranks, n);

    clock_t start = clock();

    int iter = 0;
    while (iter < config.max_iter) {
        double local_dangling_sum = 0;
        
        // Sequential doesn't need to split, so it processes the whole graph
        compute_local_contributions(g, 0, n, ranks, new_ranks, &local_dangling_sum, config);
        double diff = apply_global_updates(ranks, new_ranks, n, local_dangling_sum, config);

        if (has_converged(diff, config)) break;
        iter++;
    }

    clock_t end = clock();
    double exec_time = (double)(end - start) / CLOCKS_PER_SEC;

    if (json_output) {
        printf("{\n");
        printf("  \"mode\": \"sequential\",\n");
        printf("  \"nodes\": %d,\n", n);
        printf("  \"edges\": %d,\n", g->num_edges);
        printf("  \"iterations\": %d,\n", iter);
        printf("  \"execution_time\": %.6f\n", exec_time);
        printf("}\n");
    } else {
        printf("\nSequential PageRank converged in %d iterations.\n", iter);
        printf("Final PageRank Sample:\n");
        for (int i = 0; i < (n < 10 ? n : 10); i++) {
            printf("Node %d: %.6f\n", i, ranks[i]);
        }
        printf("Execution time: %f seconds\n", exec_time);
    }

    free(ranks);
    free(new_ranks);
    free_graph(g);

    return 0;
}
