# ML Benchmark Lite

- Generated at: 2026-02-12T15:54:45.586Z

## Asset Snapshot
| Asset | Size (bytes) |
|---|---|
| activity_cnn_lstm.min.model | 925556 |
| activity_cnn_lstm.model | 970899 |
| activity_model.json | 6075 |
| activity_v3.model | 1046646 |
| ar_v3.model | 7076 |
| fitcoach_model.json | 1111989 |
| fitcoach_transformer.min.model | 2329033 |
| fitcoach_transformer.model | 2734734 |
| fitcoach_v3.model | 13331894 |
| intent_labels.json | 408 |
| intent_model.json | 311852 |
| intent_transformer.model | 32867813 |

## Micro-benchmark Results
| Operation | Iterations | Total (ms) | Avg (ms) |
|---|---:|---:|---:|
| vector dot product (512 dims) | 1200 | 2.34 | 0.0020 |
| token scoring (intent-like) | 1500 | 1.05 | 0.0007 |