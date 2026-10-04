#!/usr/bin/env python3
"""
DeepSee stability-series analyzer (Phase 6C §17).
Reads captured 5-feature vectors as JSON lines:
  {"temperature": 27.1, "ph": 8.02, "salinity": 34.6, "oxygen": 5.1, "turbidity": 0.8}
Prints min / max / mean / standard deviation / sample + invalid counts per
feature. Standard deviation is reported as OBSERVED VARIATION, never as
sensor error (no formal uncertainty analysis is performed here).

Usage:
  python stability-analysis.py vectors.jsonl
"""
import json
import math
import statistics
import sys

FEATURES = ["temperature", "ph", "salinity", "oxygen", "turbidity"]


def main(path: str) -> int:
    series = {f: [] for f in FEATURES}
    invalid = {f: 0 for f in FEATURES}
    total = 0
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            total += 1
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                for f in FEATURES:
                    invalid[f] += 1
                continue
            for f in FEATURES:
                v = row.get(f)
                if isinstance(v, (int, float)) and math.isfinite(v):
                    series[f].append(float(v))
                else:
                    invalid[f] += 1

    print(f"vectors: {total}")
    print(f"{'feature':<12}{'n':>6}{'min':>10}{'max':>10}{'mean':>10}{'stdev':>10}{'invalid':>9}")
    for f in FEATURES:
        vals = series[f]
        if len(vals) < 2:
            print(f"{f:<12}{len(vals):>6}{'—':>10}{'—':>10}{'—':>10}{'—':>10}{invalid[f]:>9}")
            continue
        print(
            f"{f:<12}{len(vals):>6}"
            f"{min(vals):>10.3f}{max(vals):>10.3f}"
            f"{statistics.fmean(vals):>10.3f}{statistics.stdev(vals):>10.4f}"
            f"{invalid[f]:>9}"
        )
    print("note: stdev = observed variation, NOT sensor error")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
