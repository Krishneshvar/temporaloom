CC = gcc
MPICC = mpicc
NVCC = nvcc
CFLAGS = -Wall -O3
NVCCFLAGS = -O3 -arch=sm_86
LIBS = -lm

GRAPH_SRC = graph/graph.c graph/graph_loader.c graph/graph_generator.c
CORE_SRC = pagerank/pagerank_core.c
SEQ_SRC = sequential/pagerank_seq.c
MPI_SRC = mpi/pagerank_mpi.c

.PHONY: all clean seq mpi generator cuda

all: seq mpi generator cuda

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

clean:
	rm -f pagerank_seq pagerank_mpi generate_graph pagerank_cuda_seq pagerank_cuda_par
