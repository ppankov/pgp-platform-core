# PGP Architecture Intelligence — Benchmark System Specification

## Overview

The benchmark system compares architectures across four modes, producing per-category delta analysis and recommendations.

## Benchmark Modes

| Mode | Description |
|---|---|
| `project_vs_project` | Compare two projects within the org |
| `version_vs_version` | Compare the same project at two points in time |
| `customer_vs_reference` | Compare a customer platform against a reference architecture |
| `current_vs_pgp_best_practices` | Compare current architecture against PGP Core best practices |

## Benchmark Entity (`AuditBenchmark`)

| Field | Description |
|---|---|
| `name` | Benchmark name |
| `mode` | One of the four modes |
| `left_project_id` | Left-side project |
| `right_project_id` | Right-side project (null for reference comparisons) |
| `right_reference_id` | Reference architecture id (for reference comparisons) |
| `status` | draft, completed, archived |

## Comparison Entity (`AuditBenchmarkComparison`)

Per-category comparison result:

| Field | Description |
|---|---|
| `benchmark_id` | Parent benchmark |
| `category_definition_id` | Category being compared |
| `left_score` | Score from left side (0–100) |
| `right_score` | Score from right side (0–100) |
| `delta` | Right minus left |
| `analysis` | Explanation of the difference |
| `recommendation` | Recommended action based on the comparison |

## Delta Interpretation

- Positive delta → right side is better in this category
- Negative delta → left side is better
- Near-zero delta → parity

## Reference Architectures

For `customer_vs_reference` and `current_vs_pgp_best_practices` modes, reference architectures are maintained as knowledge base articles (`AuditKnowledgeArticle` with category `internal_pgp_standard`). These define ideal scores and patterns per category.

## Output

Every comparison includes `analysis` and `recommendation` — never just numbers. The analysis explains why the delta exists and what it means.

## Phase 1A Status

- Benchmark and comparison entity schemas created.
- No comparison engine, no reference architecture library.
- All deferred to Phase 3.