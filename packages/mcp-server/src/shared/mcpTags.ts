import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype";
import { makeRequest } from "./makeRequest";
import { LocalRestAPI } from "shared";

/**
 * MCP protection tags that can be applied to notes via frontmatter.
 *
 * Usage in frontmatter:
 * ```yaml
 * ---
 * tags:
 *   - mcp-protected    # Prevents deletion via MCP
 *   - mcp-hidden       # Hides from file listings and searches
 *   - mcp-readonly     # Prevents modifications (allows reads)
 * ---
 * ```
 */
export const MCP_TAGS = {
  /** Prevents deletion via MCP tools */
  PROTECTED: "mcp-protected",
  /** Hides file from listings and searches */
  HIDDEN: "mcp-hidden",
  /** Prevents modifications but allows reads */
  READONLY: "mcp-readonly",
} as const;

export type McpTag = (typeof MCP_TAGS)[keyof typeof MCP_TAGS];

/**
 * Fetches tags for a file from the vault.
 * Returns empty array if file has no tags or doesn't exist.
 */
export async function getFileTags(filePath: string): Promise<string[]> {
  try {
    const data = await makeRequest(
      LocalRestAPI.ApiNoteJson,
      `/vault/${encodeURIComponent(filePath)}`,
      {
        headers: { Accept: "application/vnd.olrapi.note+json" },
      },
    );
    return data.tags ?? [];
  } catch {
    // File doesn't exist or can't be read - no tags
    return [];
  }
}

/**
 * Checks if a file has a specific MCP protection tag.
 */
export async function hasTag(filePath: string, tag: McpTag): Promise<boolean> {
  const tags = await getFileTags(filePath);
  return tags.includes(tag);
}

/**
 * Checks if a file is protected from deletion.
 * Throws McpError if file is protected.
 */
export async function assertNotProtected(filePath: string): Promise<void> {
  if (await hasTag(filePath, MCP_TAGS.PROTECTED)) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `File "${filePath}" is protected (has ${MCP_TAGS.PROTECTED} tag)`,
    );
  }
}

/**
 * Checks if a file is read-only.
 * Throws McpError if file is read-only.
 */
export async function assertNotReadonly(filePath: string): Promise<void> {
  if (await hasTag(filePath, MCP_TAGS.READONLY)) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `File "${filePath}" is read-only (has ${MCP_TAGS.READONLY} tag)`,
    );
  }
}

/**
 * Checks if a file is hidden from MCP.
 */
export async function isHidden(filePath: string): Promise<boolean> {
  return hasTag(filePath, MCP_TAGS.HIDDEN);
}

/**
 * Filters a list of files to exclude hidden ones.
 * Note: This makes one API call per file, so use sparingly on large lists.
 * For better performance, consider caching or batch fetching.
 */
export async function filterHiddenFiles(filePaths: string[]): Promise<string[]> {
  const results = await Promise.all(
    filePaths.map(async (path) => ({
      path,
      hidden: await isHidden(path),
    })),
  );
  return results.filter((r) => !r.hidden).map((r) => r.path);
}
