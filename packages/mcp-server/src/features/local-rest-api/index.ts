import {
  makeRequest,
  validateVaultPath,
  validateOptionalPath,
  assertNotProtected,
  assertNotReadonly,
  isHidden,
  MCP_TAGS,
  type ToolRegistry,
} from "$/shared";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { type } from "arktype";
import { LocalRestAPI } from "shared";

export function registerLocalRestApiTools(tools: ToolRegistry, server: Server) {
  // GET Status
  tools.register(
    type({
      name: '"get_server_info"',
      arguments: "Record<string, unknown>",
    }).describe(
      "Returns basic details about the Obsidian Local REST API and authentication status. This is the only API request that does not require authentication.",
    ),
    async () => {
      const data = await makeRequest(LocalRestAPI.ApiStatusResponse, "/");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // GET Active File
  tools.register(
    type({
      name: '"get_active_file"',
      arguments: {
        format: type('"markdown" | "json"').optional(),
      },
    }).describe(
      "Returns the content of the currently active file in Obsidian. Can return either markdown content or a JSON representation including parsed tags and frontmatter.",
    ),
    async ({ arguments: args }) => {
      const format =
        args?.format === "json"
          ? "application/vnd.olrapi.note+json"
          : "text/markdown";
      const data = await makeRequest(
        LocalRestAPI.ApiNoteJson.or("string"),
        "/active/",
        {
          headers: { Accept: format },
        },
      );
      const content =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);
      return { content: [{ type: "text", text: content }] };
    },
  );

  // PUT Active File
  tools.register(
    type({
      name: '"update_active_file"',
      arguments: {
        content: "string",
      },
    }).describe("Update the content of the active file open in Obsidian. Respects mcp-readonly tag."),
    async ({ arguments: args }) => {
      // Check if active file is readonly
      const activeFile = await makeRequest(
        LocalRestAPI.ApiNoteJson,
        "/active/",
        { headers: { Accept: "application/vnd.olrapi.note+json" } },
      );
      if (activeFile.tags?.includes(MCP_TAGS.READONLY)) {
        return {
          content: [{
            type: "text",
            text: `Cannot update: file is read-only (has ${MCP_TAGS.READONLY} tag)`,
          }],
          isError: true,
        };
      }

      await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
        method: "PUT",
        body: args.content,
      });
      return {
        content: [{ type: "text", text: "File updated successfully" }],
      };
    },
  );

  // POST Active File
  tools.register(
    type({
      name: '"append_to_active_file"',
      arguments: {
        content: "string",
      },
    }).describe("Append content to the end of the currently-open note. Respects mcp-readonly tag."),
    async ({ arguments: args }) => {
      // Check if active file is readonly
      const activeFile = await makeRequest(
        LocalRestAPI.ApiNoteJson,
        "/active/",
        { headers: { Accept: "application/vnd.olrapi.note+json" } },
      );
      if (activeFile.tags?.includes(MCP_TAGS.READONLY)) {
        return {
          content: [{
            type: "text",
            text: `Cannot append: file is read-only (has ${MCP_TAGS.READONLY} tag)`,
          }],
          isError: true,
        };
      }

      await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
        method: "POST",
        body: args.content,
      });
      return {
        content: [{ type: "text", text: "Content appended successfully" }],
      };
    },
  );

  // PATCH Active File
  tools.register(
    type({
      name: '"patch_active_file"',
      arguments: LocalRestAPI.ApiPatchParameters,
    }).describe(
      "Insert or modify content in the currently-open note relative to a heading, block reference, or frontmatter field. Respects mcp-readonly tag.",
    ),
    async ({ arguments: args }) => {
      // Check if active file is readonly
      const activeFile = await makeRequest(
        LocalRestAPI.ApiNoteJson,
        "/active/",
        { headers: { Accept: "application/vnd.olrapi.note+json" } },
      );
      if (activeFile.tags?.includes(MCP_TAGS.READONLY)) {
        return {
          content: [{
            type: "text",
            text: `Cannot patch: file is read-only (has ${MCP_TAGS.READONLY} tag)`,
          }],
          isError: true,
        };
      }

      const headers: Record<string, string> = {
        Operation: args.operation,
        "Target-Type": args.targetType,
        Target: args.target,
        "Create-Target-If-Missing": "true",
      };

      if (args.targetDelimiter) {
        headers["Target-Delimiter"] = args.targetDelimiter;
      }
      if (args.trimTargetWhitespace !== undefined) {
        headers["Trim-Target-Whitespace"] = String(args.trimTargetWhitespace);
      }
      if (args.contentType) {
        headers["Content-Type"] = args.contentType;
      }

      const response = await makeRequest(
        LocalRestAPI.ApiContentResponse,
        "/active/",
        {
          method: "PATCH",
          headers,
          body: args.content,
        },
      );
      return {
        content: [
          { type: "text", text: "File patched successfully" },
          { type: "text", text: response },
        ],
      };
    },
  );

  // DELETE Active File
  tools.register(
    type({
      name: '"delete_active_file"',
      arguments: "Record<string, unknown>",
    }).describe("Delete the currently-active file in Obsidian. Respects mcp-protected tag."),
    async () => {
      // Check if active file is protected
      const activeFile = await makeRequest(
        LocalRestAPI.ApiNoteJson,
        "/active/",
        { headers: { Accept: "application/vnd.olrapi.note+json" } },
      );
      if (activeFile.tags?.includes(MCP_TAGS.PROTECTED)) {
        return {
          content: [{
            type: "text",
            text: `Cannot delete: file is protected (has ${MCP_TAGS.PROTECTED} tag)`,
          }],
          isError: true,
        };
      }

      await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
        method: "DELETE",
      });
      return {
        content: [{ type: "text", text: "File deleted successfully" }],
      };
    },
  );

  // POST Open File in Obsidian UI
  tools.register(
    type({
      name: '"show_file_in_obsidian"',
      arguments: {
        filename: "string",
        "newLeaf?": "boolean",
      },
    }).describe(
      "Open a document in the Obsidian UI. Creates a new document if it doesn't exist. Returns a confirmation if the file was opened successfully.",
    ),
    async ({ arguments: args }) => {
      const validPath = validateVaultPath(args.filename);
      const query = args.newLeaf ? "?newLeaf=true" : "";

      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/open/${encodeURIComponent(validPath)}${query}`,
        {
          method: "POST",
        },
      );

      return {
        content: [{ type: "text", text: "File opened successfully" }],
      };
    },
  );

  // POST Search via Dataview or JsonLogic
  tools.register(
    type({
      name: '"search_vault"',
      arguments: {
        queryType: '"dataview" | "jsonlogic"',
        query: "string",
      },
    }).describe(
      "Search for documents matching a specified query using either Dataview DQL or JsonLogic.",
    ),
    async ({ arguments: args }) => {
      const contentType =
        args.queryType === "dataview"
          ? "application/vnd.olrapi.dataview.dql+txt"
          : "application/vnd.olrapi.jsonlogic+json";

      const data = await makeRequest(
        LocalRestAPI.ApiSearchResponse,
        "/search/",
        {
          method: "POST",
          headers: { "Content-Type": contentType },
          body: args.query,
        },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // POST Simple Search
  tools.register(
    type({
      name: '"search_vault_simple"',
      arguments: {
        query: "string",
        "contextLength?": "number",
      },
    }).describe("Search for documents matching a text query."),
    async ({ arguments: args }) => {
      const query = new URLSearchParams({
        query: args.query,
        ...(args.contextLength
          ? {
              contextLength: String(args.contextLength),
            }
          : {}),
      });

      const data = await makeRequest(
        LocalRestAPI.ApiSimpleSearchResponse,
        `/search/simple/?${query}`,
        {
          method: "POST",
        },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // GET Vault Files or Directories List
  tools.register(
    type({
      name: '"list_vault_files"',
      arguments: {
        "directory?": "string",
      },
    }).describe(
      "List files in the root directory or a specified subdirectory of your vault.",
    ),
    async ({ arguments: args }) => {
      const validPath = validateOptionalPath(args.directory);
      const path = validPath ? `${validPath}/` : "";
      const data = await makeRequest(
        LocalRestAPI.ApiVaultFileResponse.or(
          LocalRestAPI.ApiVaultDirectoryResponse,
        ),
        `/vault/${path}`,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // GET Vault File Content
  tools.register(
    type({
      name: '"get_vault_file"',
      arguments: {
        filename: "string",
        "format?": '"markdown" | "json"',
      },
    }).describe("Get the content of a file from your vault."),
    async ({ arguments: args }) => {
      const validPath = validateVaultPath(args.filename);
      const isJson = args.format === "json";
      const format = isJson
        ? "application/vnd.olrapi.note+json"
        : "text/markdown";
      const data = await makeRequest(
        isJson ? LocalRestAPI.ApiNoteJson : LocalRestAPI.ApiContentResponse,
        `/vault/${encodeURIComponent(validPath)}`,
        {
          headers: { Accept: format },
        },
      );
      return {
        content: [
          {
            type: "text",
            text:
              typeof data === "string" ? data : JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );

  // PUT Vault File Content
  tools.register(
    type({
      name: '"create_vault_file"',
      arguments: {
        filename: "string",
        content: "string",
      },
    }).describe("Create a new file in your vault or update an existing one. Respects mcp-readonly tag for existing files."),
    async ({ arguments: args }) => {
      const validPath = validateVaultPath(args.filename);

      // Check if existing file is readonly (new files are fine)
      try {
        await assertNotReadonly(validPath);
      } catch (error) {
        // If it's a readonly error, return it; otherwise the file doesn't exist (fine to create)
        if (error instanceof Error && error.message.includes("read-only")) {
          return {
            content: [{
              type: "text",
              text: `Cannot overwrite: file is read-only (has ${MCP_TAGS.READONLY} tag)`,
            }],
            isError: true,
          };
        }
      }

      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(validPath)}`,
        {
          method: "PUT",
          body: args.content,
        },
      );
      return {
        content: [{ type: "text", text: "File created successfully" }],
      };
    },
  );

  // POST Vault File Content
  tools.register(
    type({
      name: '"append_to_vault_file"',
      arguments: {
        filename: "string",
        content: "string",
      },
    }).describe("Append content to a new or existing file. Respects mcp-readonly tag."),
    async ({ arguments: args }) => {
      const validPath = validateVaultPath(args.filename);

      // Check if file is readonly (if it exists)
      try {
        await assertNotReadonly(validPath);
      } catch (error) {
        if (error instanceof Error && error.message.includes("read-only")) {
          return {
            content: [{
              type: "text",
              text: `Cannot append: file is read-only (has ${MCP_TAGS.READONLY} tag)`,
            }],
            isError: true,
          };
        }
      }

      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(validPath)}`,
        {
          method: "POST",
          body: args.content,
        },
      );
      return {
        content: [{ type: "text", text: "Content appended successfully" }],
      };
    },
  );

  // PATCH Vault File Content
  tools.register(
    type({
      name: '"patch_vault_file"',
      arguments: type({
        filename: "string",
      }).and(LocalRestAPI.ApiPatchParameters),
    }).describe(
      "Insert or modify content in a file relative to a heading, block reference, or frontmatter field. Respects mcp-readonly tag.",
    ),
    async ({ arguments: args }) => {
      const validPath = validateVaultPath(args.filename);

      // Check if file is readonly
      await assertNotReadonly(validPath);

      const headers: HeadersInit = {
        Operation: args.operation,
        "Target-Type": args.targetType,
        Target: args.target,
        "Create-Target-If-Missing": "true",
      };

      if (args.targetDelimiter) {
        headers["Target-Delimiter"] = args.targetDelimiter;
      }
      if (args.trimTargetWhitespace !== undefined) {
        headers["Trim-Target-Whitespace"] = String(args.trimTargetWhitespace);
      }
      if (args.contentType) {
        headers["Content-Type"] = args.contentType;
      }

      const response = await makeRequest(
        LocalRestAPI.ApiContentResponse,
        `/vault/${encodeURIComponent(validPath)}`,
        {
          method: "PATCH",
          headers,
          body: args.content,
        },
      );

      return {
        content: [
          { type: "text", text: "File patched successfully" },
          { type: "text", text: response },
        ],
      };
    },
  );

  // DELETE Vault File Content
  tools.register(
    type({
      name: '"delete_vault_file"',
      arguments: {
        filename: "string",
      },
    }).describe("Delete a file from your vault. Respects mcp-protected tag."),
    async ({ arguments: args }) => {
      const validPath = validateVaultPath(args.filename);

      // Check if file is protected
      await assertNotProtected(validPath);

      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(validPath)}`,
        {
          method: "DELETE",
        },
      );
      return {
        content: [{ type: "text", text: "File deleted successfully" }],
      };
    },
  );

  // MOVE Vault File (read + write + delete)
  tools.register(
    type({
      name: '"move_vault_file"',
      arguments: {
        source: type("string").describe("Source file path (vault-relative)"),
        destination: type("string").describe("Destination file path (vault-relative)"),
        "overwrite?": type("boolean").describe("Overwrite destination if it exists (default: false)"),
      },
    }).describe(
      "Move a file from one location to another in your vault. Respects mcp-protected tag.",
    ),
    async ({ arguments: args }) => {
      const sourcePath = validateVaultPath(args.source);
      const destPath = validateVaultPath(args.destination);

      // Check if source is protected (can't move protected files)
      await assertNotProtected(sourcePath);

      // Check if destination exists (unless overwrite is true)
      if (!args.overwrite) {
        try {
          await makeRequest(
            LocalRestAPI.ApiContentResponse,
            `/vault/${encodeURIComponent(destPath)}`,
            { headers: { Accept: "text/markdown" } },
          );
          // If we get here, the file exists
          return {
            content: [{
              type: "text",
              text: `Destination file already exists: ${destPath}. Use overwrite: true to replace it.`,
            }],
            isError: true,
          };
        } catch {
          // File doesn't exist, good to proceed
        }
      }

      // Read source file content
      const content = await makeRequest(
        LocalRestAPI.ApiContentResponse,
        `/vault/${encodeURIComponent(sourcePath)}`,
        { headers: { Accept: "text/markdown" } },
      );

      // Write to destination
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(destPath)}`,
        {
          method: "PUT",
          body: content,
        },
      );

      // Delete source
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(sourcePath)}`,
        {
          method: "DELETE",
        },
      );

      return {
        content: [{
          type: "text",
          text: `File moved successfully: ${sourcePath} → ${destPath}`,
        }],
      };
    },
  );

  // RENAME Vault File (convenience wrapper around move)
  tools.register(
    type({
      name: '"rename_vault_file"',
      arguments: {
        filename: type("string").describe("Current file path (vault-relative)"),
        newName: type("string").describe("New filename (just the name, not path)"),
      },
    }).describe(
      "Rename a file in your vault, keeping it in the same directory. Respects mcp-protected tag.",
    ),
    async ({ arguments: args }) => {
      const sourcePath = validateVaultPath(args.filename);

      // Check if file is protected
      await assertNotProtected(sourcePath);

      // Extract directory from source path
      const lastSlash = sourcePath.lastIndexOf("/");
      const directory = lastSlash >= 0 ? sourcePath.substring(0, lastSlash + 1) : "";
      const destPath = validateVaultPath(directory + args.newName);

      // Read source file content
      const content = await makeRequest(
        LocalRestAPI.ApiContentResponse,
        `/vault/${encodeURIComponent(sourcePath)}`,
        { headers: { Accept: "text/markdown" } },
      );

      // Write to destination
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(destPath)}`,
        {
          method: "PUT",
          body: content,
        },
      );

      // Delete source
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(sourcePath)}`,
        {
          method: "DELETE",
        },
      );

      return {
        content: [{
          type: "text",
          text: `File renamed successfully: ${sourcePath} → ${destPath}`,
        }],
      };
    },
  );

  // BULK DELETE - unified tool for pattern, regex, or search-based deletion
  tools.register(
    type({
      name: '"bulk_delete_files"',
      arguments: {
        match: type("string").describe("The pattern, regex, or search query to match files"),
        "type?": type('"glob" | "regex" | "search"').describe("How to interpret 'match': glob pattern, regex, or search query (default: glob)"),
        "flags?": type("string").describe("Regex flags when type is 'regex' (e.g., 'i' for case-insensitive)"),
        "exclude?": type("string[]").describe("Patterns to exclude (interpreted same as 'type')"),
        "dryRun?": type("boolean").describe("If true (default), only list files without deleting"),
        "limit?": type("number").describe("Maximum files to process (default: 100)"),
      },
    }).describe(
      "Delete multiple vault files matching a glob pattern, regex, or search query. Defaults to dry-run mode for safety.",
    ),
    async ({ arguments: args }) => {
      const matchType = args.type ?? "glob";
      const limit = args.limit ?? 100;
      const dryRun = args.dryRun ?? true;
      const exclude = args.exclude ?? [];

      // Helper to match glob pattern
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
        // Search-based matching
        const searchResults = await makeRequest(
          LocalRestAPI.ApiSimpleSearchResponse,
          `/search/simple/?query=${encodeURIComponent(args.match)}`,
          { method: "POST" },
        );
        matchingFiles = [...new Set(
          searchResults.map((result: { filename: string }) => result.filename)
        )];

        // Apply exclusions as glob patterns
        if (exclude.length > 0) {
          matchingFiles = matchingFiles.filter((file: string) => {
            for (const excludePattern of exclude) {
              if (matchesGlob(file, excludePattern)) return false;
            }
            return true;
          });
        }
      } else if (matchType === "regex") {
        // Regex-based matching
        let matchRegex: RegExp;
        try {
          matchRegex = new RegExp(args.match, args.flags);
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
            }],
            isError: true,
          };
        }

        const excludeRegexes: RegExp[] = [];
        for (const excludePattern of exclude) {
          try {
            excludeRegexes.push(new RegExp(excludePattern, args.flags));
          } catch (error) {
            return {
              content: [{
                type: "text",
                text: `Invalid exclude regex "${excludePattern}": ${error instanceof Error ? error.message : String(error)}`,
              }],
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
        // Glob-based matching (default)
        const allFiles = await makeRequest(
          LocalRestAPI.ApiVaultDirectoryResponse,
          "/vault/",
        );

        matchingFiles = allFiles.files.filter((file: string) => {
          if (!matchesGlob(file, args.match)) return false;
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
          content: [{
            type: "text",
            text: JSON.stringify({
              mode: "dry-run",
              matchType,
              match: args.match,
              matchCount: matchingFiles.length,
              wouldDelete: filesToProcess,
              truncated,
              message: truncated
                ? `Showing first ${limit} of ${matchingFiles.length} matches. Set dryRun: false to delete.`
                : `Found ${matchingFiles.length} files. Set dryRun: false to delete.`,
            }, null, 2),
          }],
        };
      }

      // Actually delete files (respecting mcp-protected tag)
      const deleted: string[] = [];
      const skipped: string[] = [];
      const failed: Array<{ file: string; error: string }> = [];

      for (const file of filesToProcess) {
        try {
          const validPath = validateVaultPath(file);

          // Check if file is protected before deleting
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
        content: [{
          type: "text",
          text: JSON.stringify({
            mode: "delete",
            matchType,
            match: args.match,
            deleted,
            skipped,
            failed,
            deletedCount: deleted.length,
            skippedCount: skipped.length,
            failedCount: failed.length,
            truncated,
          }, null, 2),
        }],
      };
    },
  );

  // FIND LOW VALUE NOTES - vault hygiene tool
  tools.register(
    type({
      name: '"find_low_value_notes"',
      arguments: {
        "directory?": type("string").describe("Directory to search (default: entire vault)"),
        "limit?": type("number").describe("Maximum notes to return (default: 20)"),
        "minScore?": type("number").describe("Only return notes with score below this threshold (default: 50)"),
        "includeDetails?": type("boolean").describe("Include detailed scoring breakdown (default: false)"),
      },
    }).describe(
      "Find notes that may need attention: minimal frontmatter, sparse content, no links. Returns notes sorted by 'value score' (lower = less rich).",
    ),
    async ({ arguments: args }) => {
      const limit = args.limit ?? 20;
      const minScore = args.minScore ?? 50;
      const includeDetails = args.includeDetails ?? false;

      // Get all markdown files
      const validPath = validateOptionalPath(args.directory);
      const path = validPath ? `${validPath}/` : "";
      const allFiles = await makeRequest(
        LocalRestAPI.ApiVaultDirectoryResponse,
        `/vault/${path}`,
      );

      // Filter to markdown files only
      const mdFiles = allFiles.files.filter((f: string) => f.endsWith(".md"));

      // Score each note
      type NoteScore = {
        path: string;
        score: number;
        details?: {
          frontmatterFields: number;
          frontmatterScore: number;
          contentLength: number;
          contentScore: number;
          wordCount: number;
          wordScore: number;
          tagCount: number;
          tagScore: number;
          linkCount: number;
          linkScore: number;
          hasTitle: boolean;
          titleScore: number;
        };
      };

      const scores: NoteScore[] = [];

      for (const filePath of mdFiles) {
        try {
          // Skip hidden files
          if (await isHidden(filePath)) continue;

          // Fetch note metadata
          const note = await makeRequest(
            LocalRestAPI.ApiNoteJson,
            `/vault/${encodeURIComponent(filePath)}`,
            { headers: { Accept: "application/vnd.olrapi.note+json" } },
          );

          // Calculate scoring components
          const frontmatterFields = Object.keys(note.frontmatter || {}).length;
          const content = note.content || "";

          // Strip frontmatter from content for analysis
          const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, "").trim();
          const contentLength = contentWithoutFrontmatter.length;
          const wordCount = contentWithoutFrontmatter.split(/\s+/).filter((w: string) => w.length > 0).length;

          // Count internal links [[...]]
          const linkMatches = contentWithoutFrontmatter.match(/\[\[([^\]]+)\]\]/g);
          const linkCount = linkMatches ? linkMatches.length : 0;

          // Tag count
          const tagCount = (note.tags || []).length;

          // Check if note has a title (first heading or filename-based)
          const hasTitle = /^#\s+.+/m.test(contentWithoutFrontmatter) || frontmatterFields > 0;

          // Calculate component scores (each 0-20, total max 100)
          const frontmatterScore = Math.min(frontmatterFields * 4, 20); // 5 fields = max
          const contentScore = Math.min(Math.floor(contentLength / 50), 20); // 1000 chars = max
          const wordScore = Math.min(Math.floor(wordCount / 10), 20); // 200 words = max
          const tagScore = Math.min(tagCount * 5, 20); // 4 tags = max
          const linkScore = Math.min(linkCount * 4, 20); // 5 links = max

          const totalScore = frontmatterScore + contentScore + wordScore + tagScore + linkScore;

          const scoreEntry: NoteScore = {
            path: filePath,
            score: totalScore,
          };

          if (includeDetails) {
            scoreEntry.details = {
              frontmatterFields,
              frontmatterScore,
              contentLength,
              contentScore,
              wordCount,
              wordScore,
              tagCount,
              tagScore,
              linkCount,
              linkScore,
              hasTitle,
              titleScore: hasTitle ? 0 : -10, // Penalty shown but not applied to keep max at 100
            };
          }

          scores.push(scoreEntry);
        } catch {
          // Skip files that can't be read (binary, etc.)
          continue;
        }
      }

      // Sort by score ascending (lowest value first)
      scores.sort((a, b) => a.score - b.score);

      // Filter to notes below threshold and apply limit
      const lowValueNotes = scores
        .filter((n) => n.score < minScore)
        .slice(0, limit);

      const result = {
        totalNotesScanned: mdFiles.length,
        notesAnalyzed: scores.length,
        lowValueCount: scores.filter((n) => n.score < minScore).length,
        threshold: minScore,
        notes: lowValueNotes,
        scoringGuide: {
          max: 100,
          components: {
            frontmatter: "0-20 (4 pts per field, max 5 fields)",
            content: "0-20 (1 pt per 50 chars, max 1000 chars)",
            words: "0-20 (1 pt per 10 words, max 200 words)",
            tags: "0-20 (5 pts per tag, max 4 tags)",
            links: "0-20 (4 pts per [[link]], max 5 links)",
          },
        },
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // FIND ORPHAN ATTACHMENTS - vault hygiene tool
  tools.register(
    type({
      name: '"find_orphan_attachments"',
      arguments: {
        "directory?": type("string").describe("Directory to search (default: entire vault)"),
        "extensions?": type("string[]").describe("File extensions to check (default: common image/doc types)"),
        "limit?": type("number").describe("Maximum results to return (default: 50)"),
      },
    }).describe(
      "Find attachment files (images, PDFs, etc.) not referenced by any note. Helps reclaim space from unused files.",
    ),
    async ({ arguments: args }) => {
      const limit = args.limit ?? 50;
      const defaultExtensions = [
        // Images
        "png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico",
        // Documents
        "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
        // Media
        "mp3", "mp4", "wav", "webm", "ogg", "m4a",
        // Archives
        "zip", "rar", "7z", "tar", "gz",
        // Other
        "json", "csv", "xml",
      ];
      const extensions = args.extensions ?? defaultExtensions;
      const extSet = new Set(extensions.map((e: string) => e.toLowerCase()));

      // Get all files in vault
      const validPath = validateOptionalPath(args.directory);
      const path = validPath ? `${validPath}/` : "";
      const allFiles = await makeRequest(
        LocalRestAPI.ApiVaultDirectoryResponse,
        `/vault/${path}`,
      );

      // Separate markdown files and potential attachments
      const mdFiles: string[] = [];
      const attachments: string[] = [];

      for (const file of allFiles.files) {
        if (file.endsWith(".md")) {
          mdFiles.push(file);
        } else {
          const ext = file.split(".").pop()?.toLowerCase();
          if (ext && extSet.has(ext)) {
            attachments.push(file);
          }
        }
      }

      // Build a set of all referenced files from markdown content
      const referencedFiles = new Set<string>();

      for (const mdFile of mdFiles) {
        try {
          // Skip hidden files
          if (await isHidden(mdFile)) continue;

          const content = await makeRequest(
            LocalRestAPI.ApiContentResponse,
            `/vault/${encodeURIComponent(mdFile)}`,
            { headers: { Accept: "text/markdown" } },
          );

          // Extract all potential file references
          // Obsidian wiki-style: ![[file.png]] or [[file.pdf]]
          const wikiLinks = content.match(/!?\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g) || [];
          for (const link of wikiLinks) {
            const match = link.match(/!?\[\[([^\]|]+)/);
            if (match) {
              const ref = match[1].trim();
              // Add both the reference as-is and with common variations
              referencedFiles.add(ref);
              referencedFiles.add(ref.toLowerCase());
              // Handle references without extension
              for (const ext of extensions) {
                referencedFiles.add(`${ref}.${ext}`);
                referencedFiles.add(`${ref}.${ext}`.toLowerCase());
              }
            }
          }

          // Standard markdown: ![alt](path) or [text](path)
          const mdLinks = content.match(/!?\[[^\]]*\]\(([^)]+)\)/g) || [];
          for (const link of mdLinks) {
            const match = link.match(/!?\[[^\]]*\]\(([^)]+)\)/);
            if (match) {
              let ref = match[1].trim();
              // Remove URL encoding and query strings
              ref = decodeURIComponent(ref.split("?")[0].split("#")[0]);
              referencedFiles.add(ref);
              referencedFiles.add(ref.toLowerCase());
            }
          }

          // HTML img tags: <img src="path">
          const imgTags = content.match(/<img[^>]+src=["']([^"']+)["']/gi) || [];
          for (const tag of imgTags) {
            const match = tag.match(/src=["']([^"']+)["']/i);
            if (match) {
              const ref = match[1].trim();
              referencedFiles.add(ref);
              referencedFiles.add(ref.toLowerCase());
            }
          }
        } catch {
          // Skip files that can't be read
          continue;
        }
      }

      // Find orphan attachments (not referenced anywhere)
      const orphans: Array<{ path: string; extension: string; size?: number }> = [];

      for (const attachment of attachments) {
        try {
          if (await isHidden(attachment)) continue;

          // Check if this attachment is referenced
          const filename = attachment.split("/").pop() || attachment;
          const filenameNoExt = filename.replace(/\.[^.]+$/, "");
          const attachmentLower = attachment.toLowerCase();
          const filenameLower = filename.toLowerCase();

          const isReferenced =
            referencedFiles.has(attachment) ||
            referencedFiles.has(attachmentLower) ||
            referencedFiles.has(filename) ||
            referencedFiles.has(filenameLower) ||
            referencedFiles.has(filenameNoExt) ||
            referencedFiles.has(filenameNoExt.toLowerCase());

          if (!isReferenced) {
            const ext = attachment.split(".").pop()?.toLowerCase() || "";
            orphans.push({ path: attachment, extension: ext });
          }
        } catch {
          continue;
        }
      }

      // Sort by path and apply limit
      orphans.sort((a, b) => a.path.localeCompare(b.path));
      const limitedOrphans = orphans.slice(0, limit);

      // Group by extension for summary
      const byExtension: Record<string, number> = {};
      for (const orphan of orphans) {
        byExtension[orphan.extension] = (byExtension[orphan.extension] || 0) + 1;
      }

      const result = {
        totalAttachmentsScanned: attachments.length,
        totalMarkdownFiles: mdFiles.length,
        orphanCount: orphans.length,
        byExtension,
        orphans: limitedOrphans,
        truncated: orphans.length > limit,
        hint: orphans.length > 0
          ? "Review these files and delete unused ones with bulk_delete_files tool"
          : "No orphan attachments found - your vault is clean!",
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // FIND BROKEN LINKS - vault hygiene tool
  tools.register(
    type({
      name: '"find_broken_links"',
      arguments: {
        "directory?": type("string").describe("Directory to search (default: entire vault)"),
        "limit?": type("number").describe("Maximum results to return (default: 50)"),
        "includeEmbeds?": type("boolean").describe("Include broken embeds ![[...]] (default: true)"),
      },
    }).describe(
      "Find internal links [[...]] pointing to non-existent files. Helps fix dead links in your vault.",
    ),
    async ({ arguments: args }) => {
      const limit = args.limit ?? 50;
      const includeEmbeds = args.includeEmbeds ?? true;

      // Get all files in vault
      const validPath = validateOptionalPath(args.directory);
      const path = validPath ? `${validPath}/` : "";
      const allFiles = await makeRequest(
        LocalRestAPI.ApiVaultDirectoryResponse,
        `/vault/${path}`,
      );

      // Build set of existing files (normalized for comparison)
      const existingFiles = new Set<string>();
      const existingFilesLower = new Set<string>();
      for (const file of allFiles.files) {
        existingFiles.add(file);
        existingFilesLower.add(file.toLowerCase());
        // Also add without extension for wiki-link matching
        const noExt = file.replace(/\.[^.]+$/, "");
        existingFiles.add(noExt);
        existingFilesLower.add(noExt.toLowerCase());
        // Add just filename without path
        const filename = file.split("/").pop() || file;
        const filenameNoExt = filename.replace(/\.[^.]+$/, "");
        existingFiles.add(filename);
        existingFilesLower.add(filename.toLowerCase());
        existingFiles.add(filenameNoExt);
        existingFilesLower.add(filenameNoExt.toLowerCase());
      }

      // Filter to markdown files
      const mdFiles = allFiles.files.filter((f: string) => f.endsWith(".md"));

      type BrokenLink = {
        sourceFile: string;
        link: string;
        lineNumber?: number;
        isEmbed: boolean;
      };

      const brokenLinks: BrokenLink[] = [];

      for (const mdFile of mdFiles) {
        try {
          if (await isHidden(mdFile)) continue;

          const content = await makeRequest(
            LocalRestAPI.ApiContentResponse,
            `/vault/${encodeURIComponent(mdFile)}`,
            { headers: { Accept: "text/markdown" } },
          );

          const lines = content.split("\n");

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Match wiki-links: [[target]] or [[target|alias]] or ![[embed]]
            const wikiLinkRegex = /(!?)\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;
            let match;

            while ((match = wikiLinkRegex.exec(line)) !== null) {
              const isEmbed = match[1] === "!";
              const target = match[2].trim();

              // Skip if we're not including embeds and this is an embed
              if (isEmbed && !includeEmbeds) continue;

              // Skip external links (http, https, etc.)
              if (/^https?:\/\//.test(target)) continue;

              // Skip block references and heading links within same file
              if (target === "" || target.startsWith("#")) continue;

              // Check if target exists
              const targetLower = target.toLowerCase();
              const targetWithMd = target.endsWith(".md") ? target : `${target}.md`;
              const targetWithMdLower = targetWithMd.toLowerCase();

              const exists =
                existingFiles.has(target) ||
                existingFilesLower.has(targetLower) ||
                existingFiles.has(targetWithMd) ||
                existingFilesLower.has(targetWithMdLower);

              if (!exists) {
                brokenLinks.push({
                  sourceFile: mdFile,
                  link: target,
                  lineNumber: i + 1,
                  isEmbed,
                });
              }
            }
          }
        } catch {
          continue;
        }
      }

      // Sort by source file and apply limit
      brokenLinks.sort((a, b) => {
        const fileCompare = a.sourceFile.localeCompare(b.sourceFile);
        if (fileCompare !== 0) return fileCompare;
        return (a.lineNumber || 0) - (b.lineNumber || 0);
      });

      const limitedLinks = brokenLinks.slice(0, limit);

      // Group by source file for summary
      const bySourceFile: Record<string, number> = {};
      for (const link of brokenLinks) {
        bySourceFile[link.sourceFile] = (bySourceFile[link.sourceFile] || 0) + 1;
      }

      // Count embeds vs links
      const embedCount = brokenLinks.filter((l) => l.isEmbed).length;
      const linkCount = brokenLinks.length - embedCount;

      const result = {
        totalMarkdownFiles: mdFiles.length,
        brokenLinkCount: brokenLinks.length,
        brokenEmbedCount: embedCount,
        brokenWikilinkCount: linkCount,
        filesWithBrokenLinks: Object.keys(bySourceFile).length,
        brokenLinks: limitedLinks,
        truncated: brokenLinks.length > limit,
        hint: brokenLinks.length > 0
          ? "Create missing notes or update links to fix these references"
          : "No broken links found - your vault links are healthy!",
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // FIND EMPTY NOTES - vault hygiene tool
  tools.register(
    type({
      name: '"find_empty_notes"',
      arguments: {
        "directory?": type("string").describe("Directory to search (default: entire vault)"),
        "limit?": type("number").describe("Maximum results to return (default: 50)"),
        "maxContentLength?": type("number").describe("Max content length to consider 'empty' (default: 50 chars)"),
      },
    }).describe(
      "Find notes with no meaningful content - just frontmatter, whitespace, or minimal text.",
    ),
    async ({ arguments: args }) => {
      const limit = args.limit ?? 50;
      const maxContentLength = args.maxContentLength ?? 50;

      // Get all files
      const validPath = validateOptionalPath(args.directory);
      const path = validPath ? `${validPath}/` : "";
      const allFiles = await makeRequest(
        LocalRestAPI.ApiVaultDirectoryResponse,
        `/vault/${path}`,
      );

      const mdFiles = allFiles.files.filter((f: string) => f.endsWith(".md"));

      type EmptyNote = {
        path: string;
        contentLength: number;
        hasOnlyFrontmatter: boolean;
        hasOnlyWhitespace: boolean;
        hasOnlyTemplate: boolean;
      };

      const emptyNotes: EmptyNote[] = [];

      for (const mdFile of mdFiles) {
        try {
          if (await isHidden(mdFile)) continue;

          const content = await makeRequest(
            LocalRestAPI.ApiContentResponse,
            `/vault/${encodeURIComponent(mdFile)}`,
            { headers: { Accept: "text/markdown" } },
          );

          // Strip frontmatter
          const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n?/, "").trim();

          // Check various "empty" conditions
          const hasOnlyFrontmatter = content.match(/^---[\s\S]*?---\s*$/) !== null;
          const hasOnlyWhitespace = contentWithoutFrontmatter.length === 0;
          const hasOnlyTemplate = /^<%[^%]*%>\s*$/.test(contentWithoutFrontmatter);

          const isEmpty = hasOnlyFrontmatter ||
                          hasOnlyWhitespace ||
                          hasOnlyTemplate ||
                          contentWithoutFrontmatter.length <= maxContentLength;

          if (isEmpty) {
            emptyNotes.push({
              path: mdFile,
              contentLength: contentWithoutFrontmatter.length,
              hasOnlyFrontmatter,
              hasOnlyWhitespace,
              hasOnlyTemplate,
            });
          }
        } catch {
          continue;
        }
      }

      // Sort by content length (emptiest first)
      emptyNotes.sort((a, b) => a.contentLength - b.contentLength);
      const limitedNotes = emptyNotes.slice(0, limit);

      // Categorize for summary
      const onlyFrontmatter = emptyNotes.filter((n) => n.hasOnlyFrontmatter).length;
      const onlyWhitespace = emptyNotes.filter((n) => n.hasOnlyWhitespace).length;
      const onlyTemplate = emptyNotes.filter((n) => n.hasOnlyTemplate).length;

      const result = {
        totalNotesScanned: mdFiles.length,
        emptyCount: emptyNotes.length,
        breakdown: {
          onlyFrontmatter,
          onlyWhitespace,
          onlyTemplate,
          minimalContent: emptyNotes.length - onlyFrontmatter - onlyWhitespace - onlyTemplate,
        },
        threshold: maxContentLength,
        emptyNotes: limitedNotes,
        truncated: emptyNotes.length > limit,
        hint: emptyNotes.length > 0
          ? "Review these notes - add content or delete if unneeded"
          : "No empty notes found!",
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );

  // FIND DUPLICATE NOTES - vault hygiene tool
  tools.register(
    type({
      name: '"find_duplicate_notes"',
      arguments: {
        "directory?": type("string").describe("Directory to search (default: entire vault)"),
        "method?": type('"filename" | "content" | "both"').describe("How to detect duplicates (default: both)"),
        "limit?": type("number").describe("Maximum duplicate groups to return (default: 20)"),
        "minSimilarity?": type("number").describe("Min similarity 0-100 for content matching (default: 100 = exact)"),
      },
    }).describe(
      "Find duplicate notes by filename or content. Helps consolidate redundant notes.",
    ),
    async ({ arguments: args }) => {
      const limit = args.limit ?? 20;
      const method = args.method ?? "both";
      const minSimilarity = args.minSimilarity ?? 100;

      // Get all files
      const validPath = validateOptionalPath(args.directory);
      const path = validPath ? `${validPath}/` : "";
      const allFiles = await makeRequest(
        LocalRestAPI.ApiVaultDirectoryResponse,
        `/vault/${path}`,
      );

      const mdFiles = allFiles.files.filter((f: string) => f.endsWith(".md"));

      type DuplicateGroup = {
        type: "filename" | "content";
        key: string;
        files: Array<{
          path: string;
          size: number;
          mtime: number;
        }>;
      };

      const duplicateGroups: DuplicateGroup[] = [];

      // Find filename duplicates
      if (method === "filename" || method === "both") {
        const byFilename = new Map<string, string[]>();

        for (const file of mdFiles) {
          const filename = file.split("/").pop() || file;
          const existing = byFilename.get(filename.toLowerCase()) || [];
          existing.push(file);
          byFilename.set(filename.toLowerCase(), existing);
        }

        for (const [filename, files] of byFilename) {
          if (files.length > 1) {
            const fileDetails = await Promise.all(
              files.map(async (f) => {
                try {
                  const note = await makeRequest(
                    LocalRestAPI.ApiNoteJson,
                    `/vault/${encodeURIComponent(f)}`,
                    { headers: { Accept: "application/vnd.olrapi.note+json" } },
                  );
                  return {
                    path: f,
                    size: note.stat?.size || 0,
                    mtime: note.stat?.mtime || 0,
                  };
                } catch {
                  return { path: f, size: 0, mtime: 0 };
                }
              })
            );

            duplicateGroups.push({
              type: "filename",
              key: filename,
              files: fileDetails.sort((a, b) => b.mtime - a.mtime), // newest first
            });
          }
        }
      }

      // Find content duplicates (exact match via hash)
      if (method === "content" || method === "both") {
        const byContentHash = new Map<string, string[]>();

        // Simple hash function for content comparison
        const simpleHash = (str: string): string => {
          let hash = 0;
          const normalized = str.replace(/^---[\s\S]*?---\n?/, "").trim().toLowerCase();
          for (let i = 0; i < normalized.length; i++) {
            const char = normalized.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
          }
          return hash.toString(16);
        };

        for (const file of mdFiles) {
          try {
            if (await isHidden(file)) continue;

            const content = await makeRequest(
              LocalRestAPI.ApiContentResponse,
              `/vault/${encodeURIComponent(file)}`,
              { headers: { Accept: "text/markdown" } },
            );

            // Skip very short content (likely empty notes)
            const cleanContent = content.replace(/^---[\s\S]*?---\n?/, "").trim();
            if (cleanContent.length < 50) continue;

            const hash = simpleHash(content);
            const existing = byContentHash.get(hash) || [];
            existing.push(file);
            byContentHash.set(hash, existing);
          } catch {
            continue;
          }
        }

        for (const [hash, files] of byContentHash) {
          if (files.length > 1) {
            // Verify they're not already in filename duplicates
            const filenames = files.map((f) => (f.split("/").pop() || f).toLowerCase());
            const allSameFilename = filenames.every((f) => f === filenames[0]);

            // Skip if this is already captured by filename duplicates
            if (method === "both" && allSameFilename) continue;

            const fileDetails = await Promise.all(
              files.map(async (f) => {
                try {
                  const note = await makeRequest(
                    LocalRestAPI.ApiNoteJson,
                    `/vault/${encodeURIComponent(f)}`,
                    { headers: { Accept: "application/vnd.olrapi.note+json" } },
                  );
                  return {
                    path: f,
                    size: note.stat?.size || 0,
                    mtime: note.stat?.mtime || 0,
                  };
                } catch {
                  return { path: f, size: 0, mtime: 0 };
                }
              })
            );

            duplicateGroups.push({
              type: "content",
              key: `content-hash-${hash}`,
              files: fileDetails.sort((a, b) => b.mtime - a.mtime),
            });
          }
        }
      }

      // Sort by number of duplicates (most dupes first) and apply limit
      duplicateGroups.sort((a, b) => b.files.length - a.files.length);
      const limitedGroups = duplicateGroups.slice(0, limit);

      // Calculate totals
      const totalDuplicateFiles = duplicateGroups.reduce((sum, g) => sum + g.files.length - 1, 0);
      const filenameGroups = duplicateGroups.filter((g) => g.type === "filename").length;
      const contentGroups = duplicateGroups.filter((g) => g.type === "content").length;

      const result = {
        totalNotesScanned: mdFiles.length,
        duplicateGroups: duplicateGroups.length,
        totalDuplicateFiles,
        byType: {
          filenameDuplicates: filenameGroups,
          contentDuplicates: contentGroups,
        },
        groups: limitedGroups,
        truncated: duplicateGroups.length > limit,
        hint: duplicateGroups.length > 0
          ? "Review each group - keep the newest/largest and remove or merge others"
          : "No duplicate notes found!",
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
      };
    },
  );
}
