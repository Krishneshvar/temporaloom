#include "graph_generator.h"
#include <stdlib.h>
#include <time.h>

Graph* generate_random_graph(int num_nodes, int edges_per_node) {
    Graph *g = create_graph(num_nodes);
    srand(time(NULL));

    for (int i = 0; i < num_nodes; i++) {
        for (int j = 0; j < edges_per_node; j++) {
            int dest = rand() % num_nodes;
            if (i != dest) {
                add_edge(g, i, dest);
            }
        }
    }

    return g;
}

Graph* generate_scale_free_graph(int num_nodes, int m) {
    if (m >= num_nodes) m = num_nodes - 1;
    Graph *g = create_graph(num_nodes);
    srand(time(NULL));

    // Initial clique or at least nodes connecting to each other
    for (int i = 0; i < m + 1; i++) {
        for (int j = 0; j < m + 1; j++) {
            if (i != j) add_edge(g, i, j);
        }
    }

    // Preferential attachment for remaining nodes
    for (int i = m + 1; i < num_nodes; i++) {
        int successful_edges = 0;
        while (successful_edges < m) {
            // Find a target based on total degrees
            // total degrees = 2 * g->num_edges
            int total_deg = 0;
            for (int k = 0; k < i; k++) total_deg += g->nodes[k].out_degree; // approximate

            int r = rand() % (total_deg + 1);
            int current_deg_sum = 0;
            int target = -1;
            for (int k = 0; k < i; k++) {
                current_deg_sum += g->nodes[k].out_degree;
                if (current_deg_sum >= r) {
                    target = k;
                    break;
                }
            }
            if (target != -1) {
                add_edge(g, i, target);
                successful_edges++;
            }
        }
    }

    return g;
}
