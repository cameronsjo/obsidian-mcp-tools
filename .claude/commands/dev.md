---
description: Start development mode
---

Start development mode for obsidian-mcp-tools with watch mode enabled.

This command will:

1. Build the MCP server in watch mode (auto-rebuild on file changes)
2. Provide instructions for linking the Obsidian plugin to your vault

Steps:

1. Start the MCP server in watch mode:
   ```bash
   cd packages/mcp-server && bun run dev
   ```

   This will:
   - Watch for file changes in `packages/mcp-server/src/`
   - Automatically rebuild to `bin/mcp-server` on changes
   - Keep the process running for continuous development

2. In a separate terminal, start the Obsidian plugin in watch mode:
   ```bash
   cd packages/obsidian-plugin && bun run dev
   ```

   This will:
   - Watch for file changes in the plugin source
   - Automatically rebuild the plugin on changes
   - Output files to the plugin directory

3. Link the plugin to your Obsidian vault (first time only):
   ```bash
   cd packages/obsidian-plugin && bun run link
   ```

   Or manually symlink the plugin directory to your vault:
   ```bash
   ln -s /Users/cameron/Projects/obsidian-mcp-tools/packages/obsidian-plugin /path/to/your/vault/.obsidian/plugins/obsidian-mcp-tools
   ```

4. Enable the plugin in Obsidian:
   - Open Obsidian Settings
   - Navigate to Community Plugins
   - Find "MCP Tools for Obsidian" and enable it
   - Reload Obsidian if needed

Development workflow:
- Make changes to source files
- Watch mode will automatically rebuild
- Reload the plugin in Obsidian (Ctrl/Cmd + R) to see changes
- Check the Obsidian developer console for any errors (Ctrl/Cmd + Shift + I)

Testing the MCP server:
- Use the MCP inspector: `cd packages/mcp-server && bun run inspector`
- Or configure Claude Desktop to use the development build at `bin/mcp-server`
