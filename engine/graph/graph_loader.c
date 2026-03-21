#include "graph_loader.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

Graph* load_graph_from_file(const char *filename) {
    FILE *file = fopen(filename, "r");
    if (!file) {
        perror("Failed to open graph file");
        return NULL;
    }

    char line[1024];
    int num_nodes = 0, num_edges = 0;

    while (fgets(line, sizeof(line), file)) {
        if (line[0] == '#') continue;
        if (sscanf(line, "%d %d", &num_nodes, &num_edges) == 2) {
            break;
        }
    }

    if (num_nodes == 0) {
        printf("Invalid graph file format in %s\n", filename);
        fclose(file);
        return NULL;
    }

    Graph *g = create_graph(num_nodes);
    int src, dest;
    while (fgets(line, sizeof(line), file)) {
        if (line[0] == '#') continue;
        if (sscanf(line, "%d %d", &src, &dest) == 2) {
            add_edge(g, src, dest);
        }
    }

    fclose(file);
    return g;
}
