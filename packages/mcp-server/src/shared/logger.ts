import { createLogger } from "shared";

/**
 * The logger instance for the MCP server application.
 * This logger is configured with the "obsidian-mcp-tools" app name, writes to the "mcp-server.log" file,
 * and uses the "INFO" log level in production environments and "DEBUG" in development environments.
 */
export const logger = createLogger({
  appName: "obsidian-mcp-tools",
  filename: "mcp-server.log",
  level: process.env.NODE_ENV === "production" ? "INFO" : "DEBUG",
});
