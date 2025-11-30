---
description: Run tests with options
---

Run the test suite for obsidian-mcp-tools.

Arguments:
- $ARGUMENTS: Optional test file pattern or path to run specific tests (e.g., "search" or "src/search.test.ts")

Steps:

1. Determine test scope:
   - If $ARGUMENTS is provided, run tests matching that pattern
   - Otherwise, run all tests

2. Run MCP server tests:
   ```bash
   cd packages/mcp-server
   ```

   If $ARGUMENTS is provided:
   ```bash
   bun test --test-name-pattern="$ARGUMENTS"
   ```

   Otherwise run all tests:
   ```bash
   bun test
   ```

3. Display results:
   - Show test summary (passed/failed counts)
   - Show coverage summary if available
   - Highlight any failing tests

4. Run Obsidian plugin tests (if they exist):
   ```bash
   cd packages/obsidian-plugin
   bun test 2>/dev/null || echo "No tests configured for obsidian-plugin"
   ```

Notes:
- Tests are located in `packages/mcp-server/src/**/*.test.ts`
- Use specific test patterns to run targeted tests faster
- Example: `/test search` to run only search-related tests
