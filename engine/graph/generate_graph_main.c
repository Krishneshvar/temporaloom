#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "graph_generator.h"

int main(int argc, char *argv[]) {
    if (argc < 4) {
        printf("Usage: %s <mode: random|scalefree> <num_nodes> <m>\n", argv[0]);
        return 1;
    }

    const char *mode = argv[1];
    int n = atoi(argv[2]);
    int m = atoi(argv[3]);

    Graph *g = NULL;
    if (strcmp(mode, "random") == 0) {
        g = generate_random_graph(n, m);
    } else if (strcmp(mode, "scalefree") == 0) {
        g = generate_scale_free_graph(n, m);
    } else {
        printf("Unknown mode: %s\n", mode);
        return 1;
    }
    if (!g) return 1;

    printf("# nodes edges\n");
    printf("%d %d\n", g->num_nodes, g->num_edges);
    for (int i = 0; i < g->num_nodes; i++) {
        for (int k = 0; k < g->nodes[i].out_degree; k++) {
            printf("%d %d\n", i, g->nodes[i].edges[k]);
        }
    }

    free_graph(g);
    return 0;
}
