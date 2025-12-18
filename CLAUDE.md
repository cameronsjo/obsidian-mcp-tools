# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MCP Tools for Obsidian** - A Model Context Protocol (MCP) integration enabling Claude Desktop to interact with Obsidian vaults through a standalone server binary and companion plugin.

**Version:** 0.2.27
**Min Obsidian:** 0.15.0
**License:** MIT

---

## Build Commands

```bash
# Core Commands
bun install              # Install dependencies
bun run dev              # Development mode with watch (all packages)
bun run check            # Type check all packages
bun test                 # Run all tests

# Package-Specific
bun --filter mcp-server test           # Run MCP server tests only
bun --filter mcp-server check          # Type check MCP server only
bun --filter obsidian-plugin build     # Build plugin only

# Version & Release
bun run version [patch|minor|major]    # Bump version across all manifests
bun run release                        # Build all release artifacts
bun run zip                            # Create plugin zip for distribution

# Development Utilities
bun --filter mcp-server inspector      # MCP Inspector for debugging
bun --filter obsidian-plugin link      # Symlink to test vault
```

---

## Architecture

### High-Level Communication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Claude Desktop                               │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ MCP (stdio)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     MCP Server (Bun binary)                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────────┐  │
│  │ Tool        │  │ Authorization │  │ Dispatcher System         │  │
│  │ Registry    │  │ Scopes       │  │ (70% less context)        │  │
│  └─────────────┘  └──────────────┘  └───────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ HTTP POST (localhost)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Obsidian Plugin REST API                         │
│  - /search/smart (Smart Connections)                                │
│  - /templates/execute (Templater)                                   │
│  - Additional custom endpoints                                       │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ Obsidian API
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Obsidian Vault                                │
│  - Local REST API plugin (required)                                 │
│  - Smart Connections plugin (optional)                              │
│  - Templater plugin (optional)                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Package Structure

```
packages/
├── mcp-server/           # Standalone MCP server binary
│   ├── src/
│   │   ├── index.ts      # Entry point, env validation
│   │   ├── auth/         # OAuth-style permission scopes
│   │   ├── shared/       # Tool registry, utilities
│   │   └── features/     # Feature modules
│   └── dist/             # Compiled platform binaries
│
├── obsidian-plugin/      # Obsidian companion plugin
│   ├── src/
│   │   ├── main.ts       # Plugin entry, REST endpoints
│   │   ├── features/     # Feature modules
│   │   └── shared/       # Plugin utilities
│   └── docs/openapi.yaml # REST API specification
│
├── shared/               # Cross-package types/utilities
│   └── src/
│       ├── logger.ts     # Platform-aware logging
│       └── types/        # Shared type definitions
│
└── test-site/            # SvelteKit demo application
```

---

## Directory Structure

```
/home/user/obsidian-mcp-tools/
├── Root Configuration
│   ├── package.json           # Monorepo workspace (v0.2.27)
│   ├── manifest.json          # Obsidian plugin manifest
│   ├── versions.json          # Version compatibility tracking
│   ├── bun.lock               # Bun package lock
│   ├── .prettierrc.yaml       # Code formatting
│   ├── lefthook.yml           # Pre-commit hooks
│   ├── justfile               # Task runner
│   └── mise.toml              # Environment config
│
├── Documentation
│   ├── README.md              # Main project docs
│   ├── SECURITY.md            # Security policy (SLSA L3)
│   ├── CONTRIBUTING.md        # Development setup
│   ├── CLAUDE.md              # This file
│   ├── LICENSE                # MIT License
│   └── docs/
│       ├── ROADMAP.md         # Project roadmap
│       ├── project-architecture.md
│       ├── features/          # Feature specifications
│       ├── research/          # Technical research
│       └── roadmap/           # Detailed feature plans
│
├── CI/CD
│   └── .github/workflows/
│       ├── ci.yml             # Lint, test, build, audit
│       └── release.yml        # SLSA attestation, releases
│
├── Build Scripts
│   └── scripts/
│       └── version.ts         # Semver automation
│
└── packages/                  # Monorepo workspaces
    ├── mcp-server/            # ~3,300+ lines dispatcher system
    ├── obsidian-plugin/       # Svelte 5 UI, REST API
    ├── shared/                # ArkType schemas, types
    └── test-site/             # Vite + SvelteKit demo
```

---

## Feature Architecture

### MCP Server Features (`packages/mcp-server/src/features/`)

| Feature | Purpose | Key Files |
|---------|---------|-----------|
| `core/` | Server initialization, handler setup | `index.ts` |
| `local-rest-api/` | 25+ vault CRUD operations | `index.ts` |
| `smart-connections/` | Semantic search via Smart Connections | `index.ts` |
| `templates/` | Templater integration | `index.ts` |
| `fetch/` | Web content to markdown | `index.ts`, `services/markdown.ts` |
| `prompts/` | MCP prompts from vault | `index.ts` |
| `version/` | Version info tool | `index.ts` |
| `dispatchers/` | Unified tool system (3,300+ lines) | `vault.ts`, `config.ts`, `types.ts` |

### Obsidian Plugin Features (`packages/obsidian-plugin/src/features/`)

| Feature | Purpose | Key Files |
|---------|---------|-----------|
| `core/` | Plugin lifecycle, settings UI | `index.ts`, `SettingsTab.svelte` |
| `mcp-server-install/` | Binary management, Claude config | `services/install.ts`, `config.ts` |
| `dispatcher-settings/` | Dispatcher configuration UI | `index.ts` |

### Feature Module Pattern

Each feature is self-contained:

```typescript
// feature/index.ts
export async function setup(plugin: McpToolsPlugin): Promise<SetupResult> {
  // Initialize feature
  return { success: true } || { success: false, error: "reason" };
}
```

Features include their own `types.ts`, `services/`, `components/`, `constants/`, and `utils/` as needed.

---

## Key Patterns

### Tool Registry with ArkType

```typescript
import { type } from "arktype";

const toolSchema = type({
  name: '"tool_name"',
  arguments: { path: "string", content: "string?" }
}).describe("Tool description for Claude");

registry.register(toolSchema, async (request, context) => {
  // Handler returns { content: [{ type: "text", text: "..." }] }
});
```

### Module Augmentation for Settings

```typescript
declare module "obsidian" {
  interface McpToolsPluginSettings {
    featureName?: { setting1?: string };
  }
}
```

### Authorization Scopes

OAuth-style permission model (`auth/scopes.ts`):

```typescript
// Environment: OBSIDIAN_MCP_SCOPES
// Presets: readonly, editor, full, admin
// Granular: vault:read, vault:write, vault:delete, vault:move,
//           vault:search, vault:list, plugins:read, plugins:execute
// Wildcards: vault:*, plugins:*, admin:*
```

### Path Security

All path operations use:
- `validateVaultPath()` - Prevents `..`, absolute paths
- `assertNotProtected()` - Blocks hidden files, protected paths
- `assertNotReadonly()` - Respects `mcp-readonly` tag

---

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | 1.23.0 | MCP protocol implementation |
| `arktype` | 2.0.0-rc.30 | Runtime type validation |
| `obsidian-local-rest-api` | 2.5.4 | HTTP API for vault access |
| `svelte` | 5.17.5 | Plugin UI components |
| `turndown` | 7.2.0 | HTML to Markdown |
| `radash` | 12.1.0 | Utility functions |
| `express` | 4.21.2 | REST API serving |

---

## Testing

```bash
bun test                                       # All tests
bun test packages/mcp-server/src/**/*.test.ts  # Specific files
```

**Test files (7 total):**
- `auth/scopes.test.ts` - Authorization scope validation
- `features/dispatchers/config.test.ts` - Dispatcher config parsing
- `features/dispatchers/types.test.ts` - Operation types
- `features/dispatchers/vault.test.ts` - Vault operations
- `features/fetch/services/markdown.test.ts` - HTML→Markdown
- `shared/parseTemplateParameters.test.ts` - Template parameters
- `shared/validatePath.test.ts` - Path security

Tests use Bun's built-in test runner. Test files are colocated with source (`.test.ts` suffix).

---

## Development Setup

1. **Prerequisites:** Bun runtime, Git
2. `bun install`
3. `bun run dev` - Watches and rebuilds all packages
4. For plugin testing: `bun --filter obsidian-plugin link`
5. MCP Inspector: `bun --filter mcp-server inspector`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OBSIDIAN_API_KEY` | Yes | Authentication with Local REST API |
| `OBSIDIAN_MCP_SCOPES` | No | Permission scopes (default: `full`) |

---

## Security Model

### Binary Distribution
- **SLSA Level 3** provenance attestation
- SHA-256 checksum verification
- Verification: `gh attestation verify --owner jacksteamdev <binary>`

### Runtime Security
- Minimal permissions (user space only)
- Path traversal protection
- Input validation via ArkType
- No telemetry, no external network calls
- `mcp-readonly` tag support

### Data Privacy
- All processing local
- No data sent externally (except Claude Desktop)
- Platform-native log paths

---

## Build Targets

| Platform | Binary | Command |
|----------|--------|---------|
| Linux x64 | `mcp-server-linux` | `bun run build:linux` |
| macOS ARM64 | `mcp-server-macos-arm64` | `bun run build:mac-arm64` |
| macOS x64 | `mcp-server-macos-x64` | `bun run build:mac-x64` |
| Windows x64 | `mcp-server-windows.exe` | `bun run build:windows` |

---

## Modernization Roadmap (December 2025)

### Completed
- [x] OAuth-style authorization scopes
- [x] Bulk operations (delete, move, rename)
- [x] Vault hygiene tools (orphans, broken links, duplicates)
- [x] SLSA Level 3 binary attestation
- [x] Path traversal protection
- [x] CI/CD with security audits
- [x] MCP SDK upgrade to 1.23.0

### In Progress / Planned
- [ ] Unified dispatcher system (reduce 21+ tools → ~5)
- [ ] Tool-as-Code execution pattern
- [ ] MCP resources for vault metadata
- [ ] Secure API key storage (platform credential managers)
- [ ] SSRF protection for fetch tool
- [ ] TLS certificate pinning
- [ ] Rate limiting on API endpoints
- [ ] OpenTelemetry tracing
- [ ] >70% test coverage

### Technical Debt
- [ ] Dependency injection container
- [ ] Extract Obsidian types from shared
- [ ] Third-party plugin adapter layer
- [ ] Circuit breaker for plugin dependencies
- [ ] Plugin lifecycle management service

See `docs/ROADMAP.md` for full details.

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `packages/mcp-server/src/index.ts` | Server entry point |
| `packages/mcp-server/src/features/dispatchers/vault.ts` | Vault operations (~800 lines) |
| `packages/mcp-server/src/shared/ToolRegistry.ts` | Tool registration |
| `packages/mcp-server/src/auth/scopes.ts` | Authorization (~206 lines) |
| `packages/obsidian-plugin/src/main.ts` | Plugin entry (~232 lines) |
| `packages/obsidian-plugin/bun.config.ts` | Svelte build config |
| `.github/workflows/ci.yml` | CI pipeline |
| `.github/workflows/release.yml` | Release automation |

---

## Common Tasks

### Adding a New MCP Tool

1. Create tool schema with ArkType in appropriate feature
2. Register with `registry.register(schema, handler)`
3. Add authorization scope check if needed
4. Add tests in colocated `.test.ts` file
5. Update `docs/ROADMAP.md` if significant feature

### Adding a Plugin Feature

1. Create feature directory under `src/features/`
2. Export `setup()` function in `index.ts`
3. Add module augmentation for settings in `types.ts`
4. Register in main plugin initialization
5. Add UI components as needed with Svelte 5

### Debugging MCP Communication

```bash
# Start MCP Inspector
bun --filter mcp-server inspector

# Check server logs
# macOS: ~/Library/Logs/obsidian-mcp-tools/
# Linux: ~/.local/share/obsidian-mcp-tools/logs/
# Windows: %APPDATA%\obsidian-mcp-tools\logs\
```
