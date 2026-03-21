#ifndef GRAPH_H
#define GRAPH_H

#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int target;
} Edge;

typedef struct {
    int id;
    int out_degree;
    int *edges; // Array of target node IDs
} Node;

typedef struct {
    int num_nodes;
    int num_edges;
    Node *nodes;
} Graph;

Graph* create_graph(int num_nodes);
void add_edge(Graph *g, int src, int dest);
void free_graph(Graph *g);
void print_graph_info(Graph *g);

#endif
