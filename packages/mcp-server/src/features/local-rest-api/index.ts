import {
  makeRequest,
  validateVaultPath,
  validateOptionalPath,
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
    }).describe("Update the content of the active file open in Obsidian."),
    async ({ arguments: args }) => {
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
    }).describe("Append content to the end of the currently-open note."),
    async ({ arguments: args }) => {
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
      "Insert or modify content in the currently-open note relative to a heading, block reference, or frontmatter field.",
    ),
    async ({ arguments: args }) => {
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
    }).describe("Delete the currently-active file in Obsidian."),
    async () => {
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
    }).describe("Create a new file in your vault or update an existing one."),
    async ({ arguments: args }) => {
      const validPath = validateVaultPath(args.filename);
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
    }).describe("Append content to a new or existing file."),
    async ({ arguments: args }) => {
      const validPath = validateVaultPath(args.filename);
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
      "Insert or modify content in a file relative to a heading, block reference, or frontmatter field.",
    ),
    async ({ arguments: args }) => {
      const validPath = validateVaultPath(args.filename);
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
    }).describe("Delete a file from your vault."),
    async ({ arguments: args }) => {
      const validPath = validateVaultPath(args.filename);
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
      "Move a file from one location to another in your vault. This reads the source file, writes it to the destination, and deletes the source.",
    ),
    async ({ arguments: args }) => {
      const sourcePath = validateVaultPath(args.source);
      const destPath = validateVaultPath(args.destination);

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
      "Rename a file in your vault, keeping it in the same directory.",
    ),
    async ({ arguments: args }) => {
      const sourcePath = validateVaultPath(args.filename);

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

      // Actually delete files
      const deleted: string[] = [];
      const failed: Array<{ file: string; error: string }> = [];

      for (const file of filesToProcess) {
        try {
          const validPath = validateVaultPath(file);
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
            failed,
            deletedCount: deleted.length,
            failedCount: failed.length,
            truncated,
          }, null, 2),
        }],
      };
    },
  );
}
