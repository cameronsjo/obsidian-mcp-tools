# Feature: Load Testing Infrastructure

> Ensure MCP tools perform well under realistic vault sizes and usage patterns.

## Status

- **Status**: idea
- **Priority**: High
- **Effort**: Medium

## Problem

### Current State

- No performance benchmarks
- Unknown behavior at scale (10k, 50k, 100k files)
- No regression detection
- Response times untested
- Memory usage unmonitored

### Desired State

- Automated performance benchmarks
- Known performance characteristics at various scales
- Performance regression detection in CI
- Response time budgets enforced
- Memory limits validated

## Proposed Solution

### Test Vault Generator

Generate synthetic vaults at various scales:

```typescript
// packages/mcp-server/src/test/fixtures/generate-vault.ts

interface VaultConfig {
  fileCount: number;
  avgFileSize: number;      // bytes
  folderDepth: number;
  folderBreadth: number;
  tagDensity: number;       // tags per file
  linkDensity: number;      // internal links per file
  frontmatterComplexity: "simple" | "medium" | "complex";
}

const VAULT_PRESETS = {
  small: { fileCount: 100, avgFileSize: 2000, ... },
  medium: { fileCount: 1000, avgFileSize: 5000, ... },
  large: { fileCount: 10000, avgFileSize: 5000, ... },
  massive: { fileCount: 50000, avgFileSize: 3000, ... },
  stress: { fileCount: 100000, avgFileSize: 2000, ... },
};

async function generateTestVault(config: VaultConfig): Promise<void> {
  // Generate folder structure
  // Generate files with realistic content
  // Add frontmatter, tags, links
  // Create attachments (images, PDFs)
}
```

### Performance Test Suite

```typescript
// packages/mcp-server/src/test/performance/benchmarks.test.ts

import { bench, run } from "mitata"; // or tinybench

describe("Performance Benchmarks", () => {

  describe("list_vault_files", () => {
    bench("100 files", async () => {
      await tools.dispatch({ name: "list_vault_files", arguments: {} });
    });

    bench("10,000 files", async () => {
      await tools.dispatch({ name: "list_vault_files", arguments: {} });
    });

    bench("50,000 files", async () => {
      await tools.dispatch({ name: "list_vault_files", arguments: {} });
    });
  });

  describe("search_vault_simple", () => {
    bench("narrow query, 1k files", async () => {
      await tools.dispatch({
        name: "search_vault_simple",
        arguments: { query: "specific-unique-term" }
      });
    });

    bench("broad query, 10k files", async () => {
      await tools.dispatch({
        name: "search_vault_simple",
        arguments: { query: "the" }
      });
    });
  });

  describe("bulk_delete_files (dry run)", () => {
    bench("glob match 100 files", async () => {
      await tools.dispatch({
        name: "bulk_delete_files",
        arguments: { match: "archive/*.md", dryRun: true }
      });
    });

    bench("glob match 5000 files", async () => {
      await tools.dispatch({
        name: "bulk_delete_files",
        arguments: { match: "**/*.md", dryRun: true }
      });
    });
  });
});
```

### Performance Budgets

```typescript
// packages/mcp-server/src/test/performance/budgets.ts

export const PERFORMANCE_BUDGETS = {
  // Response time budgets (p95)
  "list_vault_files": {
    "100_files": 50,      // ms
    "1000_files": 100,
    "10000_files": 500,
    "50000_files": 2000,
  },

  "search_vault_simple": {
    "narrow_1k": 100,
    "broad_10k": 500,
    "broad_50k": 2000,
  },

  "get_vault_file": {
    "1kb": 20,
    "100kb": 50,
    "1mb": 200,
  },

  // Response size budgets (bytes)
  "response_size": {
    "list_vault_files": 50_000,    // 50KB max
    "search_results": 100_000,     // 100KB max
    "file_content": 50_000,        // 50KB default
  },

  // Memory budgets
  "memory": {
    "idle": 50_000_000,            // 50MB
    "peak_operation": 200_000_000, // 200MB
  },
};
```

### CI Integration

```yaml
# .github/workflows/performance.yml

name: Performance Tests

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Generate test vaults
        run: bun run generate-test-vaults

      - name: Run benchmarks
        run: bun run benchmark

      - name: Check budgets
        run: bun run check-budgets

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results
          path: benchmark-results.json

      - name: Compare with baseline
        run: bun run compare-benchmarks

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const results = require('./benchmark-results.json');
            // Format and post comment with perf changes
```

### Memory Profiling

```typescript
// packages/mcp-server/src/test/performance/memory.test.ts

describe("Memory Usage", () => {
  it("stays under budget during large list", async () => {
    const before = process.memoryUsage().heapUsed;

    await tools.dispatch({
      name: "list_vault_files",
      arguments: {}
    });

    const after = process.memoryUsage().heapUsed;
    const delta = after - before;

    expect(delta).toBeLessThan(PERFORMANCE_BUDGETS.memory.peak_operation);
  });

  it("releases memory after operation", async () => {
    await tools.dispatch({ name: "list_vault_files", arguments: {} });

    global.gc?.(); // Requires --expose-gc

    const usage = process.memoryUsage().heapUsed;
    expect(usage).toBeLessThan(PERFORMANCE_BUDGETS.memory.idle);
  });
});
```

### Reporting

```typescript
// packages/mcp-server/src/test/performance/report.ts

interface BenchmarkResult {
  name: string;
  ops_per_sec: number;
  avg_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  memory_mb: number;
  response_size_kb: number;
}

function generateReport(results: BenchmarkResult[]): string {
  return `
# Performance Report

## Summary
| Metric | Value |
|--------|-------|
| Total benchmarks | ${results.length} |
| Passed budget | ${passedCount} |
| Failed budget | ${failedCount} |

## Results

${results.map(r => `
### ${r.name}
- Ops/sec: ${r.ops_per_sec.toFixed(2)}
- Avg: ${r.avg_ms.toFixed(2)}ms
- P95: ${r.p95_ms.toFixed(2)}ms
- Memory: ${r.memory_mb.toFixed(2)}MB
- Response: ${r.response_size_kb.toFixed(2)}KB
`).join('\n')}
  `;
}
```

## Implementation Plan

### Phase 1: Infrastructure (4 hours)
1. Add benchmark tooling (mitata or tinybench)
2. Create test vault generator
3. Define vault presets

### Phase 2: Benchmarks (4 hours)
4. Write benchmarks for all tools
5. Define performance budgets
6. Add memory profiling

### Phase 3: CI Integration (4 hours)
7. GitHub Actions workflow
8. Baseline comparison
9. PR commenting
10. Regression detection

### Phase 4: Reporting (2 hours)
11. Report generation
12. Historical tracking
13. Dashboard (optional)

## Tools & Dependencies

```json
{
  "devDependencies": {
    "mitata": "^0.1.11",
    "@faker-js/faker": "^8.4.0"
  }
}
```

## Success Metrics

- All tools have benchmarks
- Performance budgets defined and enforced
- Regressions caught before merge
- Response times documented
- Memory usage predictable
