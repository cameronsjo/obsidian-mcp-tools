import {
  createLogger,
  loggerConfigMorph,
  type InputLoggerConfig,
} from "shared";

const isProd = process.env.NODE_ENV === "production";

export const LOGGER_CONFIG: InputLoggerConfig = {
  appName: "Claude",
  filename: "obsidian-plugin-mcp-tools.log",
  level: "DEBUG",
};

export const { filename: FULL_LOGGER_FILENAME } =
  loggerConfigMorph.assert(LOGGER_CONFIG);

/**
 * In production, the logger is replaced with Console methods, so that the
 * logs are not written to a file.
 *
 * Creates a logger instance with the specified configuration.
 * The logger is configured to use the "Claude" app name,
 * "obsidian-plugin.log" as the log file name, and the log level is set
 * to "DEBUG" in development and "INFO" in production environments.
 */
export const logger = isProd ? console : createLogger(LOGGER_CONFIG);
