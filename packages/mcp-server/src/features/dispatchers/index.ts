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
 *
 * Configuration:
 * All tools can be enabled/disabled via configuration.
 * See config.ts for the full configuration schema.
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
import {
  configManager,
  mergeConfig,
  type DispatcherConfig,
  type DeclaredPluginConfig,
} from "./config";

export { getVaultCapabilities, getActiveFileCapabilities, getPluginCapabilities };
export { initializePluginDiscovery, pluginRegistry };
export { configManager, mergeConfig };
export type { DispatcherConfig, DeclaredPluginConfig };
export * from "./types";
export * from "./plugin-discovery";
export * from "./config";

// Tool schemas (defined once, registered conditionally)
const vaultToolSchema = type({
  name: '"vault"',
  arguments: {
    operation: type(
      '"read" | "write" | "append" | "patch" | "delete" | "move" | "rename" | "list" | "search" | "bulk_delete" | "open" | "info"',
    ).describe("The operation to perform"),
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
    "targetType?": type('"heading" | "block" | "frontmatter"').describe(
      "Target type for patch",
    ),
    "target?": type("string").describe("Target identifier for patch"),
    "targetDelimiter?": type("string").describe("Delimiter for nested targets"),
    "trimTargetWhitespace?": type("boolean").describe("Trim whitespace"),
    "contentType?": type("string").describe("Content type header"),
    "match?": type("string").describe("Pattern to match files"),
    "flags?": type("string").describe("Regex flags"),
    "exclude?": type("string[]").describe("Patterns to exclude"),
    "contextLength?": type("number").describe("Context length for search"),
  },
}).describe(
  "Unified vault operations. Operations: read, write, append, patch, delete, move, rename, list, search, bulk_delete, open, info. Use discover() to see detailed parameters for each operation.",
);

const activeFileToolSchema = type({
  name: '"active_file"',
  arguments: {
    operation: type('"read" | "update" | "append" | "patch" | "delete"').describe(
      "The operation to perform",
    ),
    "content?": type("string").describe("File content"),
    "format?": type('"markdown" | "json"').describe("Output format for read"),
    "targetType?": type('"heading" | "block" | "frontmatter"').describe(
      "Target type for patch",
    ),
    "target?": type("string").describe("Target identifier for patch"),
    "targetDelimiter?": type("string").describe("Delimiter for nested targets"),
    "trimTargetWhitespace?": type("boolean").describe("Trim whitespace"),
    "contentType?": type("string").describe("Content type header"),
  },
}).describe(
  "Operations on the currently active file. Operations: read, update, append, patch, delete. Use discover() to see detailed parameters.",
);

/**
 * Build plugin tool schema dynamically
 *
 * This function is called at registration time, not module load time,
 * so plugins will be registered by the time this runs.
 * Fixes PR-1#2: listPlugins() was called at schema definition time.
 */
function buildPluginToolSchema() {
  const plugins = listPlugins();
  const pluginList = plugins.length > 0 ? plugins.join(", ") : "smart-connections, templater";

  return type({
    name: '"plugin"',
    arguments: {
      plugin: type("string").describe(`Plugin to use: ${pluginList}`),
      operation: type("string").describe("Operation to perform"),
      "query?": type("string").describe("Search query"),
      "folders?": type("string[]").describe("Folders to include"),
      "excludeFolders?": type("string[]").describe("Folders to exclude"),
      "limit?": type("number").describe("Max results"),
      "name?": type("string").describe("Template file path"),
      "arguments?": type("Record<string, string>").describe("Template arguments"),
      "createFile?": type("boolean").describe("Create file from template"),
      "targetPath?": type("string").describe("Target path for created file"),
    },
  }).describe(
    "Execute plugin operations. Use discover({ category: 'plugins' }) to see available plugins and operations.",
  );
}

const discoverToolSchema = type({
  name: '"discover"',
  arguments: {
    "category?": type('"vault" | "active_file" | "plugins" | "config" | "all"').describe(
      "Category to discover (default: all)",
    ),
  },
}).describe(
  "Discover available operations, their parameters, and current configuration. Use this to learn what operations you can perform without needing all tool schemas in context.",
);

/**
 * Register the new unified dispatcher tools
 *
 * These tools work alongside the existing tools for backward compatibility.
 * Users can gradually migrate to the new tools, which offer:
 * - Reduced context usage (~70% less)
 * - Runtime discovery of capabilities
 * - Dynamic plugin detection
 *
 * @param tools - The tool registry to register tools with
 * @param config - Optional configuration to control which tools are registered
 */
export function registerDispatcherTools(
  tools: ToolRegistry,
  config?: DispatcherConfig,
) {
  // Load configuration
  if (config) {
    configManager.load(config);
  }
  const cfg = configManager.get();

  // Register declared plugins from config
  for (const declaredPlugin of cfg.plugins.declared) {
    if (declaredPlugin.enabled !== false) {
      pluginRegistry.registerDeclared(declaredPlugin);
    }
  }

  // VAULT dispatcher
  if (cfg.dispatchers.vault) {
    tools.register(vaultToolSchema, async ({ arguments: args }) => {
      const operation = args.operation;
      const params: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        if (key !== "operation" && value !== undefined) {
          params[key] = value;
        }
      }
      return vaultOperations.dispatch(operation, params);
    });
  }

  // ACTIVE_FILE dispatcher
  if (cfg.dispatchers.activeFile) {
    tools.register(activeFileToolSchema, async ({ arguments: args }) => {
      const operation = args.operation;
      const params: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(args)) {
        if (key !== "operation" && value !== undefined) {
          params[key] = value;
        }
      }
      return activeFileOperations.dispatch(operation, params);
    });
  }

  // PLUGIN dispatcher
  if (cfg.dispatchers.plugin) {
    tools.register(buildPluginToolSchema(), async ({ arguments: args }) => {
      const { plugin, operation, ...params } = args;
      const cleanParams: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          cleanParams[key] = value;
        }
      }
      return dispatchPluginOperation(plugin, operation, cleanParams);
    });
  }

  // DISCOVER tool
  if (cfg.dispatchers.discover) {
    tools.register(discoverToolSchema, async ({ arguments: args }) => {
      // Special handling for "config" category
      if (args.category === "config") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  current: cfg,
                  description: {
                    dispatchers:
                      "Which dispatcher tools are enabled (vault, activeFile, plugin, discover)",
                    plugins: {
                      autoDetect: "Whether to auto-detect plugins via API probing",
                      official: "Which official plugins are enabled",
                      declared: "User-defined plugin configurations",
                    },
                    legacy: {
                      enabled: "Whether legacy individual tools are available",
                      disabled: "Specific legacy tools to disable",
                    },
                  },
                },
                null,
                2,
              ),
            },
          ],
        };
      }

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
    });
  }
}
