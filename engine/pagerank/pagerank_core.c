#include "pagerank_core.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

void initialize_ranks(double *ranks, int n) {
    for (int i = 0; i < n; i++) {
        ranks[i] = 1.0 / n;
    }
}

void compute_local_contributions(Graph *g, int start_node, int end_node, double *ranks, double *new_ranks, double *local_dangling_sum, PRConfig config) {
    int n = g->num_nodes;
    double damping = config.damping;
    
    // reset new_ranks locally
    for (int i = 0; i < n; i++) {
        new_ranks[i] = 0;
    }
    *local_dangling_sum = 0;

    for (int i = start_node; i < end_node; i++) {
        int out_degree = g->nodes[i].out_degree;
        if (out_degree > 0) {
            double contribution = damping * (ranks[i] / out_degree);
            for (int k = 0; k < out_degree; k++) {
                int dest = g->nodes[i].edges[k];
                new_ranks[dest] += contribution;
            }
        } else {
            *local_dangling_sum += ranks[i];
        }
    }
}

double apply_global_updates(double *ranks, double *new_ranks, int n, double total_dangling_sum, PRConfig config) {
    double damping = config.damping;
    double base_rank = (1.0 - damping) / n;
    double dangling_contribution = damping * (total_dangling_sum / n);
    double total_diff = 0;

    for (int i = 0; i < n; i++) {
        new_ranks[i] += base_rank + dangling_contribution;
        total_diff += fabs(new_ranks[i] - ranks[i]);
        ranks[i] = new_ranks[i];
    }
    return total_diff;
}

int has_converged(double diff, PRConfig config) {
    return diff < config.epsilon;
}
