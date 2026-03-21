#include "graph.h"
#include <string.h>

Graph* create_graph(int num_nodes) {
    Graph *g = (Graph*)malloc(sizeof(Graph));
    g->num_nodes = num_nodes;
    g->num_edges = 0;
    g->nodes = (Node*)malloc(num_nodes * sizeof(Node));
    for (int i = 0; i < num_nodes; i++) {
        g->nodes[i].id = i;
        g->nodes[i].out_degree = 0;
        g->nodes[i].edges = NULL;
    }
    return g;
}

void add_edge(Graph *g, int src, int dest) {
    if (src < 0 || src >= g->num_nodes || dest < 0 || dest >= g->num_nodes) {
        return;
    }
    g->nodes[src].out_degree++;
    g->nodes[src].edges = (int*)realloc(g->nodes[src].edges, g->nodes[src].out_degree * sizeof(int));
    g->nodes[src].edges[g->nodes[src].out_degree - 1] = dest;
    g->num_edges++;
}

void free_graph(Graph *g) {
    for (int i = 0; i < g->num_nodes; i++) {
        if (g->nodes[i].edges != NULL) {
            free(g->nodes[i].edges);
        }
    }
    free(g->nodes);
    free(g);
}

void print_graph_info(Graph *g) {
    printf("Graph Nodes: %d\n", g->num_nodes);
    printf("Graph Edges: %d\n", g->num_edges);
}
