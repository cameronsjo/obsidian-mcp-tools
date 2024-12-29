import { createLogger } from "shared";

/**
 * Creates a logger instance with the specified configuration.
 * The logger is configured to use the "obsidian-mcp-tools" app name,
 * "obsidian-plugin.log" as the log file name, and the log level is set
 * to "DEBUG" in development and "INFO" in production environments.
 */
export const logger = createLogger({
	appName: "obsidian-mcp-tools",
	filename: "obsidian-plugin.log",
	level: process.env.NODE_ENV === "production" ? "INFO" : "DEBUG",
});
