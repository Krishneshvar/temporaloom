CC = gcc
MPICC = mpicc
NVCC = nvcc
CFLAGS = -Wall -O3
OMPFLAGS = -Wall -O3 -fopenmp
NVCCFLAGS = -O3 -arch=sm_86
LIBS = -lm

GRAPH_SRC = graph/graph.c graph/graph_loader.c graph/graph_generator.c
CORE_SRC = pagerank/pagerank_core.c
SEQ_SRC = sequential/pagerank_seq.c
MPI_SRC = mpi/pagerank_mpi.c
BFS_SEQ_SRC = bfs/bfs_seq.c
BFS_MPI_SRC = bfs/bfs_mpi.c
SSP_SEQ_SRC = sssp/sssp_seq.c

OMP_PR_SRC = openmp/pagerank_omp.c
OMP_BFS_SRC = openmp/bfs_omp.c
OMP_SSSP_SRC = openmp/sssp_omp.c

.PHONY: all clean seq mpi generator cuda bfs sssp omp

all: seq mpi generator cuda bfs sssp omp

cuda: cuda_seq cuda_par

cuda_seq: $(GRAPH_SRC) $(CORE_SRC) cuda/pagerank_cuda_seq.cu
	$(NVCC) $(NVCCFLAGS) -o pagerank_cuda_seq $(GRAPH_SRC) $(CORE_SRC) cuda/pagerank_cuda_seq.cu $(LIBS)

cuda_par: $(GRAPH_SRC) $(CORE_SRC) cuda/pagerank_cuda_par.cu
	$(NVCC) $(NVCCFLAGS) -o pagerank_cuda_par $(GRAPH_SRC) $(CORE_SRC) cuda/pagerank_cuda_par.cu $(LIBS)

seq: $(GRAPH_SRC) $(CORE_SRC) $(SEQ_SRC)
	$(CC) $(CFLAGS) -o pagerank_seq $(GRAPH_SRC) $(CORE_SRC) $(SEQ_SRC) $(LIBS)

mpi: $(GRAPH_SRC) $(CORE_SRC) $(MPI_SRC)
	$(MPICC) $(CFLAGS) -o pagerank_mpi $(GRAPH_SRC) $(CORE_SRC) $(MPI_SRC) $(LIBS)

generator: $(GRAPH_SRC) graph/generate_graph_main.c
	$(CC) $(CFLAGS) -o generate_graph $(GRAPH_SRC) graph/generate_graph_main.c $(LIBS)

omp: pagerank_omp bfs_omp sssp_omp

pagerank_omp: $(GRAPH_SRC) $(CORE_SRC) $(OMP_PR_SRC)
	$(CC) $(OMPFLAGS) -o pagerank_omp $(GRAPH_SRC) $(CORE_SRC) $(OMP_PR_SRC) $(LIBS)

bfs_omp: $(GRAPH_SRC) $(OMP_BFS_SRC)
	$(CC) $(OMPFLAGS) -o bfs_omp $(GRAPH_SRC) $(OMP_BFS_SRC) $(LIBS)

sssp_omp: $(GRAPH_SRC) $(OMP_SSSP_SRC)
	$(CC) $(OMPFLAGS) -o sssp_omp $(GRAPH_SRC) $(OMP_SSSP_SRC) $(LIBS)

bfs: bfs_seq bfs_mpi bfs_omp

bfs_seq: $(GRAPH_SRC) $(BFS_SEQ_SRC)
	$(CC) $(CFLAGS) -o bfs_seq $(GRAPH_SRC) $(BFS_SEQ_SRC) $(LIBS)

bfs_mpi: $(GRAPH_SRC) $(BFS_MPI_SRC)
	$(MPICC) $(CFLAGS) -o bfs_mpi $(GRAPH_SRC) $(BFS_MPI_SRC) $(LIBS)

sssp: sssp_seq sssp_omp

sssp_seq: $(GRAPH_SRC) $(SSP_SEQ_SRC)
	$(CC) $(CFLAGS) -o sssp_seq $(GRAPH_SRC) $(SSP_SEQ_SRC) $(LIBS)

clean:
	rm -f pagerank_seq pagerank_mpi generate_graph pagerank_cuda_seq pagerank_cuda_par bfs_seq bfs_mpi sssp_seq pagerank_omp bfs_omp sssp_omp
