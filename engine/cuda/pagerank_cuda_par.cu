#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <time.h>
#include <string.h>

extern "C" {
    #include "../graph/graph.h"
    #include "../graph/graph_loader.h"
    #include "../pagerank/pagerank_core.h"
}

// Atomic add for double precision (older architecture support)
#if !defined(__CUDA_ARCH__) || __CUDA_ARCH__ >= 600
#else
__device__ double atomicAdd(double* address, double val)
{
    unsigned long long int* address_as_ull =
                              (unsigned long long int*)address;
    unsigned long long int old = *address_as_ull, assumed;
    do {
        assumed = old;
        old = atomicCAS(address_as_ull, assumed,
                        __double_as_longlong(val +
                               __longlong_as_double(assumed)));
    } while (assumed != old);
    return __longlong_as_double(old);
}
#endif

// Kernel 1: Distribute PR contributions
__global__ void distribute_pr_kernel(
    int num_nodes,
    int* row_ptr,
    int* col_adj,
    double* ranks,
    double* new_ranks,
    double* dangling_sum,
    double damping
) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    
    if (i < num_nodes) {
        new_ranks[i] = 0.0;
        
        int out_degree = row_ptr[i+1] - row_ptr[i];
        if (out_degree == 0) {
            atomicAdd(dangling_sum, ranks[i]);
        } else {
            double contribution = damping * (ranks[i] / out_degree);
            int start = row_ptr[i];
            int end = row_ptr[i+1];
            for (int e = start; e < end; e++) {
                int dest = col_adj[e];
                atomicAdd(&new_ranks[dest], contribution);
            }
        }
    }
}

// Kernel 2: Apply global updates
__global__ void update_pr_kernel(
    int num_nodes,
    double* ranks,
    double* new_ranks,
    double* dangling_sum,
    double damping,
    double* diff_sum
) {
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    
    if (i < num_nodes) {
        double base_rank = (1.0 - damping) / num_nodes;
        double dangling_contribution = damping * (*dangling_sum / num_nodes);
        
        double final_new_rank = new_ranks[i] + base_rank + dangling_contribution;
        
        double diff = fabs(final_new_rank - ranks[i]);
        atomicAdd(diff_sum, diff);
        
        ranks[i] = final_new_rank;
    }
}

int main(int argc, char *argv[]) {
    if (argc < 2) {
        printf("Usage: %s <dataset_file> [-j]\n", argv[0]);
        return 1;
    }

    int json_output = 0;
    int export_iter = 0;
    for (int i = 2; i < argc; i++) {
        if (strcmp(argv[i], "-j") == 0) json_output = 1;
        if (strcmp(argv[i], "-e") == 0) export_iter = 1;
    }

    Graph *g = load_graph_from_file(argv[1]);
    if (!g) return 1;

    int n = g->num_nodes;
    int edges = g->num_edges;

    int* h_row_ptr = (int*)malloc((n + 1) * sizeof(int));
    int* h_col_adj = (int*)malloc(edges * sizeof(int));
    
    int edge_idx = 0;
    for (int i = 0; i < n; i++) {
        h_row_ptr[i] = edge_idx;
        for (int j = 0; j < g->nodes[i].out_degree; j++) {
            h_col_adj[edge_idx++] = g->nodes[i].edges[j];
        }
    }
    h_row_ptr[n] = edge_idx;

    double *h_ranks = (double*)malloc(n * sizeof(double));
    for (int i = 0; i < n; i++) h_ranks[i] = 1.0 / n;

    int *d_row_ptr, *d_col_adj;
    double *d_ranks, *d_new_ranks, *d_dangling_sum, *d_diff_sum;
    
    cudaMalloc(&d_row_ptr, (n + 1) * sizeof(int));
    cudaMalloc(&d_col_adj, edges * sizeof(int));
    cudaMalloc(&d_ranks, n * sizeof(double));
    cudaMalloc(&d_new_ranks, n * sizeof(double));
    cudaMalloc(&d_dangling_sum, sizeof(double));
    cudaMalloc(&d_diff_sum, sizeof(double));

    cudaMemcpy(d_row_ptr, h_row_ptr, (n + 1) * sizeof(int), cudaMemcpyHostToDevice);
    cudaMemcpy(d_col_adj, h_col_adj, edges * sizeof(int), cudaMemcpyHostToDevice);
    cudaMemcpy(d_ranks, h_ranks, n * sizeof(double), cudaMemcpyHostToDevice);

    double damping = 0.85;
    double epsilon = 1e-6;
    int max_iter = 100;
    int iter = 0;

    clock_t start = clock();

    int blockSize = 256;
    int gridSize = (n + blockSize - 1) / blockSize;

    while (iter < max_iter) {
        
        double h_zero = 0.0;
        cudaMemcpy(d_dangling_sum, &h_zero, sizeof(double), cudaMemcpyHostToDevice);
        cudaMemcpy(d_diff_sum, &h_zero, sizeof(double), cudaMemcpyHostToDevice);

        // Distribute
        distribute_pr_kernel<<<gridSize, blockSize>>>(n, d_row_ptr, d_col_adj, d_ranks, d_new_ranks, d_dangling_sum, damping);
        cudaDeviceSynchronize();

        // Update
        update_pr_kernel<<<gridSize, blockSize>>>(n, d_ranks, d_new_ranks, d_dangling_sum, damping, d_diff_sum);
        cudaDeviceSynchronize();

        double diff = 0.0;
        cudaMemcpy(&diff, d_diff_sum, sizeof(double), cudaMemcpyDeviceToHost);

        if (export_iter) {
            cudaMemcpy(h_ranks, d_ranks, n * sizeof(double), cudaMemcpyDeviceToHost);
            char filename[256];
            snprintf(filename, sizeof(filename), "../results/iteration_%d.json", iter);
            FILE *f = fopen(filename, "w");
            if (f) {
                fprintf(f, "{\n  \"iteration\": %d,\n  \"nodes\": [\n", iter);
                for (int i = 0; i < n; i++) {
                    fprintf(f, "    {\"id\": %d, \"rank\": %.6f}%s\n", i, h_ranks[i], (i == n - 1) ? "" : ",");
                }
                fprintf(f, "  ]\n}\n");
                fclose(f);
            }
        }

        if (diff < epsilon) break;
        iter++;
    }

    clock_t end = clock();
    double exec_time = (double)(end - start) / CLOCKS_PER_SEC;

    if (json_output) {
        printf("{\n");
        printf("  \"mode\": \"gpu_parallel\",\n");
        printf("  \"nodes\": %d,\n", n);
        printf("  \"edges\": %d,\n", edges);
        printf("  \"iterations\": %d,\n", iter);
        printf("  \"execution_time\": %.6f\n", exec_time);
        printf("}\n");
    } else {
        printf("\nGPU Parallel PageRank converged in %d iterations.\n", iter);
    }

    cudaFree(d_row_ptr);
    cudaFree(d_col_adj);
    cudaFree(d_ranks);
    cudaFree(d_new_ranks);
    cudaFree(d_dangling_sum);
    cudaFree(d_diff_sum);
    free(h_row_ptr);
    free(h_col_adj);
    free(h_ranks);
    free_graph(g);

    return 0;
}
