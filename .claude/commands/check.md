---
description: Run all checks without committing
---

Run all code quality checks across the monorepo without making any commits.

This command will:

1. Run TypeScript type checking across all packages
2. Run tests if available
3. Report any issues found

Steps:

1. Run TypeScript type checking for all packages:
   ```bash
   bun run check
   ```

2. Run tests for the MCP server:
   ```bash
   cd packages/mcp-server && bun test
   ```

3. Run tests for the Obsidian plugin (if test script exists):
   ```bash
   cd packages/obsidian-plugin && bun test 2>/dev/null || echo "No tests configured for obsidian-plugin"
   ```

4. Summary:
   - Report any TypeScript errors
   - Report any test failures
   - If all checks pass, confirm the codebase is healthy

This command is designed to be run before committing changes to ensure code quality without actually creating a commit.
