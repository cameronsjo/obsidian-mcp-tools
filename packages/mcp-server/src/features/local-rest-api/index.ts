import {
  makeRequest,
  validateVaultPath,
  validateOptionalPath,
  assertNotProtected,
  assertNotReadonly,
  isHidden,
  MCP_TAGS,
  SCOPES,
  requireScopeInSession,
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
      requireScopeInSession(SCOPES.VAULT_READ);

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
      requireScopeInSession(SCOPES.VAULT_WRITE);

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
      requireScopeInSession(SCOPES.VAULT_WRITE);

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
      requireScopeInSession(SCOPES.VAULT_WRITE);

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
      requireScopeInSession(SCOPES.VAULT_DELETE);

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
      requireScopeInSession(SCOPES.PLUGINS_EXECUTE);

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
      requireScopeInSession(SCOPES.VAULT_SEARCH);

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
      requireScopeInSession(SCOPES.VAULT_SEARCH);

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
      requireScopeInSession(SCOPES.VAULT_LIST);

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
      requireScopeInSession(SCOPES.VAULT_READ);

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
      requireScopeInSession(SCOPES.VAULT_WRITE);

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
      requireScopeInSession(SCOPES.VAULT_WRITE);

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
      requireScopeInSession(SCOPES.VAULT_WRITE);

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
      requireScopeInSession(SCOPES.VAULT_DELETE);

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
      requireScopeInSession(SCOPES.VAULT_MOVE);

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
      requireScopeInSession(SCOPES.VAULT_MOVE);

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
      requireScopeInSession(SCOPES.VAULT_DELETE);

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

  // FIND ORPHAN ATTACHMENTS - vault hygiene tool
  tools.register(
    type({
      name: '"find_orphan_attachments"',
      arguments: {
        "extensions?": type("string[]").describe("File extensions to check (default: common image/media types)"),
        "limit?": type("number").describe("Maximum results to return (default: 100)"),
      },
    }).describe(
      "Find attachment files (images, PDFs, etc.) that are not referenced by any note in the vault.",
    ),
    async ({ arguments: args }) => {
      requireScopeInSession(SCOPES.VAULT_SEARCH);

      const defaultExtensions = [
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp",
        ".pdf", ".mp3", ".mp4", ".webm", ".wav", ".ogg",
        ".zip", ".tar", ".gz", ".rar",
      ];
      const extensions = args.extensions ?? defaultExtensions;
      const limit = args.limit ?? 100;

      // Get all files in vault
      const allFiles = await makeRequest(
        LocalRestAPI.ApiVaultDirectoryResponse,
        "/vault/",
      );

      // Find attachment files
      const attachmentFiles = allFiles.files.filter((file: string) => {
        const ext = file.substring(file.lastIndexOf(".")).toLowerCase();
        return extensions.includes(ext);
      });

      // Find markdown files
      const markdownFiles = allFiles.files.filter((file: string) =>
        file.endsWith(".md")
      );

      // Build set of referenced attachments by reading each markdown file
      const referencedAttachments = new Set<string>();

      // Pattern to match wiki-style links: [[filename]] or [[filename|alias]]
      // and markdown-style: ![alt](path) or [text](path)
      const linkPatterns = [
        /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g,  // Wiki links
        /!\[[^\]]*\]\(([^)]+)\)/g,           // Image embeds
        /\[[^\]]*\]\(([^)]+)\)/g,            // Markdown links
      ];

      for (const mdFile of markdownFiles.slice(0, 500)) { // Limit to avoid timeout
        try {
          const content = await makeRequest(
            LocalRestAPI.ApiContentResponse,
            `/vault/${encodeURIComponent(mdFile)}`,
            { headers: { Accept: "text/markdown" } },
          );

          for (const pattern of linkPatterns) {
            let match;
            const regex = new RegExp(pattern.source, pattern.flags);
            while ((match = regex.exec(content)) !== null) {
              const linked = match[1];
              // Normalize: could be just filename or path
              const normalized = linked.split("/").pop()?.split("#")[0]?.split("|")[0] ?? linked;
              referencedAttachments.add(normalized.toLowerCase());
              // Also add with common extensions if no extension
              if (!normalized.includes(".")) {
                for (const ext of extensions) {
                  referencedAttachments.add((normalized + ext).toLowerCase());
                }
              }
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }

      // Find orphans
      const orphans = attachmentFiles.filter((file: string) => {
        const filename = file.split("/").pop()?.toLowerCase() ?? "";
        return !referencedAttachments.has(filename);
      });

      const results = orphans.slice(0, limit);
      const truncated = orphans.length > limit;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            orphanCount: orphans.length,
            totalAttachments: attachmentFiles.length,
            markdownFilesScanned: Math.min(markdownFiles.length, 500),
            orphans: results,
            truncated,
            message: truncated
              ? `Showing first ${limit} of ${orphans.length} orphan attachments.`
              : `Found ${orphans.length} orphan attachments out of ${attachmentFiles.length} total.`,
          }, null, 2),
        }],
      };
    },
  );

  // FIND BROKEN LINKS - vault hygiene tool
  tools.register(
    type({
      name: '"find_broken_links"',
      arguments: {
        "limit?": type("number").describe("Maximum results to return (default: 100)"),
      },
    }).describe(
      "Find internal links in notes that point to non-existent files.",
    ),
    async ({ arguments: args }) => {
      requireScopeInSession(SCOPES.VAULT_SEARCH);

      const limit = args.limit ?? 100;

      // Get all files in vault
      const allFiles = await makeRequest(
        LocalRestAPI.ApiVaultDirectoryResponse,
        "/vault/",
      );

      // Build set of existing files (normalized)
      const existingFiles = new Set<string>();
      for (const file of allFiles.files) {
        // Add full path and just filename (for wiki-style links)
        existingFiles.add(file.toLowerCase());
        const filename = file.split("/").pop() ?? "";
        existingFiles.add(filename.toLowerCase());
        // Also without extension for wiki links
        if (filename.includes(".")) {
          existingFiles.add(filename.substring(0, filename.lastIndexOf(".")).toLowerCase());
        }
      }

      // Find markdown files
      const markdownFiles = allFiles.files.filter((file: string) =>
        file.endsWith(".md")
      );

      const brokenLinks: Array<{ file: string; link: string; line?: number }> = [];

      // Pattern to match internal links
      const wikiLinkPattern = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;

      for (const mdFile of markdownFiles.slice(0, 500)) { // Limit to avoid timeout
        try {
          const content = await makeRequest(
            LocalRestAPI.ApiContentResponse,
            `/vault/${encodeURIComponent(mdFile)}`,
            { headers: { Accept: "text/markdown" } },
          );

          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let match;
            const regex = new RegExp(wikiLinkPattern.source, wikiLinkPattern.flags);
            while ((match = regex.exec(line)) !== null) {
              const linkedFile = match[1].trim();

              // Skip external links, embeds of web content
              if (linkedFile.startsWith("http://") || linkedFile.startsWith("https://")) {
                continue;
              }

              // Check if target exists
              const normalized = linkedFile.toLowerCase();
              const normalizedWithMd = normalized.endsWith(".md") ? normalized : normalized + ".md";

              const exists =
                existingFiles.has(normalized) ||
                existingFiles.has(normalizedWithMd) ||
                existingFiles.has(normalized.split("/").pop() ?? "") ||
                existingFiles.has((normalized.split("/").pop() ?? "") + ".md");

              if (!exists) {
                brokenLinks.push({
                  file: mdFile,
                  link: linkedFile,
                  line: i + 1,
                });
              }
            }
          }
        } catch {
          // Skip files that can't be read
        }

        if (brokenLinks.length >= limit) break;
      }

      const results = brokenLinks.slice(0, limit);
      const truncated = brokenLinks.length > limit;

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            brokenLinkCount: brokenLinks.length,
            markdownFilesScanned: Math.min(markdownFiles.length, 500),
            brokenLinks: results,
            truncated,
            message: truncated
              ? `Showing first ${limit} of ${brokenLinks.length} broken links.`
              : `Found ${brokenLinks.length} broken links.`,
          }, null, 2),
        }],
      };
    },
  );
}
