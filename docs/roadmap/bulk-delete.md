# Feature: Bulk Delete Operations

> Enable deletion of multiple vault files via regex patterns, glob matching, or query-based selection.

## Status

- **Status**: idea
- **Priority**: High
- **Effort**: Medium

## Problem

Currently there is no way to delete multiple files at once through the MCP interface. Users must delete files one at a time, which is tedious for:

- Cleaning up generated files
- Removing files matching a pattern (e.g., all `.bak` files)
- Deleting search results (e.g., "delete all notes tagged #archive")

## Proposed Solution

Add new MCP tools for bulk deletion with safety features:

1. **`obsidian_delete_by_pattern`** - Delete files matching a glob pattern
2. **`obsidian_delete_by_regex`** - Delete files matching a regex on path
3. **`obsidian_delete_by_query`** - Delete files returned by a search query

All operations should support:

- Dry-run mode (list what would be deleted without deleting)
- Confirmation requirement for large operations
- Exclusion patterns

## Implementation Details

### MCP Server Changes

New tool schemas:

```typescript
const deleteByPatternSchema = type({
  name: '"obsidian_delete_by_pattern"',
  arguments: {
    pattern: "string",           // Glob pattern (e.g., "**/*.bak")
    dryRun: "boolean = true",    // Default to safe mode
    "exclude?": "string[]",      // Patterns to exclude
  }
}).describe("Delete vault files matching a glob pattern");

const deleteByRegexSchema = type({
  name: '"obsidian_delete_by_regex"',
  arguments: {
    regex: "string",             // Regex pattern
    dryRun: "boolean = true",
    "exclude?": "string[]",
  }
}).describe("Delete vault files with paths matching a regex");

const deleteByQuerySchema = type({
  name: '"obsidian_delete_by_query"',
  arguments: {
    query: "string",             // Search query
    dryRun: "boolean = true",
    limit: "number = 100",       // Safety limit
  }
}).describe("Delete vault files returned by a semantic search query");
```

### Local REST API Changes

May need new endpoint or use existing file operations in a loop.

### Safety Considerations

- Default `dryRun: true` - must explicitly set false to delete
- Return list of files that would be/were deleted
- Limit maximum deletions per call (configurable)
- Log all delete operations

## Alternatives Considered

1. **Single delete with array of paths** - Less flexible, requires caller to resolve patterns
2. **Batch operation endpoint** - More complex, harder to implement safely

## Open Questions

- [ ] Should deleted files go to trash or be permanently deleted?
- [ ] Maximum files per operation (100? 500? configurable?)
- [ ] Should query-based delete require Smart Connections plugin?

## References

- Existing delete tool in `packages/mcp-server/src/features/local-rest-api/`
- Local REST API documentation
