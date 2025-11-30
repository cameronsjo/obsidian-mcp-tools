/**
 * Plugin Dispatcher
 *
 * Consolidates plugin operations into a single dispatcher tool:
 * - smart-connections.search: search_vault_smart
 * - templater.execute: execute_template
 *
 * Extensible for future plugin integrations.
 *
 * Plugin tiers:
 * - OFFICIAL: Bundled adapters with full support
 * - DETECTED: Auto-discovered via API probing
 * - DECLARED: User-configured custom plugins
 */

import {
  formatMcpError,
  makeRequest,
  parseTemplateParameters,
} from "$/shared";
import { type } from "arktype";
import { buildTemplateArgumentsSchema, LocalRestAPI } from "shared";
import { OperationRegistry, type OperationResult, type DispatcherCapabilities } from "./types";
import { pluginRegistry, type PluginAdapter, type PluginTier } from "./plugin-discovery";

// Build Smart Connections operations
function buildSmartConnectionsOperations(): OperationRegistry {
  const operations = new OperationRegistry();

  operations.register({
    name: "search",
    description: "Semantic search for documents matching a text string",
    parameters: {
      query: { type: "string", description: "Search phrase", required: true },
      folders: { type: "string[]", description: "Folders to include" },
      excludeFolders: { type: "string[]", description: "Folders to exclude" },
      limit: { type: "number", description: "Maximum results to return" },
    },
    handler: async (params): Promise<OperationResult> => {
      const requestBody: Record<string, unknown> = {
        query: params.query,
      };

      if (params.folders || params.excludeFolders || params.limit) {
        requestBody.filter = {};
        if (params.folders) {
          (requestBody.filter as Record<string, unknown>).folders = params.folders;
        }
        if (params.excludeFolders) {
          (requestBody.filter as Record<string, unknown>).excludeFolders =
            params.excludeFolders;
        }
        if (params.limit) {
          (requestBody.filter as Record<string, unknown>).limit = params.limit;
        }
      }

      const data = await makeRequest(
        LocalRestAPI.ApiSmartSearchResponse,
        "/search/smart",
        { method: "POST", body: JSON.stringify(requestBody) },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  });

  return operations;
}

// Build Templater operations
function buildTemplaterOperations(): OperationRegistry {
  const operations = new OperationRegistry();

  operations.register({
    name: "execute",
    description: "Execute a Templater template with arguments",
    parameters: {
      name: { type: "string", description: "Template file path", required: true },
      arguments: {
        type: "Record<string, string>",
        description: "Template arguments (key-value pairs)",
      },
      createFile: {
        type: "boolean",
        description: "Create a new file from template output",
      },
      targetPath: {
        type: "string",
        description: "Target path when createFile is true",
      },
    },
    handler: async (params): Promise<OperationResult> => {
      // Get template content
      const data = await makeRequest(
        LocalRestAPI.ApiVaultFileResponse,
        `/vault/${params.name}`,
        { headers: { Accept: LocalRestAPI.MIME_TYPE_OLRAPI_NOTE_JSON } },
      );

      // Validate template arguments
      const templateParameters = parseTemplateParameters(data.content);
      const validArgs = buildTemplateArgumentsSchema(templateParameters)(
        params.arguments ?? {},
      );

      if (validArgs instanceof type.errors) {
        throw formatMcpError(validArgs);
      }

      const templateExecutionArgs = {
        name: params.name as string,
        arguments: validArgs,
        createFile: params.createFile === true,
        targetPath: params.targetPath as string | undefined,
      };

      const response = await makeRequest(
        LocalRestAPI.ApiTemplateExecutionResponse,
        "/templates/execute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templateExecutionArgs),
        },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    },
  });

  return operations;
}

// Register official plugins
pluginRegistry.registerOfficial({
  id: "smart-connections",
  name: "Smart Connections",
  tier: "official" as PluginTier,
  description: "AI-powered semantic search for your vault",
  operations: buildSmartConnectionsOperations(),
  probe: async () => {
    try {
      await makeRequest(
        LocalRestAPI.ApiSmartSearchResponse,
        "/search/smart",
        { method: "POST", body: JSON.stringify({ query: "test", filter: { limit: 1 } }) },
      );
      return true;
    } catch {
      return false;
    }
  },
});

pluginRegistry.registerOfficial({
  id: "templater",
  name: "Templater",
  tier: "official" as PluginTier,
  description: "Create and execute templates with dynamic content",
  operations: buildTemplaterOperations(),
  probe: async () => {
    // Templater is typically available if the MCP server is running
    return true;
  },
});

/**
 * Initialize plugin discovery (call on startup)
 */
export async function initializePluginDiscovery(): Promise<void> {
  // Auto-detect additional plugins
  await pluginRegistry.autoDetect();
}

/**
 * Dispatch a plugin operation
 */
export async function dispatchPluginOperation(
  plugin: string,
  operation: string,
  params: Record<string, unknown>,
): Promise<OperationResult> {
  return pluginRegistry.dispatch(plugin, operation, params);
}

/**
 * Get capabilities for all plugins
 */
export async function getPluginCapabilities(): Promise<
  Record<string, DispatcherCapabilities & { tier: PluginTier; enabled: boolean; version?: string }>
> {
  return pluginRegistry.getCapabilities();
}

/**
 * List available plugin IDs
 */
export function listPlugins(): string[] {
  return pluginRegistry.listIds();
}

/**
 * Check if a plugin is registered
 */
export function hasPlugin(id: string): boolean {
  return pluginRegistry.has(id);
}

// Re-export for external use
export { pluginRegistry };
