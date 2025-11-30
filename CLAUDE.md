# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
bun install              # Install dependencies
bun run dev              # Development mode with watch (all packages)
bun run check            # Type check all packages
bun test                 # Run tests

# Package-specific
bun --filter mcp-server test           # Run MCP server tests only
bun --filter mcp-server check          # Type check MCP server only
bun --filter obsidian-plugin build     # Build plugin only

# Version & Release
bun run version [patch|minor|major]    # Bump version across all manifests
bun run release                        # Build all release artifacts
bun run zip                            # Create plugin zip for distribution
```

## Architecture

This is an MCP (Model Context Protocol) integration for Obsidian, consisting of:

1. **MCP Server** (`packages/mcp-server/`) - Standalone server binary that Claude Desktop connects to
2. **Obsidian Plugin** (`packages/obsidian-plugin/`) - Installs/configures the server and registers REST API endpoints
3. **Shared** (`packages/shared/`) - Common types and utilities

### Communication Flow

```
Claude Desktop <--MCP--> MCP Server <--HTTP--> Local REST API Plugin <---> Obsidian Vault
```

The MCP server communicates via stdio with Claude Desktop and makes HTTP requests to Obsidian's Local REST API plugin for vault access.

### Feature Architecture

Both packages use feature-based architecture in `src/features/`:

**MCP Server Features:**
- `core/` - Server initialization, tool registry setup
- `local-rest-api/` - Vault file operations via REST API
- `smart-connections/` - Semantic search (requires Smart Connections plugin)
- `templates/` - Template execution (requires Templater plugin)
- `fetch/` - Web content fetching
- `prompts/` - MCP prompts for common operations

**Obsidian Plugin Features:**
- `core/` - Plugin initialization, settings UI
- `mcp-server-install/` - Binary download, Claude Desktop config

Each feature exports a `setup()` function and is self-contained with its own types, services, and constants.

### Tool Registry Pattern

MCP tools are registered using ArkType schemas for runtime validation:

```typescript
const toolSchema = type({
  name: '"tool_name"',
  arguments: { path: "string", content: "string?" }
}).describe("Tool description for Claude");

registry.register(toolSchema, async (request, context) => {
  // Handler returns { content: [{ type: "text", text: "..." }] }
});
```

### Type Safety

- ArkType for runtime validation of external data (API requests, MCP parameters)
- TypeScript strict mode required
- Plugin settings extended via module augmentation:

```typescript
declare module "obsidian" {
  interface McpToolsPluginSettings {
    featureName?: { setting1?: string };
  }
}
```

## Key Dependencies

- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `arktype` - Runtime type validation
- `obsidian-local-rest-api` - HTTP API for vault access
- Svelte 5 - Plugin UI components

## Testing

```bash
bun test                                    # All tests
bun test packages/mcp-server/src/**/*.test.ts  # Specific test files
```

Tests use Bun's built-in test runner. Test files are colocated with source (`.test.ts` suffix).

## Development Setup

1. `bun install`
2. `bun run dev` - Watches and rebuilds
3. For plugin testing: `bun --filter obsidian-plugin link` - Symlinks to a test vault
4. MCP Inspector for debugging: `bun --filter mcp-server inspector`

## Environment Variables

- `OBSIDIAN_API_KEY` - Required for MCP server to authenticate with Local REST API
