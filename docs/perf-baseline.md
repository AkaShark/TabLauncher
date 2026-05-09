# AIRSS Perf Baseline (P2-lite)

Date: 2026-05-09
Method: vitest `bench` against `aggregate()` (the algorithmic core of
`feed.rebuildFromRaw`). 5 mock sources, items spread evenly. Node 20,
happy-dom env, M-class dev laptop.

## Results

| Workload                          | mean  | p99   |
| --------------------------------- | ----- | ----- |
| aggregate 200 items               | 0.017 ms | 0.021 ms |
| aggregate 1000 items              | 0.064 ms | 0.078 ms |

(Hz: 60,267 / 15,648; rme ≈ 0.3%)

## Decision

**No virtualization library. Lift `MAX_RENDER` from 30 → 200.**

## Reason

Aggregation at 1000 items is ~0.06 ms — three orders of magnitude under
the 16 ms frame budget — so the bottleneck is DOM render volume, not the
Pinia rebuild. Adding `@tanstack/vue-virtual` (~3 KB gzip + complexity)
would optimise a non-bottleneck. Raising the visible cap to 200 keeps
DOM cost proportional to a typical user's actual feed and defers
windowing until measurement justifies it.

## Follow-ups

- Re-bench with real RSS payloads (XML parse cost not covered here) once
  P3 ships.
- If a single user accumulates >200 visible items per tab in practice,
  revisit virtualization or per-tab pagination.
