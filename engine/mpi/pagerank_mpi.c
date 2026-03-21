#include <stdio.h>
#include <stdlib.h>
#include <mpi.h>
#include "../graph/graph_loader.h"
#include "../pagerank/pagerank_core.h"

#include <string.h>

int main(int argc, char *argv[]) {
    MPI_Init(&argc, &argv);

    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);

    if (argc < 2) {
        if (rank == 0) printf("Usage: mpirun -np <num_proc> %s <dataset_file> [-j]\n", argv[0]);
        MPI_Finalize();
        return 1;
    }

    int json_output = 0;
    int export_iter = 0;
    for (int i = 2; i < argc; i++) {
        if (strcmp(argv[i], "-j") == 0) json_output = 1;
        if (strcmp(argv[i], "-e") == 0) export_iter = 1;
    }

    // Every process loads the whole graph for now (simple partitioning)
    Graph *g = load_graph_from_file(argv[1]);
    if (!g) {
        MPI_Finalize();
        return 1;
    }

    int n = g->num_nodes;
    double *ranks = (double*)malloc(n * sizeof(double));
    double *new_ranks = (double*)malloc(n * sizeof(double));
    double *temp_new_ranks = (double*)malloc(n * sizeof(double));

    PRConfig config = {DAMPING, EPSILON, MAX_ITER};
    initialize_ranks(ranks, n);

    // Simple uniform partitioning of nodes
    int nodes_per_proc = n / size;
    int start_node = rank * nodes_per_proc;
    int end_node = (rank == size - 1) ? n : start_node + nodes_per_proc;

    double start_time = MPI_Wtime();

    int iter = 0;
    while (iter < config.max_iter) {
        double local_dangling_sum = 0;
        double total_dangling_sum = 0;

        // Reset local copy of new ranks
        for (int i = 0; i < n; i++) temp_new_ranks[i] = 0;

        compute_local_contributions(g, start_node, end_node, ranks, temp_new_ranks, &local_dangling_sum, config);

        // Sum up local dangling contributions
        MPI_Allreduce(&local_dangling_sum, &total_dangling_sum, 1, MPI_DOUBLE, MPI_SUM, MPI_COMM_WORLD);

        // Sum up partial new ranks into a global copy
        MPI_Allreduce(temp_new_ranks, new_ranks, n, MPI_DOUBLE, MPI_SUM, MPI_COMM_WORLD);

        // Update local PR vector using the global knowledge (every process now has the same info)
        double diff = apply_global_updates(ranks, new_ranks, n, total_dangling_sum, config);

        if (export_iter && rank == 0) {
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

        // Convergence detection globally
        if (has_converged(diff, config)) break;
        iter++;
    }

    double end_time = MPI_Wtime();

    if (rank == 0) {
        if (json_output) {
            printf("{\n");
            printf("  \"mode\": \"mpi\",\n");
            printf("  \"processes\": %d,\n", size);
            printf("  \"nodes\": %d,\n", n);
            printf("  \"edges\": %d,\n", g->num_edges);
            printf("  \"iterations\": %d,\n", iter);
            printf("  \"execution_time\": %.6f\n", end_time - start_time);
            printf("}\n");
        } else {
            printf("\nMPI PageRank converged in %d iterations using %d processes.\n", iter, size);
            printf("Final PageRank Sample:\n");
            for (int i = 0; i < (n < 10 ? n : 10); i++) {
                printf("Node %d: %.6f\n", i, ranks[i]);
            }
            printf("Execution time: %f seconds\n", end_time - start_time);
        }
    }

    free(ranks);
    free(new_ranks);
    free(temp_new_ranks);
    free_graph(g);

    MPI_Finalize();
    return 0;
}
