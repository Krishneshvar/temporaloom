# Temporaloom CUDA Setup Guide

To ensure `Temporaloom` operates smoothly with GPU acceleration on your NVIDIA GeForce MX570, you need to install the CUDA Toolkit. Since you are using Linux, compiling and running `.cu` files natively requires `nvcc` directly accessible from your terminal path.

## Pre-requisites
Ensure your system is fully aligned by verifying your NVIDIA Drivers. Your system must be recognizing your MX570 GPU. Run the following command in terminal to confirm driver status:
```bash
nvidia-smi
```

## Installing the CUDA Toolkit

The `nvcc` compiler is packaged within the NVIDIA CUDA Toolkit.

### Option 1: Using your Distribution's Package Manager (Recommended for Ubuntu/Debian)

Often, the simplest method is to install the `nvidia-cuda-toolkit` directly from your default package manager:

```bash
sudo apt update
sudo apt install nvidia-cuda-toolkit
```

Once installed, verify the compiler availability:
```bash
nvcc --version
```
If it prints a version number, you're set.

### Option 2: Using Arch Linux / Pacman
If you're on Arch Linux or an Arch derivative (like Manjaro):

```bash
sudo pacman -Syu
sudo pacman -S cuda
```
Note: Depending on your shell, you may need to add `/opt/cuda/bin` to your system `PATH`.
```bash
export PATH=/opt/cuda/bin:$PATH
```

### Option 3: Official NVIDIA Archive (If package managers fail)
If your Linux distribution doesn't have an updated toolkit in its repositories, you can install the official runfile for Linux by following NVIDIA's download guide here:
[NVIDIA CUDA Toolkit Downloads](https://developer.nvidia.com/cuda-downloads)

1. Select **Linux** -> **x86_64**
2. Choose your distribution and version
3. Follow the Base Installer runfile instructions provided on that page.

## Testing Temporaloom

Once `nvcc` works, you can execute the Temporaloom build targets via our `engine/Makefile`:

```bash
cd engine
make all
```

This will automatically invoke `nvcc -O3 -o pagerank_cuda_seq cuda/pagerank_cuda_seq.cu` and `pagerank_cuda_par.cu`. You are now fully ready to run the benchmark suite!
