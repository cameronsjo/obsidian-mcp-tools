import { formatMcpError, logger, type ToolRegistry } from "$/shared";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { getHealthStatus, getServerCapabilities } from "./services";

/**
 * Health check URIs
 */
export const HEALTH_URIS = {
  STATUS: "health://status",
  CAPABILITIES: "health://capabilities",
} as const;

/**
 * Register health check resources with the MCP server
 *
 * Provides two resources:
 * - health://status - Server health, uptime, connection status, scopes, and feature availability
 * - health://capabilities - Server capabilities including tools, prompts, resources, and versions
 */
export function registerHealthResources(
  server: Server,
  toolRegistry: ToolRegistry,
  version: string,
): void {
  // Register resources list handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      return {
        resources: [
          {
            uri: HEALTH_URIS.STATUS,
            name: "Health Status",
            description:
              "Server health information including version, uptime, connection status, scopes, and feature availability",
            mimeType: "application/json",
          },
          {
            uri: HEALTH_URIS.CAPABILITIES,
            name: "Server Capabilities",
            description:
              "Server capabilities including registered tools, prompts, resources, and version information",
            mimeType: "application/json",
          },
        ],
      };
    } catch (err) {
      const error = formatMcpError(err);
      logger.error("Error in ListResourcesRequestSchema handler", {
        error,
        message: error.message,
      });
      throw error;
    }
  });

  // Register resource read handler
  server.setRequestHandler(ReadResourceRequestSchema, async ({ params }) => {
    try {
      const { uri } = params;

      if (uri === HEALTH_URIS.STATUS) {
        const status = await getHealthStatus(version);
        return {
          contents: [
            {
              uri: HEALTH_URIS.STATUS,
              mimeType: "application/json",
              text: JSON.stringify(status, null, 2),
            },
          ],
        };
      }

      if (uri === HEALTH_URIS.CAPABILITIES) {
        const capabilities = await getServerCapabilities(toolRegistry, version);
        return {
          contents: [
            {
              uri: HEALTH_URIS.CAPABILITIES,
              mimeType: "application/json",
              text: JSON.stringify(capabilities, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown resource URI: ${uri}`);
    } catch (err) {
      const error = formatMcpError(err);
      logger.error("Error in ReadResourceRequestSchema handler", {
        error,
        message: error.message,
        uri: params.uri,
      });
      throw error;
    }
  });

  logger.info("Health resources registered", {
    resources: [HEALTH_URIS.STATUS, HEALTH_URIS.CAPABILITIES],
  });
}
