/**
 * Dispatcher configuration for the MCP proxy
 */
export interface DeclaredPluginEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  description?: string;
  parameters?: Record<
    string,
    { type: string; description?: string; required?: boolean }
  >;
}

export interface DeclaredPluginConfig {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  endpoints: Record<string, DeclaredPluginEndpoint>;
}

export interface DispatcherToolsConfig {
  vault: boolean;
  activeFile: boolean;
  plugin: boolean;
  discover: boolean;
}

export interface OfficialPluginsConfig {
  "smart-connections": boolean;
  templater: boolean;
  [key: string]: boolean;
}

export interface PluginDiscoveryConfig {
  autoDetect: boolean;
  official: OfficialPluginsConfig;
  declared: DeclaredPluginConfig[];
}

export interface LegacyToolsConfig {
  enabled: boolean;
  disabled: string[];
}

export interface DispatcherConfig {
  dispatchers: DispatcherToolsConfig;
  plugins: PluginDiscoveryConfig;
  legacy: LegacyToolsConfig;
}

declare module "obsidian" {
  interface McpToolsPluginSettings {
    version?: string;
    dispatcher?: DispatcherConfig;
  }

  interface Plugin {
    loadData(): Promise<McpToolsPluginSettings>;
    saveData(data: McpToolsPluginSettings): Promise<void>;
  }
}

export {};
