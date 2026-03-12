#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <time.h>

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

void pagerank(Graph *g) {

    int n = g->num_nodes;

    double rank[MAX_NODES];
    double new_rank[MAX_NODES];

    for(int i=0;i<n;i++)
        rank[i] = 1.0/n;

    for(int iter=0;iter<MAX_ITER;iter++) {

        for(int i=0;i<n;i++)
            new_rank[i]=(1-DAMPING)/n;

        for(int i=0;i<n;i++) {

            int out_degree=0;

            for(int j=0;j<n;j++)
                if(g->adj[i][j]) out_degree++;

            if(out_degree==0) continue;

            for(int j=0;j<n;j++) {

                if(g->adj[i][j])
                    new_rank[j]+=DAMPING*(rank[i]/out_degree);

            }
        }

        double diff=0;

        for(int i=0;i<n;i++) {
            diff+=fabs(new_rank[i]-rank[i]);
            rank[i]=new_rank[i];
        }

        if(diff<EPSILON) break;
    }

    printf("\nFinal PageRank:\n");

    for(int i=0;i<n;i++)
        printf("Node %d : %.6f\n",i,rank[i]);
}

int main() {

    Graph g;

    load_graph(&g);

    clock_t start=clock();

    pagerank(&g);

    clock_t end=clock();

    double time=(double)(end-start)/CLOCKS_PER_SEC;

    printf("\nExecution time: %f seconds\n",time);

    return 0;
}
