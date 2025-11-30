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
| Add `move_note` tool | `done` | High | Small | `move_vault_file` and `rename_vault_file` tools added |
| Bulk delete operations | `done` | High | Medium | `bulk_delete_by_pattern`, `bulk_delete_by_regex`, `bulk_delete_by_query` tools added with dry-run safety |

## Features

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Unified tool dispatch with dynamic plugin detection | `idea` | High | Large | [unified-tool-dispatch.md](roadmap/unified-tool-dispatch.md) - Reduce 21+ tools to ~5 dispatchers with dictionary-style operation lookup |
| MCP authorization scopes | `done` | High | Medium | [mcp-authorization-scopes.md](roadmap/mcp-authorization-scopes.md) - OAuth-style scopes (readonly, editor, full) via OBSIDIAN_MCP_SCOPES env var |
| Tool-as-Code execution | `idea` | High | Medium | [tool-as-code.md](roadmap/tool-as-code.md) - Single `execute` tool for JavaScript code against vault API per [Anthropic's pattern](https://www.anthropic.com/engineering/code-execution-with-mcp) |
| Delete by frontmatter query | `done` | High | Medium | `delete_by_frontmatter` tool - delete files where frontmatter matches criteria |
| Find duplicate notes | `done` | High | Medium | `find_duplicate_notes` tool - detect dupes by filename/content hash |
| Bulk move operations | `done` | High | Medium | `bulk_move_files` tool - move multiple files with flatten option |
| Bulk rename operations | `done` | Medium | Medium | `bulk_rename_files` tool - rename with templates and frontmatter fields |
| Find orphan attachments | `done` | Medium | Small | `find_orphan_attachments` tool - detects unreferenced images, PDFs, media files |
| Find broken links | `done` | Medium | Small | `find_broken_links` tool - detects wiki links pointing to non-existent files |
| Find empty notes | `done` | Low | Small | `find_empty_notes` tool - find notes with only frontmatter or minimal content |
| Find low value notes | `done` | Medium | Small | `find_low_value_notes` tool - score notes by content richness |
| MCP resources for vault metadata | `idea` | High | Medium | Expose vault structure, recent files, and statistics as resources with dynamic URIs |
| MCP sampling API for autonomous operations | `idea` | High | Large | Allow LLM to propose and execute multi-step vault operations |
| MCP tool result streaming | `idea` | Medium | Medium | Use progress notifications for long-running searches and bulk updates |

## Performance

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|

## Technical Debt

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Dependency injection container | `idea` | High | Large | Decouple feature initialization from plugin lifecycle, improve testability |
| Extract Obsidian types from shared package | `idea` | High | Medium | Break circular dependencies, improve package independence |
| Third-party plugin adapter layer | `idea` | High | Large | Isolate breaking changes, enable versioned compatibility |
| Circuit breaker for plugin dependencies | `idea` | Medium | Medium | Handle graceful degradation when dependencies unavailable |
| Domain boundaries between features | `idea` | Medium | Large | Clear API contracts to prevent feature coupling |
| Error boundary abstraction | `idea` | Medium | Medium | Standardize error handling, prevent error propagation |
| Logger dependency injection | `idea` | Low | Small | Replace global singleton for better testability |
| Research plugin decoupling | `idea` | High | Medium | Evaluate removing dependencies on Local REST API, Smart Connections, Templater - native Obsidian API alternatives |
| Plugin lifecycle management service | `idea` | High | Large | Coordinate feature setup/teardown, handle initialization ordering |
| Fix inverted dev mode in build config | `done` | High | Small | Change bun.config.ts line 37 from dev: isProd to dev: !isProd |
| Decompose settings component into smaller parts | `idea` | Medium | Small | Split McpServerInstallSettings into StatusDisplay, DependencyList, ResourceLinks |

## UX Improvements

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Detailed JSON Schema validation errors | `idea` | Medium | Small | Provide specific parameter errors instead of generic validation failures |
| Comprehensive accessibility features | `idea` | High | Medium | ARIA labels, keyboard navigation, semantic HTML, focus management, screen reader support |
| Design system with CSS custom properties | `idea` | Medium | Small | Replace hardcoded styles with design tokens that integrate with Obsidian theme variables |
| Error boundaries and loading states | `idea` | Medium | Small | Add loading spinners, error displays, retry mechanisms using Svelte 5 snippets |

## Infrastructure

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Add Justfile with common tasks | `done` | High | Small | Single command for setup, dev, check, test, release with <1s task discovery |
| Implement lefthook pre-commit hooks | `done` | High | Small | Parallel lint/typecheck/test execution to catch issues before commit |
| Create comprehensive test suite | `idea` | High | Large | >70% coverage goal for mcp-server and obsidian-plugin packages |
| Add .claude/commands for workflows | `idea` | Medium | Small | Commands for setup, check, ready, and test to streamline Claude Code workflows |
| Add CI workflow for PR validation | `done` | High | Medium | `.github/workflows/ci.yml` - lint, typecheck, test, build, security audit |
| Create automated setup script | `idea` | High | Medium | Achieve <5min clone-to-running for new contributors |
| Add plugin linking/debugging docs | `idea` | Medium | Small | Step-by-step local development workflow documentation |
| Implement test coverage reporting | `idea` | Medium | Small | Codecov or similar integration in CI for visibility |
| OpenTelemetry tracing integration | `idea` | High | Medium | Instrument tool calls, API requests, and template execution with spans |
| PII sanitization layer | `idea` | High | Medium | Redact sensitive data before returning to LLM clients |
| MCP health check and capabilities resource | `idea` | Medium | Small | Expose server status, API version, and feature availability |
| Structured logging with context propagation | `idea` | Medium | Small | Add request IDs, tool names, and user context to all log entries |
| Automated dependency vulnerability scanning | `done` | High | Small | Included in CI workflow - audit-ci and dependency-check |
| TypeScript checking for Svelte files | `idea` | Medium | Small | Add svelte-check integration to catch type errors in .svelte components |
| Vitest tests for Svelte components | `idea` | Medium | Medium | Setup Vitest with @testing-library/svelte, write component tests, integrate with CI |
| Hot Module Replacement for dev mode | `idea` | Medium | Medium | Implement HMR for faster Svelte iteration, may require custom plugin reload logic |
| Research MCP libraries for Node | `done` | High | Small | [mcp-node-libraries.md](research/mcp-node-libraries.md) - Evaluated official SDK, FastMCP, EasyMCP |
| Upgrade @modelcontextprotocol/sdk to 1.23.0 | `done` | High | Small | Upgraded from 1.0.4, includes ResourceLinks, HTTP streaming, better error handling |
| Evaluate FastMCP migration | `idea` | Medium | Medium | [punkpeye/fastmcp](https://github.com/punkpeye/fastmcp) - ArkType support, HTTP streaming, `canAccess` auth, less boilerplate |

## Security

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Secure API key storage with platform credential managers | `idea` | High | Medium | Replace plaintext storage with Keychain (macOS), Credential Manager (Windows), Secret Service (Linux) |
| SSRF protection for fetch tool | `idea` | High | Medium | URL allowlist/blocklist, private IP blocking (RFC1918, localhost), configurable domain restrictions |
| TLS certificate pinning for Local REST API | `idea` | High | Medium | Replace global TLS bypass with targeted self-signed cert pinning, validate only localhost connections |
| Binary integrity verification | `done` | High | Small | SHA-256 checksum validation for downloaded MCP server binaries before execution |
| Path traversal protection | `done` | High | Small | Vault root boundary enforcement, normalized path validation, reject .. and absolute paths outside vault |
| Log output sanitization | `idea` | Medium | Small | Prevent API key/PII leakage, redact process.env logging, add PII detection patterns |
| Rate limiting on API endpoints | `idea` | Medium | Medium | Token bucket algorithm with configurable limits per tool/endpoint to prevent abuse/DoS |
| Input size limits and validation | `idea` | Medium | Small | Prevent resource exhaustion for file content, template parameters, search queries, fetch URLs |
| Security headers and request signing | `idea` | Medium | Medium | CSP headers, request signing/authentication between plugin and MCP server for localhost API |
