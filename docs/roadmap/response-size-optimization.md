# Feature: Response Size Optimization

> Reduce MCP tool response sizes from 25k+ tokens to manageable chunks with pagination.

## Status

- **Status**: planned
- **Priority**: P0 (blocking usability)
- **Effort**: Medium (10-12 hours)

## Problem

### Current State

MCP tools return unbounded responses that can consume entire LLM context windows:

| Tool | Worst Case | Scenario |
|------|------------|----------|
| `list_vault_files` | 5-10MB | 50,000 file vault |
| `get_vault_file` | 1MB+ | Large note or embedded content |
| `search_vault_simple` | 500KB+ | Broad query, many matches |
| `search_vault` | 1MB+ | Dataview query returning full results |
| `search_vault_smart` | 500KB+ | Semantic search with full text |
| `bulk_delete_files` | 100KB+ | Pattern matching 1000+ files |

**Impact:**
- LLM context exhausted on single tool call
- Responses truncated, losing critical data
- Slow response times
- High API costs
- Poor user experience

### Desired State

- Default response limit: ~5KB (configurable)
- Pagination for large datasets
- Truncation with "get more" guidance
- Response metadata (total size, has more, next offset)

## Proposed Solution

### Pattern: Adopt fetch tool approach

The `fetch` tool already implements this correctly:

```typescript
// Current fetch implementation (good pattern)
const maxLength = args.maxLength || 5000;
const startIndex = args.startIndex || 0;

content = content.substring(startIndex, startIndex + maxLength);
content += `\n\n<error>Content truncated. Call with startIndex of ${
  startIndex + maxLength
} to get more.</error>`;

return {
  content: [...],
  // Pagination metadata
  text: `Pagination: ${JSON.stringify({
    totalLength,
    startIndex,
    endIndex: startIndex + content.length,
    hasMore: true,
  })}`,
};
```

### Implementation by Tool

#### 1. list_vault_files (HIGH priority)

**Before:**
```typescript
const data = await makeRequest(..., `/vault/${path}`);
return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
```

**After:**
```typescript
arguments: {
  "directory?": "string",
  "limit?": type("number").describe("Max files to return (default: 100)"),
  "offset?": type("number").describe("Skip first N files"),
  "pattern?": type("string").describe("Glob pattern to filter"),
}

// Implementation
const limit = args.limit ?? 100;
const offset = args.offset ?? 0;
const files = data.files.slice(offset, offset + limit);

return {
  content: [{
    type: "text",
    text: JSON.stringify({
      files,
      pagination: {
        total: data.files.length,
        offset,
        limit,
        hasMore: offset + limit < data.files.length,
      }
    }, null, 2)
  }]
};
```

#### 2. get_vault_file / get_active_file (HIGH priority)

**Add parameters:**
```typescript
arguments: {
  filename: "string",
  "format?": '"markdown" | "json"',
  "maxLength?": type("number").describe("Max content length (default: 10000)"),
  "startIndex?": type("number").describe("Start offset for pagination"),
}
```

**Implementation:**
```typescript
const maxLength = args.maxLength ?? 10000;
const startIndex = args.startIndex ?? 0;
const totalLength = content.length;

if (totalLength > maxLength) {
  content = content.substring(startIndex, startIndex + maxLength);
  return {
    content: [
      { type: "text", text: content },
      { type: "text", text: JSON.stringify({
        truncated: true,
        totalLength,
        startIndex,
        endIndex: startIndex + maxLength,
        nextIndex: startIndex + maxLength,
        hasMore: startIndex + maxLength < totalLength,
      })}
    ]
  };
}
```

#### 3. search_vault_simple (HIGH priority)

**Add parameters:**
```typescript
arguments: {
  query: "string",
  "contextLength?": "number",
  "limit?": type("number").describe("Max results (default: 20)"),
  "offset?": type("number").describe("Skip first N results"),
}
```

#### 4. search_vault (Dataview/JsonLogic) (MEDIUM priority)

**Add parameters:**
```typescript
arguments: {
  queryType: '"dataview" | "jsonlogic"',
  query: "string",
  "limit?": type("number").describe("Max results (default: 50)"),
}
```

#### 5. search_vault_smart (MEDIUM priority)

Already has `limit` in filter, but should have a default:
```typescript
const limit = args.filter?.limit ?? 20;
```

#### 6. bulk_delete_files (LOW priority)

Already has `limit` parameter, just needs better defaults:
```typescript
const limit = args.limit ?? 50; // Reduce from 100
```

### Unified Dispatcher Updates

Apply same patterns to the new unified dispatchers:

```typescript
// vault dispatcher - list operation
case "list":
  return handleList({
    ...params,
    limit: params.limit ?? 100,
    offset: params.offset ?? 0,
  });

// vault dispatcher - read operation
case "read":
  return handleRead({
    ...params,
    maxLength: params.maxLength ?? 10000,
    startIndex: params.startIndex ?? 0,
  });

// vault dispatcher - search operation
case "search":
  return handleSearch({
    ...params,
    limit: params.limit ?? 20,
  });
```

## Response Metadata Standard

All paginated responses should include:

```typescript
interface PaginationMetadata {
  // For list-based pagination
  total?: number;
  offset?: number;
  limit?: number;
  hasMore: boolean;

  // For content-based pagination
  totalLength?: number;
  startIndex?: number;
  endIndex?: number;
  nextIndex?: number;
  truncated?: boolean;
}
```

## Default Limits

| Data Type | Default Limit | Rationale |
|-----------|---------------|-----------|
| File content | 10,000 chars | ~2,500 tokens, leaves room for conversation |
| File lists | 100 items | Enough for navigation, not overwhelming |
| Search results | 20 items | Quality over quantity |
| Bulk operations | 50 items | Safety + visibility |

## Implementation Plan

### Phase 1: High Impact (4 hours)
1. `list_vault_files` - Add limit/offset
2. `get_vault_file` - Add maxLength/startIndex
3. `get_active_file` - Add maxLength/startIndex

### Phase 2: Search Tools (3 hours)
4. `search_vault_simple` - Add limit/offset
5. `search_vault` - Add limit
6. `search_vault_smart` - Default limit

### Phase 3: Dispatchers (3 hours)
7. Update `vault` dispatcher operations
8. Update `active_file` dispatcher operations
9. Add pagination to `discover` output

### Phase 4: Documentation (2 hours)
10. Update tool descriptions with pagination guidance
11. Add examples to prompts

## Testing Strategy

```typescript
describe("response size limits", () => {
  it("list_vault_files respects limit", async () => {
    const result = await tools.dispatch({
      name: "list_vault_files",
      arguments: { limit: 10 }
    });
    const data = JSON.parse(result.content[0].text);
    expect(data.files.length).toBeLessThanOrEqual(10);
    expect(data.pagination.hasMore).toBeDefined();
  });

  it("get_vault_file truncates large files", async () => {
    const result = await tools.dispatch({
      name: "get_vault_file",
      arguments: { filename: "large-file.md", maxLength: 1000 }
    });
    expect(result.content[0].text.length).toBeLessThanOrEqual(1000);
    expect(result.content[1].text).toContain("truncated");
  });
});
```

## Success Metrics

- Average response size < 10KB (down from 25KB+)
- No tool call exceeds 50KB without explicit pagination
- LLM can navigate large vaults without context exhaustion
- Zero truncation-related data loss

## Migration

- All changes are additive (new optional parameters)
- Existing calls work with new defaults
- No breaking changes to tool signatures
