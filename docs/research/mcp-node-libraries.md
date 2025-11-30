# MCP Libraries for Node.js - Research Notes

Research into available MCP libraries for Node.js/TypeScript, comparing options for this project.

## Current State

This project uses:
- `@modelcontextprotocol/sdk` v1.0.4 (official SDK)
- `arktype` for schema validation (custom `ToolRegistry` abstraction)
- `zod` as peer dependency (required by SDK)
- Stdio transport only

## Available Libraries

### 1. Official TypeScript SDK

**Package:** `@modelcontextprotocol/sdk`
**GitHub:** [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)
**Current Version:** 1.23.0 (we're on 1.0.4 - significantly behind)
**Downloads:** 8.5M+

#### Pros

- Official implementation, spec-compliant
- Low-level primitives for maximum control
- Multiple transports: stdio, Streamable HTTP
- ResourceLinks for efficient large file handling
- Context-aware completion for resource templates
- Structured content (text + data simultaneously)

#### Cons

- More boilerplate than alternatives
- Requires manual server lifecycle management
- No built-in session handling
- No authentication helpers

#### New Features Since 1.0.4

- ResourceLinks (return references instead of embedding content)
- Streamable HTTP transport
- Improved schema validation (Zod v4 support)
- Dynamic server capabilities

### 2. FastMCP

**Package:** `fastmcp`
**GitHub:** [punkpeye/fastmcp](https://github.com/punkpeye/fastmcp)
**Current Version:** 3.24.0

#### Pros

- Built on official SDK (not a fork)
- Dramatically less boilerplate
- Multiple schema libraries: Zod, ArkType, Valibot
- Built-in transports: stdio, HTTP streaming, SSE fallback
- Stateless mode for serverless deployments
- Tool-level access control (`canAccess` callback)
- Session and request ID tracking
- Health-check endpoint
- CORS enabled by default
- Streaming output support
- Progress notifications

#### Cons

- Additional dependency layer
- Higher learning curve than ultra-simple options
- More opinionated (less flexibility)

#### Notable for This Project

- **ArkType support** - we already use ArkType, so migration would be smooth
- **Stateless mode** - enables serverless deployment patterns
- **Tool-level access control** - could replace our scope system or complement it

### 3. EasyMCP

**Package:** `easymcp`

#### Pros

- Absolute minimum boilerplate
- Express-like API
- Ideal for prototyping

#### Cons

- Less production-ready
- Fewer features than FastMCP
- Smaller community

## Recommendations

### Short Term: Update Official SDK

**Action:** Upgrade `@modelcontextprotocol/sdk` from 1.0.4 → 1.23.0

We're 22+ versions behind. The newer SDK includes:
- ResourceLinks (critical for large vault files)
- Better transport options
- Improved error handling

**Risk:** Low - same API, backward compatible
**Effort:** Small

### Medium Term: Evaluate FastMCP Migration

**Action:** Prototype one feature module with FastMCP

Benefits for this project:
1. **ArkType already in use** - FastMCP supports it natively
2. **Scope enforcement** - `canAccess` could integrate with our scope system
3. **HTTP transport** - enables the Docker/home server use case
4. **Stateless mode** - future serverless deployment option
5. **Less boilerplate** - our `ToolRegistry` abstraction does similar things

**Risk:** Medium - API changes required
**Effort:** Medium (1-2 days to prototype)

### Long Term: Consider Transport Options

Current: stdio only (requires local binary)

Options with updated libraries:
- **HTTP Streaming** - remote access (with proper auth)
- **SSE fallback** - browser-compatible
- **Stateless HTTP** - serverless functions

This ties into the "headless Obsidian" aspiration in `interesting-uses.md`.

## Migration Path

```
Current                    Short Term              Medium Term
───────                    ──────────              ───────────
@mcp/sdk 1.0.4      →     @mcp/sdk 1.23.0    →   FastMCP 3.x
Custom ToolRegistry  →     Keep ToolRegistry  →   FastMCP patterns
Stdio only          →     Stdio + resources  →   HTTP streaming
Manual scopes       →     Keep scopes        →   canAccess integration
```

## Decision Matrix

| Criteria | Official SDK | FastMCP | EasyMCP |
|----------|--------------|---------|---------|
| Spec compliance | ★★★★★ | ★★★★☆ | ★★★☆☆ |
| Boilerplate | ★★☆☆☆ | ★★★★★ | ★★★★★ |
| Transport options | ★★★★☆ | ★★★★★ | ★★★☆☆ |
| Auth/session handling | ★★☆☆☆ | ★★★★★ | ★★☆☆☆ |
| ArkType support | ★★★☆☆ | ★★★★★ | ★★☆☆☆ |
| Community/maintenance | ★★★★★ | ★★★★☆ | ★★☆☆☆ |
| Migration effort | ★★★★★ | ★★★☆☆ | ★★★☆☆ |

## Sources

- [Official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [FastMCP GitHub](https://github.com/punkpeye/fastmcp)
- [Comparing MCP Server Frameworks](https://medium.com/@FrankGoortani/comparing-model-context-protocol-mcp-server-frameworks-03df586118fd)
- [MCP Framework Comparison - MCPVerified](https://mcpverified.com/server-frameworks/comparison)
