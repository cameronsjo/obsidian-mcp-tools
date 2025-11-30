/**
 * Vault API Proxy
 *
 * Provides a clean API surface for sandboxed code to interact with the vault.
 * All operations are validated against authorization scopes and MCP protection tags.
 */

import { LocalRestAPI } from "shared";
import {
  makeRequest,
  validateVaultPath,
  assertNotProtected,
  assertNotReadonly,
  isHidden,
  SCOPES,
  requireScopeInSession,
} from "$/shared";
import type {
  VaultAPI,
  NoteJson,
  FileStat,
  SearchResult,
  SearchOptions,
  ReadOptions,
  BulkResult,
  BulkDeleteOptions,
  PluginsAPI,
} from "./types";

/**
 * Creates a VaultAPI proxy that enforces scopes and protection tags.
 *
 * This is the actual implementation that sandboxed code calls into.
 * Each method validates permissions before delegating to the Local REST API.
 */
export function createVaultProxy(): VaultAPI {
  return {
    async read(
      path: string,
      options?: ReadOptions,
    ): Promise<string | NoteJson> {
      requireScopeInSession(SCOPES.VAULT_READ);
      validateVaultPath(path);

      // Hidden files appear as "not found"
      if (await isHidden(path)) {
        throw new Error(`File not found: ${path}`);
      }

      const format =
        options?.format === "json"
          ? "application/vnd.olrapi.note+json"
          : "text/markdown";

      const data = await makeRequest(
        LocalRestAPI.ApiNoteJson.or("string"),
        `/vault/${encodeURIComponent(path)}`,
        {
          headers: { Accept: format },
        },
      );

      if (options?.format === "json" && typeof data === "object") {
        return {
          path,
          content: data.content ?? "",
          frontmatter: data.frontmatter,
          tags: data.tags,
        } as NoteJson;
      }

      return data as string;
    },

    async list(directory?: string): Promise<string[]> {
      requireScopeInSession(SCOPES.VAULT_LIST);

      if (directory) {
        validateVaultPath(directory);
      }

      const encodedPath = directory ? encodeURIComponent(directory) : "";
      const data = await makeRequest(
        LocalRestAPI.ApiVaultDirectoryResponse,
        `/vault/${encodedPath}`,
        {
          headers: { Accept: "application/json" },
        },
      );

      // Filter out hidden files
      const files = data.files as string[] ?? [];
      const visibleFiles: string[] = [];
      for (const file of files) {
        if (!(await isHidden(file))) {
          visibleFiles.push(file);
        }
      }

      return visibleFiles;
    },

    async exists(path: string): Promise<boolean> {
      requireScopeInSession(SCOPES.VAULT_READ);
      validateVaultPath(path);

      // Hidden files don't "exist" to sandboxed code
      if (await isHidden(path)) {
        return false;
      }

      try {
        await makeRequest(
          LocalRestAPI.ApiNoteJson.or("string"),
          `/vault/${encodeURIComponent(path)}`,
          {
            headers: { Accept: "text/markdown" },
          },
        );
        return true;
      } catch {
        return false;
      }
    },

    async stat(path: string): Promise<FileStat> {
      requireScopeInSession(SCOPES.VAULT_READ);
      validateVaultPath(path);

      if (await isHidden(path)) {
        throw new Error(`File not found: ${path}`);
      }

      const data = await makeRequest(
        LocalRestAPI.ApiNoteJson,
        `/vault/${encodeURIComponent(path)}`,
        {
          headers: { Accept: "application/vnd.olrapi.note+json" },
        },
      );

      // Extract stats from the response
      // Note: Local REST API may not provide all fields, so we use defaults
      return {
        ctime: data.stat?.ctime ?? Date.now(),
        mtime: data.stat?.mtime ?? Date.now(),
        size: data.content?.length ?? 0,
        extension: path.substring(path.lastIndexOf(".")),
      };
    },

    async write(path: string, content: string): Promise<void> {
      requireScopeInSession(SCOPES.VAULT_WRITE);
      validateVaultPath(path);

      // Check if file exists and is readonly (for overwrites)
      try {
        await assertNotReadonly(path);
      } catch {
        // File doesn't exist, that's fine for new files
      }

      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(path)}`,
        {
          method: "PUT",
          body: content,
        },
      );
    },

    async append(path: string, content: string): Promise<void> {
      requireScopeInSession(SCOPES.VAULT_WRITE);
      validateVaultPath(path);
      await assertNotReadonly(path);

      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(path)}`,
        {
          method: "POST",
          body: content,
        },
      );
    },

    async delete(path: string): Promise<void> {
      requireScopeInSession(SCOPES.VAULT_DELETE);
      validateVaultPath(path);
      await assertNotProtected(path);

      if (await isHidden(path)) {
        throw new Error(`File not found: ${path}`);
      }

      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(path)}`,
        {
          method: "DELETE",
        },
      );
    },

    async move(source: string, destination: string): Promise<void> {
      requireScopeInSession(SCOPES.VAULT_MOVE);
      validateVaultPath(source);
      validateVaultPath(destination);
      await assertNotProtected(source);
      await assertNotReadonly(source);

      if (await isHidden(source)) {
        throw new Error(`File not found: ${source}`);
      }

      // Local REST API uses a custom header for moves
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(source)}`,
        {
          method: "PATCH",
          headers: {
            "X-Destination": destination,
          },
        },
      );
    },

    async rename(path: string, newName: string): Promise<void> {
      requireScopeInSession(SCOPES.VAULT_MOVE);
      validateVaultPath(path);

      // Construct new path with same directory
      const lastSlash = path.lastIndexOf("/");
      const directory = lastSlash >= 0 ? path.substring(0, lastSlash + 1) : "";
      const destination = `${directory}${newName}`;

      validateVaultPath(destination);

      await this.move(path, destination);
    },

    async search(
      query: string,
      options?: SearchOptions,
    ): Promise<SearchResult[]> {
      requireScopeInSession(SCOPES.VAULT_SEARCH);

      // Determine search endpoint based on type
      const searchType = options?.type ?? "text";
      let endpoint: string;

      switch (searchType) {
        case "glob":
          endpoint = `/search/?query=${encodeURIComponent(query)}&type=glob`;
          break;
        case "regex":
          endpoint = `/search/?query=${encodeURIComponent(query)}&type=regex`;
          break;
        default:
          endpoint = `/search/simple/?query=${encodeURIComponent(query)}`;
      }

      if (options?.directory) {
        validateVaultPath(options.directory);
        endpoint += `&path=${encodeURIComponent(options.directory)}`;
      }

      const data = await makeRequest(
        LocalRestAPI.ApiSearchResponse,
        endpoint,
        {
          headers: { Accept: "application/json" },
        },
      );

      // Map response to our SearchResult type
      let results: SearchResult[] = (data ?? []).map(
        (item: { filename: string; score?: number; matches?: Array<{ match?: { content?: string } }> }) => ({
          path: item.filename,
          filename: item.filename.substring(
            item.filename.lastIndexOf("/") + 1,
          ),
          score: item.score,
          snippet: item.matches?.[0]?.match?.content,
        }),
      );

      // Filter out hidden files
      const visibleResults: SearchResult[] = [];
      for (const result of results) {
        if (!(await isHidden(result.path))) {
          visibleResults.push(result);
        }
      }
      results = visibleResults;

      // Apply limit
      if (options?.limit && options.limit > 0) {
        results = results.slice(0, options.limit);
      }

      return results;
    },

    async bulkDelete(
      pattern: string,
      options?: BulkDeleteOptions,
    ): Promise<BulkResult> {
      requireScopeInSession(SCOPES.VAULT_DELETE);

      // Find matching files
      const matches = await this.search(pattern, { type: "glob" });

      if (options?.dryRun) {
        return {
          processed: 0,
          matched: matches.length,
          failed: 0,
          files: matches.map((m) => m.path),
        };
      }

      const processed: string[] = [];
      const errors: Array<{ path: string; error: string }> = [];

      for (const match of matches) {
        try {
          await this.delete(match.path);
          processed.push(match.path);
        } catch (err) {
          errors.push({
            path: match.path,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return {
        processed: processed.length,
        matched: matches.length,
        failed: errors.length,
        files: processed,
        errors: errors.length > 0 ? errors : undefined,
      };
    },

    async getFrontmatter(path: string): Promise<Record<string, unknown>> {
      requireScopeInSession(SCOPES.VAULT_READ);
      validateVaultPath(path);

      if (await isHidden(path)) {
        throw new Error(`File not found: ${path}`);
      }

      const data = await makeRequest(
        LocalRestAPI.ApiNoteJson,
        `/vault/${encodeURIComponent(path)}`,
        {
          headers: { Accept: "application/vnd.olrapi.note+json" },
        },
      );

      return data.frontmatter ?? {};
    },

    async setFrontmatter(
      path: string,
      data: Record<string, unknown>,
    ): Promise<void> {
      requireScopeInSession(SCOPES.VAULT_WRITE);
      validateVaultPath(path);
      await assertNotReadonly(path);

      if (await isHidden(path)) {
        throw new Error(`File not found: ${path}`);
      }

      // Use PATCH to update frontmatter
      const yamlContent = Object.entries(data)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join("\n");

      await makeRequest(
        LocalRestAPI.ApiContentResponse,
        `/vault/${encodeURIComponent(path)}`,
        {
          method: "PATCH",
          headers: {
            Operation: "replace",
            "Target-Type": "frontmatter",
            Target: "",
            "Content-Type": "text/markdown",
          },
          body: `---\n${yamlContent}\n---`,
        },
      );
    },

    async getTags(path: string): Promise<string[]> {
      requireScopeInSession(SCOPES.VAULT_READ);
      validateVaultPath(path);

      if (await isHidden(path)) {
        throw new Error(`File not found: ${path}`);
      }

      const data = await makeRequest(
        LocalRestAPI.ApiNoteJson,
        `/vault/${encodeURIComponent(path)}`,
        {
          headers: { Accept: "application/vnd.olrapi.note+json" },
        },
      );

      return data.tags ?? [];
    },
  };
}

/**
 * Creates a PluginsAPI proxy for optional plugin integrations.
 *
 * Returns undefined for plugins that aren't available.
 */
export function createPluginsProxy(): PluginsAPI {
  // For now, return empty - plugins will be added as the feature matures
  // This is a placeholder that can be expanded when we integrate
  // with Dataview, Templater, Smart Connections, etc.
  return {
    // dataview: createDataviewProxy(),
    // templater: createTemplaterProxy(),
    // smartConnections: createSmartConnectionsProxy(),
  };
}
