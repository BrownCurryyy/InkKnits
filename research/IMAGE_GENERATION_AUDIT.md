# Image Benchmark Audit Status

The initial run `image-smoke-20261108T125344Z-ec262b44` was blocked, but the subsequent full run completed as `image-full-20261108T131126Z-c4c3d9e4`.

- Full measured requests: 45.
- Full measured successes: 45.
- Full measured failures: 0.
- Full generated images: 45.
- Full resource samples: 2,074.
- GPU fields: available from `nvidia-smi`.
- Queue wait: unavailable from the ComfyUI API path.

The failed smoke files remain under `datasets/results/` with the `image_` prefix, alongside the successful smoke and full-run records. The full image analysis and three publication figures are separate from the text benchmark. Queue wait remains unavailable through the exercised ComfyUI history API, and no human visual-quality evaluation has been completed.
