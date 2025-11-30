/**
 * Dispatcher Configuration
 *
 * Configuration for the unified tool dispatch system.
 * Allows users and plugin makers to control:
 * - Which dispatcher tools are enabled
 * - Plugin discovery behavior
 * - Declared plugin configurations
 *
 * "Power to the player" - full control over your MCP surface area.
 */

import { type } from "arktype";

/**
 * Configuration for declared plugins
 */
export interface DeclaredPluginConfig {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  endpoints: {
    [operationName: string]: {
      method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
      path: string;
      description?: string;
      parameters?: Record<
        string,
        { type: string; description?: string; required?: boolean }
      >;
    };
  };
}

/**
 * Dispatcher tools configuration
 */
export interface DispatcherToolsConfig {
  /** Enable the unified `vault` dispatcher tool (default: true) */
  vault?: boolean;
  /** Enable the unified `active_file` dispatcher tool (default: true) */
  activeFile?: boolean;
  /** Enable the unified `plugin` dispatcher tool (default: true) */
  plugin?: boolean;
  /** Enable the `discover` tool for capability discovery (default: true) */
  discover?: boolean;
}

/**
 * Plugin discovery configuration
 */
export interface PluginDiscoveryConfig {
  /** Enable auto-detection of plugins via API probing (default: true) */
  autoDetect?: boolean;
  /** Official plugins to enable (default: all) */
  official?: {
    "smart-connections"?: boolean;
    templater?: boolean;
    [key: string]: boolean | undefined;
  };
  /** User-declared plugin configurations */
  declared?: DeclaredPluginConfig[];
}

/**
 * Legacy tools configuration
 */
export interface LegacyToolsConfig {
  /** Keep all legacy tools enabled for backward compatibility (default: true) */
  enabled?: boolean;
  /** Specific legacy tools to disable (when enabled: true) */
  disabled?: string[];
}

/**
 * Full dispatcher system configuration
 */
export interface DispatcherConfig {
  /** Dispatcher tools configuration */
  dispatchers?: DispatcherToolsConfig;
  /** Plugin discovery configuration */
  plugins?: PluginDiscoveryConfig;
  /** Legacy tools configuration */
  legacy?: LegacyToolsConfig;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: Required<DispatcherConfig> = {
  dispatchers: {
    vault: true,
    activeFile: true,
    plugin: true,
    discover: true,
  },
  plugins: {
    autoDetect: true,
    official: {
      "smart-connections": true,
      templater: true,
    },
    declared: [],
  },
  legacy: {
    enabled: true,
    disabled: [],
  },
};

/**
 * ArkType schema for runtime validation
 */
export const DispatcherConfigSchema = type({
  "dispatchers?": {
    "vault?": "boolean",
    "activeFile?": "boolean",
    "plugin?": "boolean",
    "discover?": "boolean",
  },
  "plugins?": {
    "autoDetect?": "boolean",
    "official?": "Record<string, boolean>",
    "declared?": type({
      id: "string",
      name: "string",
      "description?": "string",
      "enabled?": "boolean",
      endpoints: "Record<string, unknown>",
    }).array(),
  },
  "legacy?": {
    "enabled?": "boolean",
    "disabled?": "string[]",
  },
});

/**
 * Merge user config with defaults
 */
export function mergeConfig(
  userConfig: DispatcherConfig = {},
): Required<DispatcherConfig> {
  return {
    dispatchers: {
      ...DEFAULT_CONFIG.dispatchers,
      ...userConfig.dispatchers,
    },
    plugins: {
      ...DEFAULT_CONFIG.plugins,
      ...userConfig.plugins,
      official: {
        ...DEFAULT_CONFIG.plugins.official,
        ...userConfig.plugins?.official,
      },
      declared: userConfig.plugins?.declared ?? DEFAULT_CONFIG.plugins.declared,
    },
    legacy: {
      ...DEFAULT_CONFIG.legacy,
      ...userConfig.legacy,
    },
  };
}

/**
 * Configuration manager singleton
 */
class ConfigManager {
  private config: Required<DispatcherConfig> = DEFAULT_CONFIG;

  /**
   * Load configuration
   */
  load(config: DispatcherConfig): void {
    this.config = mergeConfig(config);
  }

  /**
   * Get current configuration
   */
  get(): Required<DispatcherConfig> {
    return this.config;
  }

  /**
   * Check if a dispatcher tool is enabled
   */
  isDispatcherEnabled(
    tool: keyof DispatcherToolsConfig,
  ): boolean {
    return this.config.dispatchers[tool] ?? true;
  }

  /**
   * Check if auto-detection is enabled
   */
  isAutoDetectEnabled(): boolean {
    return this.config.plugins.autoDetect ?? true;
  }

  /**
   * Check if an official plugin is enabled
   */
  isOfficialPluginEnabled(pluginId: string): boolean {
    return this.config.plugins.official?.[pluginId] ?? true;
  }

  /**
   * Get declared plugin configurations
   */
  getDeclaredPlugins(): DeclaredPluginConfig[] {
    return this.config.plugins.declared ?? [];
  }

  /**
   * Check if legacy tools are enabled
   */
  isLegacyEnabled(): boolean {
    return this.config.legacy.enabled ?? true;
  }

  /**
   * Check if a specific legacy tool is disabled
   */
  isLegacyToolDisabled(toolName: string): boolean {
    return this.config.legacy.disabled?.includes(toolName) ?? false;
  }
}

export const configManager = new ConfigManager();

/**
 * Example configuration file format (mcp-tools.config.json):
 *
 * {
 *   "dispatchers": {
 *     "vault": true,
 *     "activeFile": true,
 *     "plugin": true,
 *     "discover": true
 *   },
 *   "plugins": {
 *     "autoDetect": true,
 *     "official": {
 *       "smart-connections": true,
 *       "templater": true
 *     },
 *     "declared": [
 *       {
 *         "id": "my-plugin",
 *         "name": "My Custom Plugin",
 *         "description": "Custom plugin integration",
 *         "endpoints": {
 *           "do_thing": {
 *             "method": "POST",
 *             "path": "/plugins/my-plugin/do",
 *             "description": "Does the thing",
 *             "parameters": {
 *               "input": { "type": "string", "required": true }
 *             }
 *           }
 *         }
 *       }
 *     ]
 *   },
 *   "legacy": {
 *     "enabled": true,
 *     "disabled": ["search_vault_simple"]
 *   }
 * }
 */
