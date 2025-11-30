# Roadmap

Project roadmap for MCP Tools for Obsidian.

## Status Legend

| Status | Description |
|--------|-------------|
| `idea` | Under consideration |
| `planned` | Accepted, not started |
| `in-progress` | Actively being worked on |
| `done` | Completed |

## P0 - Bugs & Blockers

Critical issues that block core functionality.

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Special character handling in delete | `planned` | High | Medium | `obsidian_delete_note` fails on apostrophes, commas, emoji, curly quotes - path resolution bug (in cyanheads/obsidian-mcp-server, not this project) |

## Features

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Unified tool dispatch with dynamic plugin detection | `idea` | High | Large | [unified-tool-dispatch.md](roadmap/unified-tool-dispatch.md) - Reduce 21+ tools to ~5 dispatchers with dictionary-style operation lookup |
| MCP resources for vault metadata | `idea` | High | Medium | Expose vault structure, recent files, and statistics as resources with dynamic URIs |
| MCP sampling API for autonomous operations | `idea` | High | Large | Allow LLM to propose and execute multi-step vault operations |
| MCP tool result streaming | `idea` | Medium | Medium | Use progress notifications for long-running searches and bulk updates |

## Technical Debt

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Dependency injection container | `idea` | High | Large | Decouple feature initialization from plugin lifecycle, improve testability |
| Extract Obsidian types from shared package | `idea` | High | Medium | Break circular dependencies, improve package independence |
| Third-party plugin adapter layer | `idea` | High | Large | Isolate breaking changes, enable versioned compatibility |
| Research plugin decoupling | `idea` | High | Medium | Evaluate removing dependencies on Local REST API, Smart Connections, Templater - native Obsidian API alternatives |
| Plugin lifecycle management service | `idea` | High | Large | Coordinate feature setup/teardown, handle initialization ordering |
| Circuit breaker for plugin dependencies | `idea` | Medium | Medium | Handle graceful degradation when dependencies unavailable |
| Domain boundaries between features | `idea` | Medium | Large | Clear API contracts to prevent feature coupling |
| Error boundary abstraction | `idea` | Medium | Medium | Standardize error handling, prevent error propagation |
| Decompose settings component into smaller parts | `idea` | Medium | Small | Split McpServerInstallSettings into StatusDisplay, DependencyList, ResourceLinks |
| Logger dependency injection | `idea` | Low | Small | Replace global singleton for better testability |

## UX Improvements

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Comprehensive accessibility features | `idea` | High | Medium | ARIA labels, keyboard navigation, semantic HTML, focus management, screen reader support |
| Detailed JSON Schema validation errors | `idea` | Medium | Small | Provide specific parameter errors instead of generic validation failures |
| Design system with CSS custom properties | `idea` | Medium | Small | Replace hardcoded styles with design tokens that integrate with Obsidian theme variables |
| Error boundaries and loading states | `idea` | Medium | Small | Add loading spinners, error displays, retry mechanisms using Svelte 5 snippets |

## Infrastructure

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Create comprehensive test suite | `idea` | High | Large | >70% coverage goal for mcp-server and obsidian-plugin packages |
| Create automated setup script | `idea` | High | Medium | Achieve <5min clone-to-running for new contributors |
| OpenTelemetry tracing integration | `idea` | High | Medium | Instrument tool calls, API requests, and template execution with spans |
| Evaluate FastMCP migration | `idea` | Medium | Medium | [punkpeye/fastmcp](https://github.com/punkpeye/fastmcp) - ArkType support, HTTP streaming, `canAccess` auth, less boilerplate |
| Add plugin linking/debugging docs | `idea` | Medium | Small | Step-by-step local development workflow documentation |
| Implement test coverage reporting | `idea` | Medium | Small | Codecov or similar integration in CI for visibility |
| TypeScript checking for Svelte files | `idea` | Medium | Small | Add svelte-check integration to catch type errors in .svelte components |
| Vitest tests for Svelte components | `idea` | Medium | Medium | Setup Vitest with @testing-library/svelte, write component tests, integrate with CI |
| Hot Module Replacement for dev mode | `idea` | Medium | Medium | Implement HMR for faster Svelte iteration, may require custom plugin reload logic |

## Security

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Secure API key storage with platform credential managers | `idea` | High | Medium | Replace plaintext storage with Keychain (macOS), Credential Manager (Windows), Secret Service (Linux) |
| SSRF protection for fetch tool | `idea` | High | Medium | URL allowlist/blocklist, private IP blocking (RFC1918, localhost), configurable domain restrictions |
| TLS certificate pinning for Local REST API | `idea` | High | Medium | Replace global TLS bypass with targeted self-signed cert pinning, validate only localhost connections |
| Rate limiting on API endpoints | `idea` | Medium | Medium | Token bucket algorithm with configurable limits per tool/endpoint to prevent abuse/DoS |
| Security headers and request signing | `idea` | Medium | Medium | CSP headers, request signing/authentication between plugin and MCP server for localhost API |

---

## Completed

Items that have been shipped.

### Features

| Item | Details |
|------|---------|
| Tool-as-Code execution | QuickJS WebAssembly sandbox for JavaScript execution against vault API |
| MCP authorization scopes | OAuth-style scopes (readonly, editor, full) via OBSIDIAN_MCP_SCOPES env var |
| Add `move_note` tool | `move_vault_file` and `rename_vault_file` tools |
| Bulk delete operations | `bulk_delete_by_pattern`, `bulk_delete_by_regex`, `bulk_delete_by_query` with dry-run |
| Delete by frontmatter query | `delete_by_frontmatter` tool |
| Find duplicate notes | `find_duplicate_notes` tool - detect dupes by filename/content hash |
| Bulk move operations | `bulk_move_files` tool with flatten option |
| Bulk rename operations | `bulk_rename_files` tool with templates and frontmatter fields |
| Find orphan attachments | `find_orphan_attachments` tool |
| Find broken links | `find_broken_links` tool |
| Find empty notes | `find_empty_notes` tool |
| Find low value notes | `find_low_value_notes` tool - score notes by content richness |

### Infrastructure

| Item | Details |
|------|---------|
| Add Justfile with common tasks | Single command for setup, dev, check, test, release |
| Implement lefthook pre-commit hooks | Parallel lint/typecheck/test execution |
| Add .claude/commands for workflows | Commands for setup, check, dev, and test |
| Add CI workflow for PR validation | `.github/workflows/ci.yml` - lint, typecheck, test, build, security audit |
| MCP health check and capabilities resource | `health://status` and `health://capabilities` resources |
| Structured logging with context propagation | AsyncLocalStorage request context, structured JSON output |
| Automated dependency vulnerability scanning | Included in CI workflow |
| Research MCP libraries for Node | [mcp-node-libraries.md](research/mcp-node-libraries.md) |
| Upgrade @modelcontextprotocol/sdk to 1.23.0 | ResourceLinks, HTTP streaming, better error handling |

### Security

| Item | Details |
|------|---------|
| Binary integrity verification | SHA-256 checksum validation for downloaded MCP server binaries |
| Path traversal protection | Vault root boundary enforcement, normalized path validation |
| Log output sanitization | `sanitizeForLog()` with 59 test cases |
| Input size limits and validation | LIMITS constants and validators |

### Technical Debt

| Item | Details |
|------|---------|
| Fix inverted dev mode in build config | Changed bun.config.ts dev: isProd to dev: !isProd |
