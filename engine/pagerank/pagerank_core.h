#ifndef PAGERANK_CORE_H
#define PAGERANK_CORE_H

#include "../graph/graph.h"

#define DAMPING 0.85
#define EPSILON 1e-7
#define MAX_ITER 1000

typedef struct {
    double damping;
    double epsilon;
    int max_iter;
} PRConfig;

void initialize_ranks(double *ranks, int n);
void compute_local_contributions(Graph *g, int start_node, int end_node, double *ranks, double *new_ranks, double *local_dangling_sum, PRConfig config);
double apply_global_updates(double *ranks, double *new_ranks, int n, double total_dangling_sum, PRConfig config);
int has_converged(double diff, PRConfig config);

#endif
