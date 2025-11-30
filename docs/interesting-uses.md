# Interesting Use Cases

Ideas and aspirations for creative deployments of obsidian-mcp-tools.

## Headless Obsidian Server

Run Obsidian in a Docker container with the MCP server exposed for tool connections on a home server.

**Architecture:**

```
┌─────────────────────────────────────────────────┐
│                  Home Server                     │
│  ┌───────────────────────────────────────────┐  │
│  │           Docker Container                 │  │
│  │  ┌─────────────┐    ┌──────────────────┐  │  │
│  │  │  Obsidian   │────│  Local REST API  │  │  │
│  │  │  (headless) │    │     Plugin       │  │  │
│  │  └─────────────┘    └────────┬─────────┘  │  │
│  │         │                    │            │  │
│  │         ▼                    ▼            │  │
│  │  ┌─────────────┐    ┌──────────────────┐  │  │
│  │  │   Vault     │    │   MCP Server     │  │  │
│  │  │  (volume)   │    │   (stdio/SSE)    │  │  │
│  │  └─────────────┘    └────────┬─────────┘  │  │
│  └──────────────────────────────┼────────────┘  │
│                                 │               │
└─────────────────────────────────┼───────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    ▼                           ▼
            ┌─────────────┐             ┌─────────────┐
            │ Claude Code │             │  Other MCP  │
            │   Client    │             │   Clients   │
            └─────────────┘             └─────────────┘
```

**Why this is interesting:**

- Central knowledge base accessible from any MCP client
- Vault persisted on reliable storage with backups
- Always-on availability for AI assistants
- Scopes provide per-client access control

**Security considerations:**

- Network exposure requires careful firewall rules
- Current scope system is authorization only (no authentication)
- Would benefit from proper authn layer (API keys, mTLS, etc.)
- Consider VPN/Tailscale for remote access instead of public exposure

## Full AuthN/AuthZ Stack (Aspirational)

> **Note:** This is probably a terrible idea for security reasons. Rolling your own auth is fraught with pitfalls. But it would be neat.

The current scope system provides authorization (what can you do?) but not authentication (who are you?). A full stack might look like:

```
┌──────────────────────────────────────────────────────┐
│                    Auth Layer                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │  API Keys  │  │   mTLS     │  │  OAuth2/OIDC   │  │
│  │  (simple)  │  │  (certs)   │  │  (overkill?)   │  │
│  └─────┬──────┘  └─────┬──────┘  └───────┬────────┘  │
│        └───────────────┴─────────────────┘           │
│                        │                              │
│                        ▼                              │
│              ┌─────────────────┐                     │
│              │  Identity →     │                     │
│              │  Scope Mapping  │                     │
│              └────────┬────────┘                     │
│                       │                              │
└───────────────────────┼──────────────────────────────┘
                        ▼
              ┌─────────────────┐
              │  Current Scope  │
              │  Enforcement    │
              └─────────────────┘
```

**If someone actually wanted to do this properly:**

- Use an existing auth proxy (OAuth2 Proxy, Pomerium, etc.)
- Map authenticated identities to scope presets
- Never roll your own crypto or session management
- Consider the threat model carefully (local network vs internet exposure)

## Multi-Vault Federation

Connect multiple Obsidian vaults through a single MCP endpoint with routing:

```
MCP Client
    │
    ▼
┌─────────────────┐
│  MCP Router     │
│  (scope-aware)  │
└───────┬─────────┘
        │
   ┌────┴────┬────────────┐
   ▼         ▼            ▼
┌──────┐  ┌──────┐  ┌──────────┐
│ Work │  │ Personal│ │ Shared  │
│ Vault│  │ Vault  │ │ Vault   │
└──────┘  └──────┘  └──────────┘
```

Scopes could be extended: `vault:work:read`, `vault:personal:*`, etc.
