# Feature: Unified Tool Dispatch with Dynamic Plugin Detection

> Reduce MCP tool count from 20+ individual tools to a small set of dispatcher tools with dictionary-style operation lookup.

## Status

- **Status**: idea
- **Priority**: High
- **Effort**: Large

## Problem

### Current State

The MCP server exposes **21+ individual tools**, each consuming LLM context:

```
get_server_info, get_active_file, update_active_file, append_to_active_file,
patch_active_file, delete_active_file, show_file_in_obsidian, search_vault,
search_vault_simple, list_vault_files, get_vault_file, create_vault_file,
append_to_vault_file, patch_vault_file, delete_vault_file, move_vault_file,
rename_vault_file, bulk_delete_files, fetch_url, execute_template,
semantic_search...
```

**Problems:**

1. **Context overhead**: Each tool's schema consumes tokens in the LLM's context window
2. **Rigid structure**: Adding new Obsidian plugins requires code changes and new tool definitions
3. **No discoverability**: LLM can't discover what operations are available at runtime
4. **Scaling issue**: As we add more plugin integrations, tool count grows linearly

### Desired State

- **3-5 dispatcher tools** instead of 20+
- **Runtime discovery** of available operations
- **Dynamic plugin detection** - automatically expose new capabilities when plugins are installed
- **Self-documenting** - operations describe themselves

## Proposed Solution

### Architecture: Operation Dispatcher Pattern

Replace many tools with a few dispatcher tools that accept an `operation` parameter:

```typescript
// Instead of 18 vault tools, one dispatcher:
vault({
  operation: "read" | "write" | "delete" | "move" | "search" | "list",
  path?: string,
  content?: string,
  options?: Record<string, unknown>
})

// Instead of per-plugin tools, one plugin dispatcher:
plugin({
  plugin: "dataview" | "templater" | "smart-connections" | ...,
  operation: string,
  params?: Record<string, unknown>
})

// Discovery tool for LLM to learn available operations:
discover({
  category?: "vault" | "plugins" | "all"
})
```

### Tool Reduction Strategy

| Current Tools | Unified Tool | Operations |
|--------------|--------------|------------|
| `get_vault_file`, `create_vault_file`, `append_to_vault_file`, `patch_vault_file`, `delete_vault_file`, `move_vault_file`, `rename_vault_file`, `list_vault_files` | `vault` | read, write, append, patch, delete, move, rename, list |
| `get_active_file`, `update_active_file`, `append_to_active_file`, `patch_active_file`, `delete_active_file` | `active_file` | read, write, append, patch, delete |
| `search_vault`, `search_vault_simple`, `bulk_delete_files` | `vault` | search, search_simple, bulk_delete |
| `execute_template` | `plugin` | templater.execute |
| `semantic_search` | `plugin` | smart-connections.search |
| `fetch_url` | `fetch` | (keep as-is, simple enough) |

**Result: ~5 tools instead of 21+**

### Dynamic Plugin Detection

```typescript
interface PluginCapability {
  plugin: string;
  version: string;
  operations: OperationDefinition[];
}

interface OperationDefinition {
  name: string;
  description: string;
  parameters: JSONSchema;
  examples?: string[];
}

// At startup, detect installed plugins and their capabilities
async function detectPlugins(): Promise<PluginCapability[]> {
  const capabilities: PluginCapability[] = [];

  // Check for Dataview
  if (await isPluginEnabled("dataview")) {
    capabilities.push({
      plugin: "dataview",
      version: await getPluginVersion("dataview"),
      operations: [
        {
          name: "query",
          description: "Execute a Dataview DQL query",
          parameters: { query: "string", format?: "table" | "list" | "task" }
        },
        {
          name: "js",
          description: "Execute DataviewJS code",
          parameters: { code: "string" }
        }
      ]
    });
  }

  // Check for Templater
  if (await isPluginEnabled("templater")) {
    // Scan templates folder for available templates
    const templates = await discoverTemplates();
    capabilities.push({
      plugin: "templater",
      version: await getPluginVersion("templater"),
      operations: templates.map(t => ({
        name: `execute:${t.name}`,
        description: t.description || `Execute template: ${t.name}`,
        parameters: parseTemplateParameters(t.content)
      }))
    });
  }

  return capabilities;
}
```

### Discovery Tool Output

```json
{
  "vault": {
    "operations": {
      "read": { "params": { "path": "string", "format?": "markdown|json" } },
      "write": { "params": { "path": "string", "content": "string" } },
      "delete": { "params": { "path": "string" } },
      "move": { "params": { "source": "string", "destination": "string" } },
      "search": { "params": { "query": "string", "type?": "glob|regex|text" } },
      "bulk_delete": { "params": { "match": "string", "type?": "glob|regex|search", "dryRun?": "boolean" } }
    }
  },
  "plugins": {
    "dataview": {
      "enabled": true,
      "version": "0.5.64",
      "operations": {
        "query": { "params": { "query": "string" } },
        "js": { "params": { "code": "string" } }
      }
    },
    "templater": {
      "enabled": true,
      "version": "2.0.0",
      "operations": {
        "execute:daily-note": { "params": { "date?": "string" } },
        "execute:meeting-notes": { "params": { "title": "string", "attendees": "string[]" } }
      }
    },
    "smart-connections": {
      "enabled": true,
      "version": "2.1.0",
      "operations": {
        "search": { "params": { "query": "string", "limit?": "number" } }
      }
    }
  }
}
```

## Implementation Details

### Phase 1: Vault Dispatcher (Medium effort)

Consolidate vault operations into single `vault` tool:

```typescript
tools.register(
  type({
    name: '"vault"',
    arguments: {
      operation: '"read" | "write" | "append" | "patch" | "delete" | "move" | "rename" | "list" | "search" | "bulk_delete"',
      path: type("string").optional(),
      content: type("string").optional(),
      options: type("Record<string, unknown>").optional(),
    },
  }).describe("Unified vault operations. Use discover() to see available operations."),
  async ({ arguments: args }) => {
    switch (args.operation) {
      case "read": return handleRead(args);
      case "write": return handleWrite(args);
      // ... dispatch to existing handlers
    }
  }
);
```

### Phase 2: Plugin Dispatcher (Large effort)

1. Create plugin capability registry
2. Implement plugin detection at startup
3. Build operation router
4. Handle graceful degradation when plugins unavailable

```typescript
// Plugin adapter interface
interface PluginAdapter {
  pluginId: string;
  isAvailable(): Promise<boolean>;
  getCapabilities(): Promise<OperationDefinition[]>;
  execute(operation: string, params: unknown): Promise<Result>;
}

// Example adapter
class DataviewAdapter implements PluginAdapter {
  pluginId = "dataview";

  async isAvailable() {
    return this.checkPluginEnabled();
  }

  async getCapabilities() {
    return [
      { name: "query", description: "Execute DQL query", ... },
      { name: "js", description: "Execute DataviewJS", ... },
    ];
  }

  async execute(operation: string, params: unknown) {
    switch (operation) {
      case "query": return this.executeQuery(params);
      case "js": return this.executeJS(params);
    }
  }
}
```

### Phase 3: Discovery Tool

```typescript
tools.register(
  type({
    name: '"discover"',
    arguments: {
      category: type('"vault" | "plugins" | "all"').optional(),
    },
  }).describe("Discover available operations and their parameters"),
  async ({ arguments: args }) => {
    const capabilities = await buildCapabilityManifest(args.category);
    return {
      content: [{ type: "text", text: JSON.stringify(capabilities, null, 2) }]
    };
  }
);
```

### MCP Server Changes

```
packages/mcp-server/src/
├── dispatchers/
│   ├── vault.ts          # Unified vault operations
│   ├── activeFile.ts     # Active file operations
│   ├── plugin.ts         # Plugin dispatcher
│   └── discover.ts       # Capability discovery
├── adapters/
│   ├── base.ts           # PluginAdapter interface
│   ├── dataview.ts       # Dataview adapter
│   ├── templater.ts      # Templater adapter
│   └── smart-connections.ts
└── registry/
    └── capabilities.ts   # Runtime capability registry
```

### Obsidian Plugin Changes

- Expose plugin detection API via Local REST API
- Add endpoint: `GET /plugins` - list installed plugins with versions
- Add endpoint: `GET /plugins/{id}/capabilities` - plugin-specific capabilities

## Alternatives Considered

### 1. Keep Current Approach

**Pros**: Simple, explicit, each tool is self-contained
**Cons**: Doesn't scale, high context overhead, no dynamic discovery

### 2. GraphQL-style Schema

**Pros**: Very flexible, introspectable
**Cons**: Overkill for this use case, adds complexity, not standard MCP pattern

### 3. Single "execute" Tool

```typescript
execute({ tool: "vault.read", params: { path: "..." } })
```

**Pros**: Maximum consolidation
**Cons**: Too generic, loses semantic meaning, harder for LLM to understand

### 4. Resource-based Discovery

Use MCP resources instead of tools for discovery:
```
obsidian://capabilities/vault
obsidian://capabilities/plugins/dataview
```

**Pros**: Clean separation of concerns
**Cons**: Requires client to fetch resources before knowing tools

## Open Questions

- [ ] Should we maintain backward compatibility with old tool names during transition?
- [ ] How do we handle operation-specific error messages when dispatcher catches all?
- [ ] Should plugin adapters be hot-reloadable when plugins are enabled/disabled?
- [ ] How granular should `discover()` output be? Full schemas or just names?
- [ ] Should we cache plugin capabilities or re-detect on each `discover()` call?
- [ ] How do we handle plugins that require configuration (API keys, etc.)?

## Migration Strategy

1. **Phase 1**: Add new dispatcher tools alongside existing tools
2. **Phase 2**: Mark old tools as deprecated (still functional)
3. **Phase 3**: Remove deprecated tools in next major version

## Success Metrics

- Tool count reduced from 21+ to ~5
- LLM context usage reduced by ~70%
- New plugin integrations require only adapter code, no tool definition changes
- `discover()` provides enough info for LLM to use any operation correctly

## References

- Current ToolRegistry: `packages/mcp-server/src/shared/ToolRegistry.ts`
- MCP Tool Specification: https://modelcontextprotocol.io/docs/concepts/tools
- Similar pattern: AWS SDK unified client with operation dispatch
