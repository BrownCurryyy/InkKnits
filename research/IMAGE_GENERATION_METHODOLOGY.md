# Image-Generation Benchmark Methodology

## Scope

This is a separate image benchmark for the existing InkKnits ComfyUI integration. It does not modify or rerun the completed Gemma text benchmark.

## Verified workflow

The checked-in workflow is `backend/final4.json`, submitted to ComfyUI at `http://127.0.0.1:8188`. It specifies checkpoint `epicrealism_naturalSinRC1VAE.safetensors`, 512x512 latent size, batch size 1, primary KSampler 28 steps, CFG 7.5, `dpmpp_2m`, `karras`, and a second refinement KSampler with 15 steps, CFG 7, denoise 0.4. The application service injects the same seed into the first sampler and seed+1 into the refinement sampler. The checked-in SaveImage node is connected to the first VAE decode path; this benchmark preserves and reports that graph rather than changing it.

## Sampling and prompts

The exact 45 article IDs come from `datasets/benchmark_sample.csv`. Prompt construction is deterministic: whitespace-normalize the article, retain the first 1,200 characters, and place the excerpt into a fixed editorial-documentary prompt template. Prompts and preprocessing decisions are saved in `image_generation_prompts.csv`. Seeds are deterministic SHA-256 derivations of `20261108:article_id` modulo `2^31-1`.

## Measurements

A warm-up generation is excluded from measured observations. Measured requests execute sequentially. Submission, completion, generation, total elapsed, output path, dimensions, size, status, and errors are recorded. The current ComfyUI history API does not expose queue-start timestamps, so queue wait is recorded as unavailable rather than inferred.

The shared monitor records system-wide CPU/RAM through `psutil` and device-level GPU utilization, VRAM, temperature, and power through `nvidia-smi`. Samples are timestamped and sorted before analysis.

## Quality

No reference images exist. No FID, CLIP, or fabricated visual-quality score is reported. The generated-image human evaluation template is pending and uses 1-5 ratings for relevance, prompt alignment, visual coherence, artifacts, and usability.

## Execution status

The initial smoke execution was blocked because ComfyUI was not listening on port 8188 and remains preserved. After ComfyUI became available, smoke run `image-smoke2-20261108T130922Z-dc97cd1e` succeeded, followed by full run `image-full-20261108T131126Z-c4c3d9e4`. The full run completed 45/45 requests successfully and produced 45 validated 768x768 PNGs. Queue wait remained unavailable from the ComfyUI history API, and human quality evaluation remains pending.
