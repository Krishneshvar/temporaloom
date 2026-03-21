#ifndef GRAPH_GENERATOR_H
#define GRAPH_GENERATOR_H

#include "graph.h"

Graph* generate_random_graph(int num_nodes, int edges_per_node);
Graph* generate_scale_free_graph(int num_nodes, int m);

#endif
