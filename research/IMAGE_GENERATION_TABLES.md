# Image-Generation Benchmark Tables

## Configuration

| Setting | Value |
|---|---|
| Run ID | image-full-20261108T131126Z-c4c3d9e4 |
| Backend | ComfyUI 0.28.0 |
| Checkpoint | epicrealism_naturalSinRC1VAE.safetensors |
| Latent input | 512x512 |
| Saved output | 768x768 |
| Batch size | 1 |
| Primary KSampler | 28 steps, CFG 7.5 |
| Refinement KSampler | 15 steps, CFG 7, denoise 0.4 |
| Sampler / scheduler | dpmpp_2m / karras |
| Requests | 45 |
| Seed strategy | SHA-256 master seed and article ID |

## Performance

| Metric | Value |
|---|---:|
| Successes | 45 |
| Failures | 0 |
| Mean generation seconds | 13.814 |
| Median generation seconds | 14.067 |
| P95 generation seconds | 14.137 |
| Throughput images/minute | 4.343 |
| Queue wait | Unavailable |

## Resources

| Metric | Mean | Peak |
|---|---:|---:|
| CPU utilization | 58.98% | 85.4% |
| RAM utilization | 78.30% | 80.0% |
| GPU utilization | 90.27% | 100.0% |
| VRAM used | 2.60 GB | 4.08 GB |
| GPU temperature | 72.08 C | 88 C |
| GPU power | 45.08 W | 84.36 W |
| Resource samples | 2,074 | 0.25 s configured interval |

## Output Validation

| Metric | Value |
|---|---:|
| Valid PNG outputs | 45 |
| Dimensions | 768x768 for all outputs |
| Mean file size | 859,758 bytes |
| Minimum file size | 730,036 bytes |
| Maximum file size | 1,154,198 bytes |
| Human quality evaluations | Pending |
