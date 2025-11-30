/**
 * Plugin Discovery System
 *
 * Three tiers of plugin support:
 * 1. OFFICIAL: Bundled adapters with full support (smart-connections, templater)
 * 2. DETECTED: Auto-discovered via API probing
 * 3. DECLARED: User-configured custom plugins
 *
 * This enables an "MCP proxy" pattern where new plugins can be discovered
 * and exposed dynamically without code changes.
 */

import { makeRequest, logger } from "$/shared";
import { LocalRestAPI } from "shared";
import { OperationRegistry, type OperationResult, type DispatcherCapabilities } from "./types";

/**
 * Plugin tier indicating level of support
 */
export type PluginTier = "official" | "detected" | "declared";

/**
 * Plugin status
 */
export interface PluginStatus {
  id: string;
  name: string;
  tier: PluginTier;
  enabled: boolean;
  version?: string;
  description?: string;
  lastChecked?: Date;
}

/**
 * Plugin adapter interface
 */
export interface PluginAdapter {
  id: string;
  name: string;
  tier: PluginTier;
  description?: string;
  operations: OperationRegistry;
  probe: () => Promise<boolean>;
  getVersion?: () => Promise<string | undefined>;
}

/**
 * Declared plugin configuration
 */
export interface DeclaredPluginConfig {
  id: string;
  name: string;
  description?: string;
  endpoints: {
    [operationName: string]: {
      method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      path: string;
      description?: string;
      parameters?: Record<string, { type: string; description?: string; required?: boolean }>;
    };
  };
}

/**
 * Plugin Discovery Registry
 *
 * Manages all three tiers of plugins and provides unified access.
 */
export class PluginDiscoveryRegistry {
  private official = new Map<string, PluginAdapter>();
  private detected = new Map<string, PluginAdapter>();
  private declared = new Map<string, PluginAdapter>();
  private statusCache = new Map<string, PluginStatus>();

  /**
   * Register an official (bundled) plugin adapter
   */
  registerOfficial(adapter: PluginAdapter): this {
    adapter.tier = "official";
    this.official.set(adapter.id, adapter);
    return this;
  }

  /**
   * Register a declared (user-configured) plugin
   */
  registerDeclared(config: DeclaredPluginConfig): this {
    const operations = new OperationRegistry();

    // Build operations from endpoint config
    for (const [opName, endpoint] of Object.entries(config.endpoints)) {
      operations.register({
        name: opName,
        description: endpoint.description || `${endpoint.method} ${endpoint.path}`,
        parameters: endpoint.parameters || {},
        handler: async (params): Promise<OperationResult> => {
          // Build URL with path parameters
          let path = endpoint.path;
          for (const [key, value] of Object.entries(params)) {
            path = path.replace(`:${key}`, encodeURIComponent(String(value)));
          }

          // Make request
          const response = await makeRequest(
            LocalRestAPI.ApiContentResponse.or("unknown"),
            path,
            {
              method: endpoint.method,
              body: endpoint.method !== "GET" ? JSON.stringify(params) : undefined,
            },
          );

          return {
            content: [
              {
                type: "text",
                text:
                  typeof response === "string"
                    ? response
                    : JSON.stringify(response, null, 2),
              },
            ],
          };
        },
      });
    }

    const adapter: PluginAdapter = {
      id: config.id,
      name: config.name,
      tier: "declared",
      description: config.description,
      operations,
      probe: async () => true, // Declared plugins are assumed available
    };

    this.declared.set(config.id, adapter);
    return this;
  }

  /**
   * Auto-detect plugins by probing known API patterns
   */
  async autoDetect(): Promise<PluginStatus[]> {
    const detectedPlugins: PluginStatus[] = [];

    // Known plugin API patterns to probe
    const probePatterns: Array<{
      id: string;
      name: string;
      description: string;
      probe: () => Promise<boolean>;
      buildOperations: () => OperationRegistry;
    }> = [
      {
        id: "dataview",
        name: "Dataview",
        description: "Query and display data from your vault",
        probe: async () => {
          try {
            // Dataview would be detected via search API with DQL
            await makeRequest(
              LocalRestAPI.ApiSearchResponse,
              "/search/",
              {
                method: "POST",
                headers: { "Content-Type": "application/vnd.olrapi.dataview.dql+txt" },
                body: 'LIST LIMIT 1',
              },
            );
            return true;
          } catch {
            return false;
          }
        },
        buildOperations: () => {
          const ops = new OperationRegistry();
          ops.register({
            name: "query",
            description: "Execute a Dataview DQL query",
            parameters: {
              query: { type: "string", description: "DQL query", required: true },
            },
            handler: async (params): Promise<OperationResult> => {
              const data = await makeRequest(
                LocalRestAPI.ApiSearchResponse,
                "/search/",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/vnd.olrapi.dataview.dql+txt" },
                  body: params.query as string,
                },
              );
              return {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
              };
            },
          });
          return ops;
        },
      },
      {
        id: "tasks",
        name: "Tasks",
        description: "Task management for Obsidian",
        probe: async () => {
          // Tasks plugin detection would go here
          // For now, we can't easily detect it without a dedicated endpoint
          return false;
        },
        buildOperations: () => new OperationRegistry(),
      },
      {
        id: "excalidraw",
        name: "Excalidraw",
        description: "Drawing and diagramming",
        probe: async () => {
          // Excalidraw detection would go here
          return false;
        },
        buildOperations: () => new OperationRegistry(),
      },
    ];

    for (const pattern of probePatterns) {
      try {
        const available = await pattern.probe();
        if (available) {
          const adapter: PluginAdapter = {
            id: pattern.id,
            name: pattern.name,
            tier: "detected",
            description: pattern.description,
            operations: pattern.buildOperations(),
            probe: pattern.probe,
          };

          this.detected.set(pattern.id, adapter);
          detectedPlugins.push({
            id: pattern.id,
            name: pattern.name,
            tier: "detected",
            enabled: true,
            description: pattern.description,
            lastChecked: new Date(),
          });

          logger.info(`Auto-detected plugin: ${pattern.name}`);
        }
      } catch (error) {
        logger.debug(`Plugin probe failed: ${pattern.id}`, { error });
      }
    }

    return detectedPlugins;
  }

  /**
   * Get a plugin adapter by ID (searches all tiers)
   */
  get(id: string): PluginAdapter | undefined {
    return this.official.get(id) || this.detected.get(id) || this.declared.get(id);
  }

  /**
   * Check if a plugin exists
   */
  has(id: string): boolean {
    return this.official.has(id) || this.detected.has(id) || this.declared.has(id);
  }

  /**
   * List all plugins with their status
   */
  async listAll(): Promise<PluginStatus[]> {
    const statuses: PluginStatus[] = [];

    // Official plugins
    for (const [id, adapter] of this.official) {
      const enabled = await adapter.probe();
      const version = adapter.getVersion ? await adapter.getVersion() : undefined;

      statuses.push({
        id,
        name: adapter.name,
        tier: "official",
        enabled,
        version,
        description: adapter.description,
      });
    }

    // Detected plugins
    for (const [id, adapter] of this.detected) {
      statuses.push({
        id,
        name: adapter.name,
        tier: "detected",
        enabled: true, // Already detected as available
        description: adapter.description,
      });
    }

    // Declared plugins
    for (const [id, adapter] of this.declared) {
      statuses.push({
        id,
        name: adapter.name,
        tier: "declared",
        enabled: true, // Declared plugins assumed available
        description: adapter.description,
      });
    }

    return statuses;
  }

  /**
   * Get all plugin IDs
   */
  listIds(): string[] {
    return [
      ...this.official.keys(),
      ...this.detected.keys(),
      ...this.declared.keys(),
    ];
  }

  /**
   * Get capabilities for all plugins
   */
  async getCapabilities(): Promise<
    Record<string, DispatcherCapabilities & { tier: PluginTier; enabled: boolean; version?: string }>
  > {
    const capabilities: Record<
      string,
      DispatcherCapabilities & { tier: PluginTier; enabled: boolean; version?: string }
    > = {};

    for (const [id, adapter] of this.official) {
      const enabled = await adapter.probe();
      const version = adapter.getVersion ? await adapter.getVersion() : undefined;

      capabilities[id] = {
        category: `plugins.${id}`,
        description: adapter.description || adapter.name,
        operations: adapter.operations.getCapabilities(),
        tier: "official",
        enabled,
        version,
      };
    }

    for (const [id, adapter] of this.detected) {
      capabilities[id] = {
        category: `plugins.${id}`,
        description: adapter.description || adapter.name,
        operations: adapter.operations.getCapabilities(),
        tier: "detected",
        enabled: true,
      };
    }

    for (const [id, adapter] of this.declared) {
      capabilities[id] = {
        category: `plugins.${id}`,
        description: adapter.description || adapter.name,
        operations: adapter.operations.getCapabilities(),
        tier: "declared",
        enabled: true,
      };
    }

    return capabilities;
  }

  /**
   * Dispatch an operation to a plugin
   */
  async dispatch(
    pluginId: string,
    operation: string,
    params: Record<string, unknown>,
  ): Promise<OperationResult> {
    const adapter = this.get(pluginId);

    if (!adapter) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown plugin: ${pluginId}. Available plugins: ${this.listIds().join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    // Check if plugin is available
    const available = await adapter.probe();
    if (!available) {
      return {
        content: [
          {
            type: "text",
            text: `Plugin not available: ${pluginId}. The plugin may not be installed or enabled in Obsidian.`,
          },
        ],
        isError: true,
      };
    }

    return adapter.operations.dispatch(operation, params);
  }
}

// Singleton instance
export const pluginRegistry = new PluginDiscoveryRegistry();
