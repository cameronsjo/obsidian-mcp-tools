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
| Response size optimization | `planned` | Critical | Medium | [response-size-optimization.md](roadmap/response-size-optimization.md) - Tools return 25k+ tokens, exhausting LLM context. Add pagination/limits to all data-returning tools |
| Special character handling in delete | `planned` | High | Medium | `obsidian_delete_note` fails on apostrophes, commas, emoji, curly quotes - path resolution bug (in cyanheads/obsidian-mcp-server, not this project) |
| Add `move_note` tool | `done` | High | Small | `move_vault_file` and `rename_vault_file` tools added |
| Bulk delete operations | `done` | High | Medium | `bulk_delete_by_pattern`, `bulk_delete_by_regex`, `bulk_delete_by_query` tools added with dry-run safety |

## Features

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Unified tool dispatch with dynamic plugin detection | `done` | High | Large | [unified-tool-dispatch.md](roadmap/unified-tool-dispatch.md) - Reduces 21+ tools to 4 dispatchers (vault, active_file, plugin, discover) with configurable behavior |
| MCP authorization scopes | `idea` | High | Medium | [mcp-authorization-scopes.md](roadmap/mcp-authorization-scopes.md) - OAuth-style scopes (readonly, editor, full) per API key |
| Tool-as-Code execution | `idea` | High | Medium | [tool-as-code.md](roadmap/tool-as-code.md) - Single `execute` tool for JavaScript code against vault API per [Anthropic's pattern](https://www.anthropic.com/engineering/code-execution-with-mcp) |
| Delete by frontmatter query | `done` | High | Medium | `delete_by_frontmatter` tool - delete files by field value with operators (equals, contains, regex, etc.) |
| Find duplicate notes | `done` | High | Medium | `find_duplicate_notes` tool - detects dupes by filename/content hash |
| Bulk move operations | `done` | High | Medium | `bulk_move_files` tool - move files by glob/regex/search to destination with flatten option |
| Bulk rename operations | `done` | Medium | Medium | `bulk_rename_files` tool - rename by template with {frontmatter.field}, prefix/suffix, or regex replace |
| Find orphan attachments | `done` | Medium | Small | `find_orphan_attachments` tool - finds images/PDFs/etc not referenced by any note |
| Find broken links | `done` | Medium | Small | `find_broken_links` tool - finds [[wikilinks]] pointing to non-existent files |
| Find empty notes | `done` | Low | Small | `find_empty_notes` tool - finds notes with only frontmatter/whitespace/template |
| Find low value notes | `done` | Medium | Small | `find_low_value_notes` tool - scores notes by frontmatter, content, words, tags, links |
| MCP resources for vault metadata | `idea` | High | Medium | Expose vault structure, recent files, and statistics as resources with dynamic URIs |
| MCP sampling API for autonomous operations | `idea` | High | Large | Allow LLM to propose and execute multi-step vault operations |
| MCP tool result streaming | `idea` | Medium | Medium | Use progress notifications for long-running searches and bulk updates |

## Performance

| Item | Status | Impact | Effort | Details |
|------|--------|--------|--------|---------|
| Load testing infrastructure | `idea` | High | Medium | [load-testing.md](roadmap/load-testing.md) - Benchmarks, test vault generator, performance budgets, CI regression detection |
| Response streaming for large results | `idea` | Medium | Medium | Stream responses for large file reads and search results to reduce memory pressure |
| Caching layer for repeated queries | `idea` | Medium | Medium | LRU cache for file metadata, search results, plugin status checks |

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
| Add .claude/commands for workflows | `done` | Medium | Small | `/setup`, `/check`, `/test`, `/ready` commands for Claude Code workflows |
| Add CI workflow for PR validation | `idea` | High | Medium | Lint, typecheck, test, build validation to catch issues before merge |
| Create automated setup script | `idea` | High | Medium | Achieve <5min clone-to-running for new contributors |
| Add plugin linking/debugging docs | `idea` | Medium | Small | Step-by-step local development workflow documentation |
| Implement test coverage reporting | `idea` | Medium | Small | Codecov or similar integration in CI for visibility |
| OpenTelemetry tracing integration | `idea` | High | Medium | Instrument tool calls, API requests, and template execution with spans |
| PII sanitization layer | `idea` | High | Medium | Redact sensitive data before returning to LLM clients |
| MCP health check and capabilities resource | `idea` | Medium | Small | Expose server status, API version, and feature availability |
| Structured logging with context propagation | `idea` | Medium | Small | Add request IDs, tool names, and user context to all log entries |
| Automated dependency vulnerability scanning | `idea` | High | Small | npm audit, Snyk, or similar in CI/CD with PR blocking for high/critical CVEs and SBOM generation |
| TypeScript checking for Svelte files | `idea` | Medium | Small | Add svelte-check integration to catch type errors in .svelte components |
| Vitest tests for Svelte components | `idea` | Medium | Medium | Setup Vitest with @testing-library/svelte, write component tests, integrate with CI |
| Hot Module Replacement for dev mode | `idea` | Medium | Medium | Implement HMR for faster Svelte iteration, may require custom plugin reload logic |
| Research MCP libraries for Node | `idea` | High | Small | Evaluate MCP SDK options, transport mechanisms, and best practices for Node.js MCP servers |

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
