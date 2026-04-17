#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <math.h>
#include <omp.h>
#include "../graph/graph_loader.h"
#include "../pagerank/pagerank_core.h"

void export_iteration(int iter, int n, double *ranks) {
    char filename[256];
    snprintf(filename, sizeof(filename), "../results/iteration_%d.json", iter);
    FILE *f = fopen(filename, "w");
    if (f) {
        fprintf(f, "{\n  \"iteration\": %d,\n  \"nodes\": [\n", iter);
        for (int i = 0; i < n; i++) {
            fprintf(f, "    {\"id\": %d, \"rank\": %.6f}%s\n", i, ranks[i], (i == n - 1) ? "" : ",");
        }
        fprintf(f, "  ]\n}\n");
        fclose(f);
    }
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        printf("Usage: %s <dataset_file> [-j] [-e] [-t <num_threads>]\n", argv[0]);
        return 1;
    }

    int json_output = 0;
    int export_iter = 0;
    int num_threads = omp_get_max_threads();
    for (int i = 2; i < argc; i++) {
        if (strcmp(argv[i], "-j") == 0) json_output = 1;
        if (strcmp(argv[i], "-e") == 0) export_iter = 1;
        if (strcmp(argv[i], "-t") == 0 && i + 1 < argc) num_threads = atoi(argv[++i]);
    }

    omp_set_num_threads(num_threads);

    Graph *g = load_graph_from_file(argv[1]);
    if (!g) return 1;

    int n = g->num_nodes;
    double *ranks = (double*)malloc(n * sizeof(double));
    double *new_ranks = (double*)malloc(n * sizeof(double));

    PRConfig config = {DAMPING, EPSILON, MAX_ITER};

    #pragma omp parallel for
    for (int i = 0; i < n; i++) {
        ranks[i] = 1.0 / n;
    }

    double start = omp_get_wtime();

    int iter = 0;
    while (iter < config.max_iter) {
        if (export_iter) export_iteration(iter, n, ranks);

        double local_dangling_sum = 0;

        #pragma omp parallel for
        for (int i = 0; i < n; i++) {
            new_ranks[i] = 0.0;
        }

        #pragma omp parallel for reduction(+:local_dangling_sum) schedule(dynamic, 64)
        for (int i = 0; i < n; i++) {
            int out_degree = g->nodes[i].out_degree;
            if (out_degree > 0) {
                double contribution = config.damping * (ranks[i] / out_degree);
                for (int k = 0; k < out_degree; k++) {
                    int dest = g->nodes[i].edges[k];
                    #pragma omp atomic
                    new_ranks[dest] += contribution;
                }
            } else {
                local_dangling_sum += ranks[i];
            }
        }

        double diff = 0.0;
        double base_rank = (1.0 - config.damping) / n;
        double dangling_contribution = config.damping * (local_dangling_sum / n);

        #pragma omp parallel for reduction(+:diff)
        for (int i = 0; i < n; i++) {
            new_ranks[i] += base_rank + dangling_contribution;
            diff += fabs(new_ranks[i] - ranks[i]);
            ranks[i] = new_ranks[i];
        }

        iter++;
        if (has_converged(diff, config)) {
            if (export_iter) export_iteration(iter, n, ranks);
            break;
        }
    }

    double end = omp_get_wtime();
    double exec_time = end - start;

    if (json_output) {
        printf("{\n");
        printf("  \"mode\": \"omp\",\n");
        printf("  \"threads\": %d,\n", num_threads);
        printf("  \"nodes\": %d,\n", n);
        printf("  \"edges\": %d,\n", g->num_edges);
        printf("  \"iterations\": %d,\n", iter);
        printf("  \"execution_time\": %.6f\n", exec_time);
        printf("}\n");
    } else {
        printf("\nOpenMP PageRank converged in %d iterations using %d threads.\n", iter, num_threads);
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
