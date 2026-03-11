#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <mpi.h>

#define MAX_NODES 10
#define DAMPING 0.85
#define EPSILON 1e-6
#define MAX_ITER 100

typedef struct {
    int num_nodes;
    int adj[MAX_NODES][MAX_NODES];
} Graph;

void load_graph(Graph *g) {

    for(int i=0;i<MAX_NODES;i++)
        for(int j=0;j<MAX_NODES;j++)
            g->adj[i][j]=0;

    g->num_nodes=6;

    g->adj[0][1]=1;
    g->adj[0][2]=1;
    g->adj[1][2]=1;
    g->adj[2][0]=1;
    g->adj[2][3]=1;
    g->adj[3][4]=1;
    g->adj[4][5]=1;
    g->adj[5][3]=1;
}

int main(int argc,char** argv){

    MPI_Init(&argc,&argv);

    int rank,size;

    MPI_Comm_rank(MPI_COMM_WORLD,&rank);
    MPI_Comm_size(MPI_COMM_WORLD,&size);

    Graph g;

    load_graph(&g);

    int n=g.num_nodes;

    double pagerank[MAX_NODES];
    double new_rank[MAX_NODES];

    for(int i=0;i<n;i++)
        pagerank[i]=1.0/n;

    int nodes_per_process=n/size;
    int start=rank*nodes_per_process;
    int end=(rank==size-1)?n:start+nodes_per_process;

    double start_time=MPI_Wtime();

    for(int iter=0;iter<MAX_ITER;iter++){

        for(int i=0;i<n;i++)
            new_rank[i]=0;

        for(int i=start;i<end;i++){

            int out_degree=0;

            for(int j=0;j<n;j++)
                if(g.adj[i][j]) out_degree++;

            if(out_degree==0) continue;

            for(int j=0;j<n;j++){

                if(g.adj[i][j])
                    new_rank[j]+=pagerank[i]/out_degree;

            }
        }

        MPI_Allreduce(MPI_IN_PLACE,new_rank,n,MPI_DOUBLE,MPI_SUM,MPI_COMM_WORLD);

        double diff=0;

        for(int i=0;i<n;i++){

            new_rank[i]=(1-DAMPING)/n + DAMPING*new_rank[i];

            diff+=fabs(new_rank[i]-pagerank[i]);

            pagerank[i]=new_rank[i];
        }

        double global_diff;

        MPI_Allreduce(&diff,&global_diff,1,MPI_DOUBLE,MPI_SUM,MPI_COMM_WORLD);

        if(global_diff<EPSILON)
            break;
    }

    double end_time=MPI_Wtime();

    if(rank==0){

        printf("\nFinal PageRank:\n");

        for(int i=0;i<n;i++)
            printf("Node %d : %.6f\n",i,pagerank[i]);

        printf("\nExecution time: %f seconds\n",end_time-start_time);
    }

    MPI_Finalize();

    return 0;
}
