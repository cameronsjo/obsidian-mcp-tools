/**
 * Vault Dispatcher
 *
 * Consolidates vault file operations into a single dispatcher tool:
 * - read: get_vault_file
 * - write: create_vault_file
 * - append: append_to_vault_file
 * - patch: patch_vault_file
 * - delete: delete_vault_file
 * - move: move_vault_file
 * - rename: rename_vault_file
 * - list: list_vault_files
 * - search: search_vault, search_vault_simple
 * - bulk_delete: bulk_delete_files
 * - open: show_file_in_obsidian
 */

import {
  makeRequest,
  validateVaultPath,
  validateOptionalPath,
  assertNotProtected,
  assertNotReadonly,
  MCP_TAGS,
} from "$/shared";
import { LocalRestAPI } from "shared";
import { OperationRegistry, type OperationResult } from "./types";

export const vaultOperations = new OperationRegistry();

// READ operation
vaultOperations.register({
  name: "read",
  description: "Get the content of a file from your vault",
  parameters: {
    path: { type: "string", description: "Vault-relative file path", required: true },
    format: { type: '"markdown" | "json"', description: "Output format (default: markdown)" },
  },
  handler: async (params): Promise<OperationResult> => {
    const path = params.path as string;
    const format = params.format as string | undefined;

    const validPath = validateVaultPath(path);
    const isJson = format === "json";
    const acceptFormat = isJson
      ? "application/vnd.olrapi.note+json"
      : "text/markdown";

    const data = await makeRequest(
      isJson ? LocalRestAPI.ApiNoteJson : LocalRestAPI.ApiContentResponse,
      `/vault/${encodeURIComponent(validPath)}`,
      { headers: { Accept: acceptFormat } },
    );

    return {
      content: [
        {
          type: "text",
          text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
        },
      ],
    };
  },
});

// WRITE operation
vaultOperations.register({
  name: "write",
  description: "Create a new file or update an existing one. Respects mcp-readonly tag.",
  parameters: {
    path: { type: "string", description: "Vault-relative file path", required: true },
    content: { type: "string", description: "File content", required: true },
  },
  handler: async (params): Promise<OperationResult> => {
    const path = params.path as string;
    const content = params.content as string;

    const validPath = validateVaultPath(path);

    // Check if existing file is readonly
    try {
      await assertNotReadonly(validPath);
    } catch (error) {
      if (error instanceof Error && error.message.includes("read-only")) {
        return {
          content: [
            {
              type: "text",
              text: `Cannot overwrite: file is read-only (has ${MCP_TAGS.READONLY} tag)`,
            },
          ],
          isError: true,
        };
      }
    }

    await makeRequest(
      LocalRestAPI.ApiNoContentResponse,
      `/vault/${encodeURIComponent(validPath)}`,
      { method: "PUT", body: content },
    );

    return {
      content: [{ type: "text", text: "File created successfully" }],
    };
  },
});

// APPEND operation
vaultOperations.register({
  name: "append",
  description: "Append content to a file. Respects mcp-readonly tag.",
  parameters: {
    path: { type: "string", description: "Vault-relative file path", required: true },
    content: { type: "string", description: "Content to append", required: true },
  },
  handler: async (params): Promise<OperationResult> => {
    const path = params.path as string;
    const content = params.content as string;

    const validPath = validateVaultPath(path);

    try {
      await assertNotReadonly(validPath);
    } catch (error) {
      if (error instanceof Error && error.message.includes("read-only")) {
        return {
          content: [
            {
              type: "text",
              text: `Cannot append: file is read-only (has ${MCP_TAGS.READONLY} tag)`,
            },
          ],
          isError: true,
        };
      }
    }

    await makeRequest(
      LocalRestAPI.ApiNoContentResponse,
      `/vault/${encodeURIComponent(validPath)}`,
      { method: "POST", body: content },
    );

    return {
      content: [{ type: "text", text: "Content appended successfully" }],
    };
  },
});

// PATCH operation
vaultOperations.register({
  name: "patch",
  description:
    "Insert or modify content relative to a heading, block reference, or frontmatter field. Respects mcp-readonly tag.",
  parameters: {
    path: { type: "string", description: "Vault-relative file path", required: true },
    operation: {
      type: '"append" | "prepend" | "replace"',
      description: "How to modify the target",
      required: true,
    },
    targetType: {
      type: '"heading" | "block" | "frontmatter"',
      description: "Type of target to modify",
      required: true,
    },
    target: { type: "string", description: "Target identifier", required: true },
    content: { type: "string", description: "Content to insert", required: true },
    targetDelimiter: { type: "string", description: "Delimiter for nested targets" },
    trimTargetWhitespace: { type: "boolean", description: "Trim whitespace from target" },
    contentType: { type: "string", description: "Content type header" },
  },
  handler: async (params): Promise<OperationResult> => {
    const path = params.path as string;
    const validPath = validateVaultPath(path);

    await assertNotReadonly(validPath);

    const headers: HeadersInit = {
      Operation: params.operation as string,
      "Target-Type": params.targetType as string,
      Target: params.target as string,
      "Create-Target-If-Missing": "true",
    };

    if (params.targetDelimiter) {
      headers["Target-Delimiter"] = params.targetDelimiter as string;
    }
    if (params.trimTargetWhitespace !== undefined) {
      headers["Trim-Target-Whitespace"] = String(params.trimTargetWhitespace);
    }
    if (params.contentType) {
      headers["Content-Type"] = params.contentType as string;
    }

    const response = await makeRequest(
      LocalRestAPI.ApiContentResponse,
      `/vault/${encodeURIComponent(validPath)}`,
      { method: "PATCH", headers, body: params.content as string },
    );

    return {
      content: [
        { type: "text", text: "File patched successfully" },
        { type: "text", text: response },
      ],
    };
  },
});

// DELETE operation
vaultOperations.register({
  name: "delete",
  description: "Delete a file from your vault. Respects mcp-protected tag.",
  parameters: {
    path: { type: "string", description: "Vault-relative file path", required: true },
  },
  handler: async (params): Promise<OperationResult> => {
    const path = params.path as string;
    const validPath = validateVaultPath(path);

    await assertNotProtected(validPath);

    await makeRequest(
      LocalRestAPI.ApiNoContentResponse,
      `/vault/${encodeURIComponent(validPath)}`,
      { method: "DELETE" },
    );

    return {
      content: [{ type: "text", text: "File deleted successfully" }],
    };
  },
});

// MOVE operation
vaultOperations.register({
  name: "move",
  description: "Move a file to another location. Respects mcp-protected tag.",
  parameters: {
    source: { type: "string", description: "Source file path", required: true },
    destination: { type: "string", description: "Destination file path", required: true },
    overwrite: { type: "boolean", description: "Overwrite destination if exists (default: false)" },
  },
  handler: async (params): Promise<OperationResult> => {
    const sourcePath = validateVaultPath(params.source as string);
    const destPath = validateVaultPath(params.destination as string);

    await assertNotProtected(sourcePath);

    // Check if destination exists
    if (!params.overwrite) {
      try {
        await makeRequest(
          LocalRestAPI.ApiContentResponse,
          `/vault/${encodeURIComponent(destPath)}`,
          { headers: { Accept: "text/markdown" } },
        );
        return {
          content: [
            {
              type: "text",
              text: `Destination file already exists: ${destPath}. Use overwrite: true to replace it.`,
            },
          ],
          isError: true,
        };
      } catch {
        // File doesn't exist, proceed
      }
    }

    // Read source
    const content = await makeRequest(
      LocalRestAPI.ApiContentResponse,
      `/vault/${encodeURIComponent(sourcePath)}`,
      { headers: { Accept: "text/markdown" } },
    );

    // Write to destination
    await makeRequest(
      LocalRestAPI.ApiNoContentResponse,
      `/vault/${encodeURIComponent(destPath)}`,
      { method: "PUT", body: content },
    );

    // Delete source
    await makeRequest(
      LocalRestAPI.ApiNoContentResponse,
      `/vault/${encodeURIComponent(sourcePath)}`,
      { method: "DELETE" },
    );

    return {
      content: [
        {
          type: "text",
          text: `File moved successfully: ${sourcePath} → ${destPath}`,
        },
      ],
    };
  },
});

// RENAME operation
vaultOperations.register({
  name: "rename",
  description: "Rename a file in place. Respects mcp-protected tag.",
  parameters: {
    path: { type: "string", description: "Current file path", required: true },
    newName: { type: "string", description: "New filename (just the name, not path)", required: true },
  },
  handler: async (params): Promise<OperationResult> => {
    const sourcePath = validateVaultPath(params.path as string);

    await assertNotProtected(sourcePath);

    // Extract directory
    const lastSlash = sourcePath.lastIndexOf("/");
    const directory = lastSlash >= 0 ? sourcePath.substring(0, lastSlash + 1) : "";
    const destPath = validateVaultPath(directory + (params.newName as string));

    // Read source
    const content = await makeRequest(
      LocalRestAPI.ApiContentResponse,
      `/vault/${encodeURIComponent(sourcePath)}`,
      { headers: { Accept: "text/markdown" } },
    );

    // Write to destination
    await makeRequest(
      LocalRestAPI.ApiNoContentResponse,
      `/vault/${encodeURIComponent(destPath)}`,
      { method: "PUT", body: content },
    );

    // Delete source
    await makeRequest(
      LocalRestAPI.ApiNoContentResponse,
      `/vault/${encodeURIComponent(sourcePath)}`,
      { method: "DELETE" },
    );

    return {
      content: [
        {
          type: "text",
          text: `File renamed successfully: ${sourcePath} → ${destPath}`,
        },
      ],
    };
  },
});

// LIST operation
vaultOperations.register({
  name: "list",
  description: "List files in the vault or a subdirectory",
  parameters: {
    directory: { type: "string", description: "Directory path (optional, defaults to root)" },
  },
  handler: async (params): Promise<OperationResult> => {
    const validPath = validateOptionalPath(params.directory as string | undefined);
    const path = validPath ? `${validPath}/` : "";

    const data = await makeRequest(
      LocalRestAPI.ApiVaultFileResponse.or(LocalRestAPI.ApiVaultDirectoryResponse),
      `/vault/${path}`,
    );

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
});

// SEARCH operation (unified)
vaultOperations.register({
  name: "search",
  description: "Search vault using text query, Dataview DQL, or JsonLogic",
  parameters: {
    query: { type: "string", description: "Search query", required: true },
    type: {
      type: '"text" | "dataview" | "jsonlogic"',
      description: "Search type (default: text)",
    },
    contextLength: {
      type: "number",
      description: "Context length for text search results",
    },
  },
  handler: async (params): Promise<OperationResult> => {
    const query = params.query as string;
    const searchType = (params.type as string) || "text";

    if (searchType === "text") {
      const queryParams = new URLSearchParams({ query });
      if (params.contextLength) {
        queryParams.set("contextLength", String(params.contextLength));
      }

      const data = await makeRequest(
        LocalRestAPI.ApiSimpleSearchResponse,
        `/search/simple/?${queryParams}`,
        { method: "POST" },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    // Dataview or JsonLogic
    const contentType =
      searchType === "dataview"
        ? "application/vnd.olrapi.dataview.dql+txt"
        : "application/vnd.olrapi.jsonlogic+json";

    const data = await makeRequest(LocalRestAPI.ApiSearchResponse, "/search/", {
      method: "POST",
      headers: { "Content-Type": contentType },
      body: query,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
});

// BULK_DELETE operation
vaultOperations.register({
  name: "bulk_delete",
  description:
    "Delete multiple files matching a pattern. Defaults to dry-run mode for safety.",
  parameters: {
    match: { type: "string", description: "Pattern to match files", required: true },
    type: {
      type: '"glob" | "regex" | "search"',
      description: "How to interpret match (default: glob)",
    },
    flags: { type: "string", description: "Regex flags when type is regex" },
    exclude: { type: "string[]", description: "Patterns to exclude" },
    dryRun: { type: "boolean", description: "Preview without deleting (default: true)" },
    limit: { type: "number", description: "Maximum files to process (default: 100)" },
  },
  handler: async (params): Promise<OperationResult> => {
    const matchType = (params.type as string) ?? "glob";
    const limit = (params.limit as number) ?? 100;
    const dryRun = (params.dryRun as boolean) ?? true;
    const exclude = (params.exclude as string[]) ?? [];

    const matchesGlob = (filePath: string, globPattern: string): boolean => {
      const regexPattern = globPattern
        .replace(/\./g, "\\.")
        .replace(/\*\*/g, "<<<GLOBSTAR>>>")
        .replace(/\*/g, "[^/]*")
        .replace(/<<<GLOBSTAR>>>/g, ".*")
        .replace(/\?/g, ".");
      return new RegExp(`^${regexPattern}$`).test(filePath);
    };

    let matchingFiles: string[];

    if (matchType === "search") {
      const searchResults = await makeRequest(
        LocalRestAPI.ApiSimpleSearchResponse,
        `/search/simple/?query=${encodeURIComponent(params.match as string)}`,
        { method: "POST" },
      );
      matchingFiles = [
        ...new Set(searchResults.map((r: { filename: string }) => r.filename)),
      ];

      if (exclude.length > 0) {
        matchingFiles = matchingFiles.filter((file: string) => {
          for (const excludePattern of exclude) {
            if (matchesGlob(file, excludePattern)) return false;
          }
          return true;
        });
      }
    } else if (matchType === "regex") {
      let matchRegex: RegExp;
      try {
        matchRegex = new RegExp(params.match as string, params.flags as string);
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }

      const excludeRegexes: RegExp[] = [];
      for (const excludePattern of exclude) {
        try {
          excludeRegexes.push(new RegExp(excludePattern, params.flags as string));
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid exclude regex "${excludePattern}": ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }

      const allFiles = await makeRequest(
        LocalRestAPI.ApiVaultDirectoryResponse,
        "/vault/",
      );

      matchingFiles = allFiles.files.filter((file: string) => {
        if (!matchRegex.test(file)) return false;
        for (const excludeRegex of excludeRegexes) {
          if (excludeRegex.test(file)) return false;
        }
        return true;
      });
    } else {
      // Glob matching
      const allFiles = await makeRequest(
        LocalRestAPI.ApiVaultDirectoryResponse,
        "/vault/",
      );

      matchingFiles = allFiles.files.filter((file: string) => {
        if (!matchesGlob(file, params.match as string)) return false;
        for (const excludePattern of exclude) {
          if (matchesGlob(file, excludePattern)) return false;
        }
        return true;
      });
    }

    const filesToProcess = matchingFiles.slice(0, limit);
    const truncated = matchingFiles.length > limit;

    if (dryRun) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                mode: "dry-run",
                matchType,
                match: params.match,
                matchCount: matchingFiles.length,
                wouldDelete: filesToProcess,
                truncated,
                message: truncated
                  ? `Showing first ${limit} of ${matchingFiles.length} matches. Set dryRun: false to delete.`
                  : `Found ${matchingFiles.length} files. Set dryRun: false to delete.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    // Actually delete files
    const deleted: string[] = [];
    const skipped: string[] = [];
    const failed: Array<{ file: string; error: string }> = [];

    for (const file of filesToProcess) {
      try {
        const validPath = validateVaultPath(file);

        try {
          await assertNotProtected(validPath);
        } catch {
          skipped.push(file);
          continue;
        }

        await makeRequest(
          LocalRestAPI.ApiNoContentResponse,
          `/vault/${encodeURIComponent(validPath)}`,
          { method: "DELETE" },
        );
        deleted.push(file);
      } catch (error) {
        failed.push({
          file,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              mode: "delete",
              matchType,
              match: params.match,
              deleted,
              skipped,
              failed,
              deletedCount: deleted.length,
              skippedCount: skipped.length,
              failedCount: failed.length,
              truncated,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
});

// OPEN operation
vaultOperations.register({
  name: "open",
  description: "Open a file in the Obsidian UI",
  parameters: {
    path: { type: "string", description: "Vault-relative file path", required: true },
    newLeaf: { type: "boolean", description: "Open in a new pane" },
  },
  handler: async (params): Promise<OperationResult> => {
    const validPath = validateVaultPath(params.path as string);
    const query = params.newLeaf ? "?newLeaf=true" : "";

    await makeRequest(
      LocalRestAPI.ApiNoContentResponse,
      `/open/${encodeURIComponent(validPath)}${query}`,
      { method: "POST" },
    );

    return {
      content: [{ type: "text", text: "File opened successfully" }],
    };
  },
});

// INFO operation (server info)
vaultOperations.register({
  name: "info",
  description: "Get Obsidian API status and server information",
  parameters: {},
  handler: async (): Promise<OperationResult> => {
    const data = await makeRequest(LocalRestAPI.ApiStatusResponse, "/");
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  },
});

/**
 * Get capabilities for the vault dispatcher
 */
export function getVaultCapabilities() {
  return {
    category: "vault",
    description: "File operations for your Obsidian vault",
    operations: vaultOperations.getCapabilities(),
  };
}
