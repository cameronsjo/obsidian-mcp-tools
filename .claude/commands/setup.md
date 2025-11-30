---
description: Setup command for new contributors
---

Set up the obsidian-mcp-tools development environment for the first time.

This command will:

1. Install all dependencies using bun
2. Build all packages (MCP server and Obsidian plugin)
3. Verify the setup was successful

Steps:

1. Install dependencies for all workspace packages:
   ```bash
   bun install
   ```

2. Build the MCP server:
   ```bash
   cd packages/mcp-server && bun run build
   ```

3. Build the Obsidian plugin:
   ```bash
   cd packages/obsidian-plugin && bun run build
   ```

4. Run TypeScript type checking to verify setup:
   ```bash
   bun run check
   ```

5. Confirm setup is complete:
   - MCP server binary should exist at `packages/mcp-server/dist/mcp-server`
   - Obsidian plugin files should exist in `packages/obsidian-plugin/`
   - No TypeScript errors from the check command

If all steps complete successfully, the development environment is ready to use.

Next steps:
- Run `/dev` to start development mode
- Run `/check` to run all checks
- Run `/test` to run the test suite
