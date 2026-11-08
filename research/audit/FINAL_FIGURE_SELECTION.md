# Final Figure Selection

## Recommended Main-Paper Figures

### 1. Dataset Word-Count Distribution
**Source:** `research/figures/publication/figure_01_dataset_word_distribution.*`

This establishes the corpus shape, including the long right tail, and justifies stratified sampling. It is important context for a performance paper using article length as an input variable.

### 2. Latency Comparison by Operation
**Source:** `research/figures/publication/figure_04_latency_comparison.*`

This is the clearest high-level result: mean and median latency for the four measured workloads. The caption must state that atomization totals contain multiple sequential model calls.

### 3. Latency Distributions
**Source:** `research/figures/publication/figure_05_latency_distribution.*`

This prevents means from hiding skew and outliers. It supports the limitation that five-output atomization has substantially wider latency variation.

### 4. Atomization Workload Comparison
**Source:** `research/figures/publication/figure_06_atomization_comparison.*`

This directly addresses the central atomization scaling question by showing total seconds and seconds per child. It must not be interpreted as a quality comparison.

### 5. GPU Utilization Timeline
**Use audit correction:** `research/audit/corrected_figures/figure_07_gpu_utilization_chronological.*`

This connects direct inference latency to local GPU demand. The corrected version sorts timestamps and shows raw samples plus a rolling mean.

### 6. Input Length Versus Processing Latency
**Source:** `research/figures/publication/figure_10_input_latency.*`

This is useful for discussing descriptive scalability behavior, provided the paper explicitly says the plot is not causal and the sample is stratified.

## Recommended Supplementary Figures

- **Figure 2:** length categories are useful dataset documentation but less central than latency.
- **Figure 3:** quality breakdown is useful for data auditability.
- **Figure 7 original:** retain only as an archived original; use the timestamp-sorted audit correction in the paper.
- **Figure 8 / 9:** resource and VRAM timelines are valuable supplementary evidence; use chronological audit corrections.
- **Figure 11:** input/output length relationship is exploratory.
- **Figure 12:** compression ratio is useful but limited to two single-output transformations.
- **Figure 13:** output compliance is a strong audit result but trivial at 100% in this run.
- **Figure 14:** throughput is useful only with its observation/minute definition.
- **Figure 15:** lexical overlap is a proxy and should remain supplementary unless carefully explained.

No figure should be used to imply human-rated quality, factual consistency, production scheduler performance, or product superiority.
