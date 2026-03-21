import subprocess
import json
import os
import sys

def run_command(cmd):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        print(e.stderr)
        return None

def benchmark(dataset_path):
    print(f"Benchmarking with {dataset_path}...")
    
    # Run Sequential
    print("Running sequential...")
    seq_out = run_command(["./engine/pagerank_seq", dataset_path, "-j"])
    if not seq_out: return None
    seq_data = json.loads(seq_out)
    seq_time = seq_data["execution_time"]
    
    results = {
        "nodes": seq_data["nodes"],
        "edges": seq_data["edges"],
        "sequential_time": seq_time,
        "mpi_runs": []
    }
    
    # Run MPI with different process counts
    for p in [1, 2, 4, 8]:
        print(f"Running MPI with {p} processes...")
        mpi_out = run_command(["mpirun", "--oversubscribe", "-np", str(p), "./engine/pagerank_mpi", dataset_path, "-j"])
        if not mpi_out: continue
        mpi_data = json.loads(mpi_out)
        mpi_time = mpi_data["execution_time"]
        
        speedup = seq_time / mpi_time
        efficiency = speedup / p
        
        results["mpi_runs"].append({
            "processes": p,
            "execution_time": mpi_time,
            "speedup": round(speedup, 2),
            "efficiency": round(efficiency, 2)
        })
        
    return results

def main():
    if not os.path.exists("results"):
        os.makedirs("results")
        
    datasets = [
        ("datasets/test_1k.txt", 1000, 5),
        ("datasets/test_10k.txt", 10000, 5),
        ("datasets/test_50k.txt", 50000, 5),
        ("datasets/test_150k.txt", 150000, 10)
    ]
    
    all_benchmarks = []
    
    for path, n, m in datasets:
        # Generate dataset if missing
        if not os.path.exists(path):
            print(f"Generating dataset {path}...")
            # Use absolute or relative path to generator
            subprocess.run(["./engine/generate_graph", "random", str(n), str(m)], 
                         stdout=open(path, "w"), check=True)
        
        res = benchmark(path)
        if res:
            all_benchmarks.append(res)
            
    with open("results/performance.json", "w") as f:
        json.dump(all_benchmarks, f, indent=2)
    
    print("\nBenchmarking complete. Results saved to results/performance.json")

if __name__ == "__main__":
    main()
