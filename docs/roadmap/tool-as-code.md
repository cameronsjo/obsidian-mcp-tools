# Feature: Tool-as-Code Execution

> Let LLMs write and execute code against the vault API instead of calling 20+ individual tools.

## Status

- **Status**: idea
- **Priority**: High
- **Effort**: Medium

## Problem

### Current State

The MCP server exposes 21+ individual tools, each with its own schema:

```
get_vault_file, create_vault_file, delete_vault_file, move_vault_file,
search_vault, bulk_delete_files, execute_template, ...
```

**Problems:**

1. **Context overhead**: Every tool schema consumes LLM tokens
2. **Combinatorial complexity**: Multi-step operations require multiple tool calls
3. **Limited expressiveness**: Can't do "for each file matching X, do Y"
4. **Rigid operations**: Adding new capabilities requires new tool definitions

### Anthropic's Insight

From [Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp):

> "Instead of creating dozens of specialized tools, we expose a single code execution capability. The LLM writes code that uses a well-documented API, giving it the full expressiveness of a programming language."

### Example: Current vs Tool-as-Code

**Current approach** (5 tool calls):
```
1. search_vault({ query: "meeting notes" })
2. get_vault_file({ path: "meetings/2024-01-15.md" })
3. get_vault_file({ path: "meetings/2024-01-16.md" })
4. get_vault_file({ path: "meetings/2024-01-17.md" })
5. create_vault_file({ path: "summary.md", content: "..." })
```

**Tool-as-Code** (1 tool call):
```javascript
const meetings = await vault.search("meeting notes", { type: "glob" });
const contents = await Promise.all(
  meetings.slice(0, 10).map(f => vault.read(f.path))
);
const summary = contents.map(c => extractActionItems(c)).join("\n");
await vault.write("summary.md", summary);
return { processed: meetings.length, output: "summary.md" };
```

## Proposed Solution

### Single `execute` Tool

```typescript
tools.register(
  type({
    name: '"execute"',
    arguments: {
      code: type("string").describe("JavaScript code to execute against the vault API"),
      timeout: type("number").optional().describe("Execution timeout in ms (default: 30000)"),
    },
  }).describe(
    "Execute JavaScript code with access to the vault API. " +
    "Available APIs: vault.read(), vault.write(), vault.delete(), vault.search(), etc. " +
    "Code runs in a sandboxed environment with no network or filesystem access outside vault."
  ),
  async ({ arguments: args }) => {
    return await executeInSandbox(args.code, args.timeout ?? 30000);
  }
);
```

### Vault API Surface

Expose a clean, well-documented API to the sandbox:

```typescript
interface VaultAPI {
  // Reading
  read(path: string, options?: { format?: "markdown" | "json" }): Promise<string | NoteJson>;
  list(directory?: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileStat>;

  // Writing
  write(path: string, content: string): Promise<void>;
  append(path: string, content: string): Promise<void>;
  patch(path: string, options: PatchOptions): Promise<void>;

  // Organization
  delete(path: string): Promise<void>;
  move(source: string, destination: string): Promise<void>;
  rename(path: string, newName: string): Promise<void>;

  // Search
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  // Bulk operations
  bulkDelete(match: string, options?: BulkDeleteOptions): Promise<BulkResult>;

  // Metadata
  getFrontmatter(path: string): Promise<Record<string, unknown>>;
  setFrontmatter(path: string, data: Record<string, unknown>): Promise<void>;
  getTags(path: string): Promise<string[]>;
}

interface PluginsAPI {
  dataview?: {
    query(dql: string): Promise<QueryResult>;
    js(code: string): Promise<unknown>;
  };
  templater?: {
    execute(template: string, params?: Record<string, unknown>): Promise<string>;
  };
  smartConnections?: {
    search(query: string, limit?: number): Promise<SemanticResult[]>;
  };
}

// Available in sandbox as globals
declare const vault: VaultAPI;
declare const plugins: PluginsAPI;
declare const console: { log, warn, error }; // Captured for output
```

### Sandbox Implementation

Use a secure JavaScript sandbox (not `eval`!):

```typescript
import ivm from 'isolated-vm';

async function executeInSandbox(code: string, timeout: number): Promise<Result> {
  const isolate = new ivm.Isolate({ memoryLimit: 128 }); // 128MB limit
  const context = await isolate.createContext();

  // Inject vault API as references
  const jail = context.global;
  await jail.set('vault', new ivm.Reference(createVaultProxy()));
  await jail.set('plugins', new ivm.Reference(createPluginsProxy()));

  // Capture console output
  const logs: string[] = [];
  await jail.set('console', new ivm.Reference({
    log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
    warn: (...args: unknown[]) => logs.push(`[warn] ${args.map(String).join(" ")}`),
    error: (...args: unknown[]) => logs.push(`[error] ${args.map(String).join(" ")}`),
  }));

  try {
    // Wrap in async IIFE to support top-level await
    const wrappedCode = `(async () => { ${code} })()`;
    const script = await isolate.compileScript(wrappedCode);
    const result = await script.run(context, { timeout });

    return {
      content: [
        { type: "text", text: JSON.stringify(result, null, 2) },
        ...(logs.length ? [{ type: "text", text: `Console output:\n${logs.join("\n")}` }] : []),
      ],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Execution error: ${error.message}` }],
      isError: true,
    };
  } finally {
    isolate.dispose();
  }
}
```

### Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                      Isolated VM                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  User Code                                               ││
│  │  - No require/import                                     ││
│  │  - No global object access                               ││
│  │  - No network (fetch, http, etc.)                        ││
│  │  - No filesystem (fs, path, etc.)                        ││
│  │  - No process/child_process                              ││
│  │  - Memory limited (128MB)                                ││
│  │  - Time limited (30s default)                            ││
│  └─────────────────────────────────────────────────────────┘│
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  API Proxy Layer                                         ││
│  │  - vault.* → validated, scoped calls                     ││
│  │  - plugins.* → validated, scoped calls                   ││
│  │  - Respects mcp-protected/mcp-readonly tags              ││
│  │  - Respects authorization scopes                         ││
│  │  - Rate limited                                          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  Local REST API        │
              │  (Obsidian Plugin)     │
              └────────────────────────┘
```

### Integration with Authorization Scopes

The API proxy respects scopes:

```typescript
function createVaultProxy(scopes: Scope[]): VaultAPI {
  return {
    async read(path, options) {
      requireScope(scopes, "vault:read");
      return await callLocalRestApi("GET", `/vault/${path}`, options);
    },
    async write(path, content) {
      requireScope(scopes, "vault:write");
      return await callLocalRestApi("PUT", `/vault/${path}`, { body: content });
    },
    async delete(path) {
      requireScope(scopes, "vault:delete");
      return await callLocalRestApi("DELETE", `/vault/${path}`);
    },
    // ...
  };
}
```

### Integration with MCP Protection Tags

```typescript
async read(path) {
  // mcp-hidden files are invisible
  if (await isHidden(path)) {
    throw new Error(`File not found: ${path}`);
  }
  return await callLocalRestApi("GET", `/vault/${path}`);
}

async write(path, content) {
  // mcp-readonly files can't be modified
  await assertNotReadonly(path);
  return await callLocalRestApi("PUT", `/vault/${path}`, { body: content });
}

async delete(path) {
  // mcp-protected files can't be deleted
  await assertNotProtected(path);
  return await callLocalRestApi("DELETE", `/vault/${path}`);
}
```

## Implementation Details

### Dependencies

```json
{
  "dependencies": {
    "isolated-vm": "^4.7.2"
  }
}
```

Note: `isolated-vm` requires native compilation. Alternative: use `vm2` or Deno's sandbox if portability is a concern.

### MCP Server Changes

```
packages/mcp-server/src/
├── features/
│   └── execute/
│       ├── index.ts          # Tool registration
│       ├── sandbox.ts        # isolated-vm setup
│       ├── api-proxy.ts      # Vault/Plugin API wrappers
│       └── security.ts       # Scope/tag enforcement
```

### API Documentation for LLM

Include comprehensive documentation in the tool description or as an MCP resource:

```typescript
const API_DOCS = `
# Vault API

## Reading Files

\`\`\`javascript
// Read file as markdown
const content = await vault.read("path/to/file.md");

// Read file with frontmatter parsed
const note = await vault.read("path/to/file.md", { format: "json" });
console.log(note.frontmatter.title);
console.log(note.tags);
\`\`\`

## Writing Files

\`\`\`javascript
// Create or overwrite
await vault.write("new-file.md", "# Hello World");

// Append to existing
await vault.append("log.md", "\\n- New entry");
\`\`\`

## Searching

\`\`\`javascript
// Text search
const results = await vault.search("meeting notes");

// Glob pattern
const mdFiles = await vault.search("**/*.md", { type: "glob" });

// Regex
const dated = await vault.search("\\d{4}-\\d{2}-\\d{2}", { type: "regex" });
\`\`\`

## Bulk Operations

\`\`\`javascript
// Dry run first
const preview = await vault.bulkDelete("archive/**/*.bak", { dryRun: true });
console.log(\`Would delete \${preview.matchCount} files\`);

// Actually delete
const result = await vault.bulkDelete("archive/**/*.bak", { dryRun: false });
\`\`\`
`;
```

### Example Use Cases

**1. Weekly Review Generator**
```javascript
const thisWeek = await vault.search("daily/2024-01-*", { type: "glob" });
const entries = await Promise.all(thisWeek.map(f => vault.read(f.path, { format: "json" })));

const highlights = entries
  .filter(e => e.frontmatter?.highlight)
  .map(e => `- ${e.frontmatter.highlight}`)
  .join("\n");

const review = `# Week of Jan 15-21\n\n## Highlights\n${highlights}`;
await vault.write("reviews/2024-W03.md", review);
return { created: "reviews/2024-W03.md", entries: thisWeek.length };
```

**2. Tag Cleanup**
```javascript
const files = await vault.list();
let fixed = 0;
for (const path of files.filter(f => f.endsWith(".md"))) {
  const tags = await vault.getTags(path);
  if (tags.includes("todo") && tags.includes("done")) {
    const newTags = tags.filter(t => t !== "todo");
    await vault.setFrontmatter(path, { tags: newTags });
    fixed++;
  }
}
return { fixed };
```

**3. Smart Deduplication**
```javascript
const files = await vault.list("inbox");
const byHash = new Map();

for (const path of files) {
  const content = await vault.read(path);
  const hash = simpleHash(content);
  if (byHash.has(hash)) {
    console.log(`Duplicate: ${path} = ${byHash.get(hash)}`);
    // Keep older file, delete newer
    await vault.delete(path);
  } else {
    byHash.set(hash, path);
  }
}

function simpleHash(s) {
  return s.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
}
```

## Alternatives Considered

### 1. Unified Tool Dispatch (Complementary)

The "dispatcher with operation parameter" approach reduces tool count but still requires predefined operations. Tool-as-Code is more flexible.

**Recommendation**: Implement both. Use dispatchers for common operations, execute for complex/custom logic.

### 2. Lua Scripting

**Pros**: Simpler sandbox, smaller runtime
**Cons**: Less familiar to LLMs, fewer examples in training data

### 3. WASM-based Sandbox

**Pros**: Maximum security, portable
**Cons**: Complex setup, performance overhead, async is tricky

### 4. Deno Subprocess

**Pros**: Full TypeScript support, built-in sandbox
**Cons**: Requires Deno installation, process overhead

## Open Questions

- [ ] Should we allow persistent state between executions (for multi-step workflows)?
- [ ] How to handle long-running operations that exceed timeout?
- [ ] Should there be a "preview" mode that shows what code would do without executing?
- [ ] How to version the API if we need breaking changes?
- [ ] Should code be logged/stored for audit purposes?
- [ ] How to handle code that produces very large output?

## Security Considerations

1. **Memory limits**: Prevent OOM via isolated-vm's memoryLimit
2. **CPU limits**: Timeout prevents infinite loops
3. **No network**: Sandbox has no fetch/http/net access
4. **No filesystem**: Only vault API, no raw fs access
5. **Scope enforcement**: API proxy validates permissions
6. **Tag enforcement**: Protected/readonly files respected
7. **Input validation**: Paths validated before API calls
8. **Output sanitization**: Results sanitized before return

## Success Metrics

- Reduce average tool calls per complex task by 60%+
- Enable operations not possible with individual tools
- Maintain security (no escapes from sandbox)
- LLM successfully writes working code 80%+ of the time

## References

- [Anthropic: Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [isolated-vm](https://github.com/laverdet/isolated-vm) - Secure V8 isolates
- [vm2](https://github.com/patriksimek/vm2) - Alternative sandbox (note: has had security issues)
- Current tool registry: `packages/mcp-server/src/shared/ToolRegistry.ts`
