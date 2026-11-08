# Image-Generation Findings Summary

- The full run used the same 45 article IDs as the text benchmark.
- All 45 ComfyUI requests succeeded.
- Mean generation time was 13.814 seconds; median was 14.067 seconds; p95 was 14.137 seconds.
- Throughput was 4.343 completed images per minute under sequential direct API execution.
- All outputs were readable 768x768 PNGs. The workflow begins with a 512x512 latent and applies a 1.5x latent upscale before SaveImage.
- GPU utilization averaged 90.27% and peaked at 100%; VRAM use averaged approximately 2.60 GB and peaked at 4.08 GB.
- GPU temperature averaged 72.08 C and peaked at 88 C.
- Queue wait could not be measured from the available ComfyUI history API and is not reported as zero.
- No human quality evaluation or reference-based image metric was performed.

These results characterize this exact local ComfyUI workflow, checkpoint, machine, and sequential workload. They do not prove visual quality, production scheduler performance, concurrent-user behavior, or superiority over other image-generation systems.
