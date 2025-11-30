/**
 * Health check and capabilities types for MCP server
 */

/**
 * Server health status
 */
export interface HealthStatus {
  version: string;
  uptime: number;
  connected: boolean;
  scopes: string[];
  features: FeatureAvailability;
  timestamp: string;
}

/**
 * Feature availability tracking
 */
export interface FeatureAvailability {
  localRestApi: boolean;
  smartConnections: boolean;
  templater: boolean;
  dispatchers: boolean;
  fetch: boolean;
  prompts: boolean;
}

/**
 * Tool information for capabilities
 */
export interface ToolInfo {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Prompt information for capabilities
 */
export interface PromptInfo {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * Server capabilities
 */
export interface ServerCapabilities {
  sdkVersion: string;
  protocolVersion: string;
  tools: ToolInfo[];
  prompts: PromptInfo[];
  resources: string[];
  serverVersion: string;
  timestamp: string;
}
