/**
 * Unified Tool Dispatchers
 *
 * This module provides a consolidated tool interface that reduces the number
 * of MCP tools from 21+ to ~5, dramatically reducing LLM context usage while
 * maintaining full functionality.
 *
 * New tools:
 * - vault: Unified vault file operations
 * - active_file: Active file operations
 * - plugin: Plugin integrations (smart-connections, templater)
 * - discover: Runtime capability discovery
 *
 * Old tools remain available for backward compatibility.
 */

import type { ToolRegistry } from "$/shared";
import { type } from "arktype";
import { vaultOperations, getVaultCapabilities } from "./vault";
import { activeFileOperations, getActiveFileCapabilities } from "./active-file";
import {
  dispatchPluginOperation,
  getPluginCapabilities,
  listPlugins,
  initializePluginDiscovery,
  pluginRegistry,
} from "./plugin";
import { buildCapabilityManifest, type DiscoverCategory } from "./discover";

export { getVaultCapabilities, getActiveFileCapabilities, getPluginCapabilities };
export { initializePluginDiscovery, pluginRegistry };
export * from "./types";
export * from "./plugin-discovery";

/**
 * Register the new unified dispatcher tools
 *
 * These tools work alongside the existing tools for backward compatibility.
 * Users can gradually migrate to the new tools, which offer:
 * - Reduced context usage (~70% less)
 * - Runtime discovery of capabilities
 * - Dynamic plugin detection
 */
export function registerDispatcherTools(tools: ToolRegistry) {
  // VAULT dispatcher
  tools.register(
    type({
      name: '"vault"',
      arguments: {
        operation: type(
          '"read" | "write" | "append" | "patch" | "delete" | "move" | "rename" | "list" | "search" | "bulk_delete" | "open" | "info"',
        ).describe("The operation to perform"),
        // All optional params - validated by operation handler
        "path?": type("string").describe("File path (vault-relative)"),
        "content?": type("string").describe("File content"),
        "format?": type('"markdown" | "json"').describe("Output format"),
        "source?": type("string").describe("Source path for move"),
        "destination?": type("string").describe("Destination path for move"),
        "newName?": type("string").describe("New filename for rename"),
        "directory?": type("string").describe("Directory for list"),
        "query?": type("string").describe("Search query"),
        "type?": type("string").describe("Search type or match type"),
        "overwrite?": type("boolean").describe("Overwrite existing files"),
        "dryRun?": type("boolean").describe("Preview without executing"),
        "limit?": type("number").describe("Maximum results"),
        "newLeaf?": type("boolean").describe("Open in new pane"),
        // Patch-specific
        "targetType?": type('"heading" | "block" | "frontmatter"').describe("Target type for patch"),
        "target?": type("string").describe("Target identifier for patch"),
        "targetDelimiter?": type("string").describe("Delimiter for nested targets"),
        "trimTargetWhitespace?": type("boolean").describe("Trim whitespace"),
        "contentType?": type("string").describe("Content type header"),
        // Bulk delete specific
        "match?": type("string").describe("Pattern to match files"),
        "flags?": type("string").describe("Regex flags"),
        "exclude?": type("string[]").describe("Patterns to exclude"),
        "contextLength?": type("number").describe("Context length for search"),
      },
    }).describe(
      "Unified vault operations. Operations: read, write, append, patch, delete, move, rename, list, search, bulk_delete, open, info. Use discover() to see detailed parameters for each operation.",
    ),
    async ({ arguments: args }) => {
      const operation = args.operation;

      // Build params object from args, excluding 'operation'
      const params: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        if (key !== "operation" && value !== undefined) {
          params[key] = value;
        }
      }

      return vaultOperations.dispatch(operation, params);
    },
  );

  // ACTIVE_FILE dispatcher
  tools.register(
    type({
      name: '"active_file"',
      arguments: {
        operation: type('"read" | "update" | "append" | "patch" | "delete"').describe(
          "The operation to perform",
        ),
        "content?": type("string").describe("File content"),
        "format?": type('"markdown" | "json"').describe("Output format for read"),
        // Patch-specific
        "targetType?": type('"heading" | "block" | "frontmatter"').describe("Target type for patch"),
        "target?": type("string").describe("Target identifier for patch"),
        "targetDelimiter?": type("string").describe("Delimiter for nested targets"),
        "trimTargetWhitespace?": type("boolean").describe("Trim whitespace"),
        "contentType?": type("string").describe("Content type header"),
      },
    }).describe(
      "Operations on the currently active file. Operations: read, update, append, patch, delete. Use discover() to see detailed parameters.",
    ),
    async ({ arguments: args }) => {
      const operation = args.operation;

      const params: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        if (key !== "operation" && value !== undefined) {
          params[key] = value;
        }
      }

      return activeFileOperations.dispatch(operation, params);
    },
  );

  // PLUGIN dispatcher
  tools.register(
    type({
      name: '"plugin"',
      arguments: {
        plugin: type("string").describe(
          `Plugin to use: ${listPlugins().join(", ")}`,
        ),
        operation: type("string").describe("Operation to perform"),
        // Smart Connections params
        "query?": type("string").describe("Search query"),
        "folders?": type("string[]").describe("Folders to include"),
        "excludeFolders?": type("string[]").describe("Folders to exclude"),
        "limit?": type("number").describe("Max results"),
        // Templater params
        "name?": type("string").describe("Template file path"),
        "arguments?": type("Record<string, string>").describe("Template arguments"),
        "createFile?": type("boolean").describe("Create file from template"),
        "targetPath?": type("string").describe("Target path for created file"),
      },
    }).describe(
      "Execute plugin operations. Plugins: smart-connections (search), templater (execute). Use discover({ category: 'plugins' }) to see available operations.",
    ),
    async ({ arguments: args }) => {
      const { plugin, operation, ...params } = args;

      // Filter out undefined values
      const cleanParams: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          cleanParams[key] = value;
        }
      }

      return dispatchPluginOperation(plugin, operation, cleanParams);
    },
  );

  // DISCOVER tool
  tools.register(
    type({
      name: '"discover"',
      arguments: {
        "category?": type('"vault" | "active_file" | "plugins" | "all"').describe(
          "Category to discover (default: all)",
        ),
      },
    }).describe(
      "Discover available operations and their parameters. Returns a capability manifest describing all available operations. Use this to learn what operations you can perform without needing all tool schemas in context.",
    ),
    async ({ arguments: args }) => {
      const capabilities = await buildCapabilityManifest(
        args.category as DiscoverCategory,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(capabilities, null, 2),
          },
        ],
      };
    },
  );
}
