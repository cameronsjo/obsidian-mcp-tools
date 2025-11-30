import { getGrantedScopes, logger, makeRequest, type ToolRegistry } from "$/shared";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  LATEST_PROTOCOL_VERSION,
} from "@modelcontextprotocol/sdk/types.js";
import { LocalRestAPI } from "shared";
import type {
  FeatureAvailability,
  HealthStatus,
  ServerCapabilities,
  ToolInfo,
} from "./types";

/**
 * Server start time for uptime calculation
 */
const SERVER_START_TIME = Date.now();

/**
 * Check if Local REST API is available
 */
async function checkLocalRestApiConnection(): Promise<boolean> {
  try {
    await makeRequest(
      LocalRestAPI.ApiVaultDirectoryResponse,
      "/vault/",
      { method: "GET" },
    );
    return true;
  } catch (error) {
    logger.debug("Local REST API not available", { error });
    return false;
  }
}

/**
 * Determine which features are available based on environment and connectivity
 */
async function getFeatureAvailability(): Promise<FeatureAvailability> {
  const localRestApiConnected = await checkLocalRestApiConnection();

  return {
    localRestApi: localRestApiConnected,
    smartConnections: localRestApiConnected,
    templater: localRestApiConnected,
    dispatchers: true,
    fetch: true,
    prompts: localRestApiConnected,
  };
}

/**
 * Generate health status information
 */
export async function getHealthStatus(version: string): Promise<HealthStatus> {
  const uptime = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
  const scopes = getGrantedScopes();
  const connected = await checkLocalRestApiConnection();
  const features = await getFeatureAvailability();

  return {
    version,
    uptime,
    connected,
    scopes,
    features,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get server capabilities including tools, prompts, and resources
 */
export async function getServerCapabilities(
  toolRegistry: ToolRegistry,
  version: string,
): Promise<ServerCapabilities> {
  // Get tools from registry
  const toolsList = toolRegistry.list();
  const tools: ToolInfo[] = toolsList.tools.map((tool) => ({
    name: tool.name,
    description: tool.description || "",
    inputSchema: tool.inputSchema as Record<string, unknown>,
  }));

  // Resources are hardcoded since we know what we register
  const resources = ["health://status", "health://capabilities"];

  return {
    sdkVersion: "1.23.0",
    protocolVersion: LATEST_PROTOCOL_VERSION,
    tools,
    prompts: [], // Prompts are registered separately and not accessible via ToolRegistry
    resources,
    serverVersion: version,
    timestamp: new Date().toISOString(),
  };
}
