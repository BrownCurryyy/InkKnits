# Image-Generation Benchmark Results

## Run

Run ID: `image-full-20261108T131126Z-c4c3d9e4`. The benchmark used the same 45 article IDs as the completed text benchmark and executed sequentially through the existing ComfyUI API integration. The prior failed smoke record and successful one-request smoke run remain separate records.

## Configuration

The checked-in workflow `backend/final4.json` used checkpoint `epicrealism_naturalSinRC1VAE.safetensors`, 512x512 latent input, batch size 1, primary KSampler 28 steps and CFG 7.5, refinement KSampler 15 steps and CFG 7, `dpmpp_2m`, and `karras`. The workflow includes a 1.5x latent upscale before SaveImage, so the actual saved output dimensions were 768x768. This was measured, not changed or assumed.

ComfyUI reported version 0.28.0, Python 3.13.12, and PyTorch 2.10.0+cu130. The GPU was an NVIDIA RTX 4050 Laptop GPU with 6141 MiB reported VRAM and driver 592.82.

## Performance

| Metric | Measured value |
|---|---:|
| Requests | 45 |
| Successful generations | 45 |
| Failed generations | 0 |
| Success rate | 100% |
| Mean generation time | 13.814 s |
| Median generation time | 14.067 s |
| Standard deviation | 0.554 s |
| Minimum | 12.366 s |
| Maximum | 16.038 s |
| P95 | 14.137 s |
| Throughput | 4.343 completed images/minute |
| Queue wait | Unavailable from ComfyUI history API |
| Final dimensions | 768x768 |
| Mean file size | 859,758 bytes |
| Median file size | 838,572 bytes |
| Minimum file size | 730,036 bytes |
| Maximum file size | 1,154,198 bytes |

Generation time and end-to-end time are equal in this sequential direct API experiment because queue start and execution start timestamps were unavailable. Queue wait is not claimed as zero.

## Resources

Continuous monitoring recorded 2,074 samples. CPU and RAM are system-wide; GPU utilization, VRAM, temperature, and power are device-level `nvidia-smi` measurements.

- CPU: 58.98% mean, 85.4% peak
- RAM: 78.30% mean, 80.0% peak
- GPU utilization: 90.27% mean, 100.0% peak
- VRAM used: 2,600,866,878 bytes mean, 4,077,912,064 bytes peak
- GPU temperature: 72.08 C mean, 88 C peak
- GPU power: 45.08 W mean, 84.36 W peak

## Quality

All generated files passed existence, non-empty, readability, and dimension validation. No human image evaluation has been completed. No reference images, FID, CLIP, or other fabricated quality scores are reported. File size is an output-storage metric, not an image-quality metric.

## Outputs

- Raw records: `datasets/results/image_experiment_results.csv` and `.jsonl`
- Prompts: `datasets/results/image_generation_prompts.csv`
- Images: `datasets/results/generated_images/`
- Summary: `datasets/results/image_experiment_summary.json`
- Resource samples: `datasets/results/image_resource_samples.csv`
- Audit: `research/image_audit_report.json`
- Figures: `research/figures/image_generation/`
