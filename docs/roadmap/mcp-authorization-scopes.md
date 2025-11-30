# Feature: MCP Authorization Scopes

> OAuth-style permission scopes to control what operations MCP clients can perform on your vault.

## Status

- **Status**: idea
- **Priority**: High
- **Effort**: Medium

## Problem

### Current State

The MCP server has a single API key that grants **full access** to all operations:
- Read any file
- Write/modify any file
- Delete any file
- Execute templates
- Search everything

This is an all-or-nothing model with no granularity.

### Why This Matters

1. **Different clients, different trust levels**: You might trust Claude Desktop with full access but want a third-party MCP client to only read files
2. **Accident prevention**: A "readonly" mode prevents accidental destructive operations during exploration
3. **Shared vaults**: Multiple users/clients accessing the same vault with different permission levels
4. **Audit requirements**: Some users need to prove certain clients can't modify data
5. **Defense in depth**: Even if an API key leaks, limited scopes reduce blast radius

### User Stories

- "I want to let this new AI tool browse my vault but not change anything until I trust it"
- "I want my phone client to only read and search, not delete"
- "I want to create a 'safe mode' API key for experimenting"

## Proposed Solution

### OAuth-Inspired Scope Model

Define permission scopes similar to OAuth2, granted per API key:

```
vault:read      - Read file contents and metadata
vault:write     - Create and modify files
vault:delete    - Delete files
vault:move      - Move and rename files
vault:search    - Search vault contents
vault:list      - List files and directories
plugins:read    - Read plugin data (dataview queries, etc.)
plugins:execute - Execute plugin operations (templates, etc.)
admin:*         - Full access (current behavior)
```

### Scope Hierarchy

```
admin:*
├── vault:*
│   ├── vault:read
│   ├── vault:write
│   ├── vault:delete
│   ├── vault:move
│   ├── vault:search
│   └── vault:list
└── plugins:*
    ├── plugins:read
    └── plugins:execute
```

### Preset Scope Bundles

| Preset | Scopes | Use Case |
|--------|--------|----------|
| `readonly` | vault:read, vault:list, vault:search, plugins:read | Safe exploration |
| `editor` | readonly + vault:write | Can create/edit but not delete |
| `full` | All scopes except admin | Normal usage |
| `admin` | admin:* | Full control including settings |

### Configuration

#### Option A: Scoped API Keys

Multiple API keys with different scopes in plugin settings:

```yaml
# .obsidian/plugins/mcp-tools/data.json
{
  "apiKeys": [
    {
      "key": "mcp_abc123...",
      "name": "Claude Desktop",
      "scopes": ["admin:*"],
      "created": "2024-01-15T..."
    },
    {
      "key": "mcp_def456...",
      "name": "Mobile Client",
      "scopes": ["vault:read", "vault:search", "vault:list"],
      "created": "2024-01-20T..."
    },
    {
      "key": "mcp_readonly...",
      "name": "Safe Mode",
      "scopes": ["readonly"],  // Preset bundle
      "created": "2024-01-25T..."
    }
  ]
}
```

#### Option B: Header-Based Scope Request

Client requests specific scopes, server grants intersection with allowed:

```http
POST /vault/file.md
Authorization: Bearer mcp_abc123...
X-MCP-Scopes: vault:read vault:write
```

Server responds with granted scopes:
```http
X-MCP-Granted-Scopes: vault:read vault:write
```

### Enforcement Points

```typescript
// Middleware checks scope before operation
async function requireScope(scope: Scope, handler: Handler): Handler {
  return async (request, context) => {
    const apiKey = extractApiKey(request);
    const grantedScopes = await getScopes(apiKey);

    if (!hasScope(grantedScopes, scope)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Operation requires scope: ${scope}. ` +
        `Granted scopes: ${grantedScopes.join(", ")}`
      );
    }

    return handler(request, context);
  };
}

// Usage in tool registration
tools.register(
  deleteVaultFileSchema,
  requireScope("vault:delete", handleDeleteVaultFile)
);
```

### Scope Requirements by Operation

| Operation | Required Scope |
|-----------|---------------|
| get_vault_file, get_active_file | vault:read |
| list_vault_files | vault:list |
| search_vault, search_vault_simple | vault:search |
| create_vault_file, update_active_file, append_*, patch_* | vault:write |
| delete_vault_file, delete_active_file, bulk_delete_files | vault:delete |
| move_vault_file, rename_vault_file | vault:move |
| execute_template | plugins:execute |
| semantic_search (Smart Connections) | plugins:read |

## Implementation Details

### MCP Server Changes

```typescript
// packages/mcp-server/src/auth/scopes.ts

export const SCOPES = {
  VAULT_READ: "vault:read",
  VAULT_WRITE: "vault:write",
  VAULT_DELETE: "vault:delete",
  VAULT_MOVE: "vault:move",
  VAULT_SEARCH: "vault:search",
  VAULT_LIST: "vault:list",
  PLUGINS_READ: "plugins:read",
  PLUGINS_EXECUTE: "plugins:execute",
  ADMIN: "admin:*",
} as const;

export const PRESETS = {
  readonly: [SCOPES.VAULT_READ, SCOPES.VAULT_LIST, SCOPES.VAULT_SEARCH, SCOPES.PLUGINS_READ],
  editor: [...PRESETS.readonly, SCOPES.VAULT_WRITE],
  full: Object.values(SCOPES).filter(s => s !== SCOPES.ADMIN),
  admin: [SCOPES.ADMIN],
};

export function hasScope(granted: string[], required: string): boolean {
  // admin:* grants everything
  if (granted.includes(SCOPES.ADMIN)) return true;

  // Check exact match
  if (granted.includes(required)) return true;

  // Check wildcard (vault:* includes vault:read)
  const [category] = required.split(":");
  if (granted.includes(`${category}:*`)) return true;

  return false;
}
```

### Obsidian Plugin Changes

1. **Settings UI**: Manage API keys and their scopes
2. **Key generation**: Create new keys with selected scopes
3. **Key revocation**: Delete compromised keys
4. **Scope display**: Show what each key can do

```svelte
<!-- ApiKeyManager.svelte -->
<div class="api-key-manager">
  <h3>API Keys</h3>

  {#each apiKeys as key}
    <div class="api-key">
      <span class="name">{key.name}</span>
      <span class="scopes">{formatScopes(key.scopes)}</span>
      <button on:click={() => revokeKey(key.id)}>Revoke</button>
    </div>
  {/each}

  <button on:click={showCreateDialog}>Create New Key</button>
</div>

<!-- CreateKeyDialog.svelte -->
<dialog>
  <h4>Create API Key</h4>

  <input bind:value={name} placeholder="Key name" />

  <fieldset>
    <legend>Permissions</legend>

    <label>
      <input type="radio" bind:group={preset} value="readonly" />
      Read Only - Browse and search vault
    </label>

    <label>
      <input type="radio" bind:group={preset} value="editor" />
      Editor - Read and write, no delete
    </label>

    <label>
      <input type="radio" bind:group={preset} value="full" />
      Full Access - All operations
    </label>

    <label>
      <input type="radio" bind:group={preset} value="custom" />
      Custom...
    </label>

    {#if preset === "custom"}
      <ScopeSelector bind:selected={customScopes} />
    {/if}
  </fieldset>

  <button on:click={createKey}>Create</button>
</dialog>
```

### Local REST API Changes

```typescript
// Scope validation endpoint
GET /auth/scopes
Authorization: Bearer mcp_abc123...

Response:
{
  "granted": ["vault:read", "vault:list", "vault:search"],
  "preset": "readonly"
}

// All endpoints check scopes
DELETE /vault/some-file.md
Authorization: Bearer mcp_readonly...

Response: 403 Forbidden
{
  "error": "insufficient_scope",
  "required": "vault:delete",
  "granted": ["vault:read", "vault:list", "vault:search"],
  "message": "This API key does not have permission to delete files"
}
```

### Error Messages

Clear, actionable error messages:

```
❌ Operation denied: delete_vault_file requires scope 'vault:delete'

Your API key has these scopes:
  ✓ vault:read
  ✓ vault:list
  ✓ vault:search

To delete files, create a new API key with 'vault:delete' scope
or use an existing key with 'full' or 'admin' permissions.
```

## Alternatives Considered

### 1. File-Level Permissions (mcp-protected tags)

Already implemented! But this is per-file, not per-client.

**Scopes complement tags**: Scopes control client capabilities, tags protect specific files.

### 2. IP-Based Access Control

**Pros**: Simple network-level control
**Cons**: Doesn't work for localhost, too coarse-grained

### 3. Time-Based Tokens

**Pros**: Auto-expiring access
**Cons**: More complex, requires refresh flow

### 4. Full OAuth2 Implementation

**Pros**: Industry standard
**Cons**: Massive overkill for local plugin, requires auth server

## Open Questions

- [ ] Should scope changes require Obsidian restart or be hot-reloadable?
- [ ] How to handle migration of existing single API key to new multi-key system?
- [ ] Should we log scope-denied operations for audit trail?
- [ ] Should readonly mode also prevent template execution (side effects)?
- [ ] How to surface scope errors to LLM in a way it can explain to user?
- [ ] Should there be a "request scope upgrade" flow for clients?

## Migration Path

1. **v1**: Add scope infrastructure, existing key gets `admin:*`
2. **v2**: Add UI to create additional scoped keys
3. **v3**: Optionally restrict default key to non-admin scopes

## Security Considerations

- API keys stored in Obsidian's plugin data (already encrypted on disk)
- Scope validation happens server-side, client cannot bypass
- Keys should be long, random, unpredictable
- Consider rate limiting failed auth attempts
- Log scope violations for security audit

## References

- OAuth 2.0 Scopes: https://oauth.net/2/scope/
- GitHub API Scopes: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- Current mcp-protected tag implementation: `packages/mcp-server/src/shared/mcpTags.ts`
