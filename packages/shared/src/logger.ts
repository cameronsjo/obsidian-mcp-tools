import { type } from "arktype";
import { existsSync, mkdirSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { getContext, getContextDuration } from "./requestContext.js";

/**
 * Determines the appropriate log directory path based on the current operating system.
 * @param appName - The name of the application to use in the log directory path.
 * @returns The full path to the log directory for the current operating system.
 * @throws {Error} If the current operating system is not supported.
 */
export function getLogFilePath(appName: string, fileName: string): string {
  switch (platform()) {
    case "darwin": // macOS
      return resolve(homedir(), "Library", "Logs", appName, fileName);

    case "win32": // Windows
      return resolve(homedir(), "AppData", "Local", "Logs", appName, fileName);

    case "linux": // Linux
      return resolve(homedir(), ".local", "share", "logs", appName, fileName);

    default:
      throw new Error("Unsupported operating system");
  }
}

const ensureDirSync = (dirPath: string): void => {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
};

const logLevels = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"] as const;
export const logLevelSchema = type.enumerated(...logLevels);
export type LogLevel = (typeof logLevelSchema)["infer"];

/**
 * Formats a log message as structured JSON.
 * Includes timestamp, level, message, context (if available), and metadata.
 * @param level - Log level
 * @param message - Log message
 * @param meta - Additional metadata to include
 * @returns Formatted JSON log line
 */
const formatMessage = (
  level: LogLevel,
  message: unknown,
  meta: Record<string, unknown>,
): string => {
  const timestamp = new Date().toISOString();
  const context = getContext();
  const duration = getContextDuration();

  // Build structured log entry
  const logEntry: Record<string, unknown> = {
    timestamp,
    level,
    message,
  };

  // Add context information if available
  if (context) {
    logEntry.requestId = context.requestId;
    if (context.toolName) {
      logEntry.toolName = context.toolName;
    }
    if (duration !== undefined) {
      logEntry.durationMs = duration;
    }
    if (context.metadata && Object.keys(context.metadata).length > 0) {
      logEntry.contextMetadata = context.metadata;
    }
  }

  // Add additional metadata
  if (Object.keys(meta).length > 0) {
    logEntry.metadata = meta;
  }

  return `${JSON.stringify(logEntry)}\n`;
};

const loggerConfigSchema = type({
  appName: "string",
  filename: "string",
  level: logLevelSchema,
});

export const loggerConfigMorph = loggerConfigSchema.pipe((config) => {
  const filename = getLogFilePath(config.appName, config.filename);
  const levels = logLevels.slice(logLevels.indexOf(config.level));
  return { ...config, levels, filename };
});

export type InputLoggerConfig = (typeof loggerConfigSchema)["infer"];
export type FullLoggerConfig = (typeof loggerConfigMorph)["infer"];

/**
 * Context that can be added to logger instances.
 * This is separate from request context and is for logger-level metadata.
 */
export interface LoggerContext {
  /** Additional metadata to include in all log entries */
  [key: string]: unknown;
}

/**
 * Logger instance with context support.
 * Provides methods for logging at different levels with structured output.
 */
export interface Logger {
  debug(message: unknown, meta?: Record<string, unknown>): void;
  info(message: unknown, meta?: Record<string, unknown>): void;
  warn(message: unknown, meta?: Record<string, unknown>): void;
  error(message: unknown, meta?: Record<string, unknown>): void;
  fatal(message: unknown, meta?: Record<string, unknown>): void;
  flush(): Promise<void[]>;
  config: FullLoggerConfig;
  meta: Record<string, unknown>;
  /**
   * Creates a child logger with additional context.
   * The context is merged with the parent's context and included in all log entries.
   * @param context - Additional context to add to this logger instance
   * @returns A new logger instance with the merged context
   */
  withContext(context: LoggerContext): Logger;
}

/**
 * Creates a logger instance with configurable options for logging to a file.
 * The logger provides methods for logging messages at different log levels (DEBUG, INFO, WARN, ERROR, FATAL).
 * Supports structured logging with automatic context propagation from AsyncLocalStorage.
 * @param config - An object with configuration options for the logger.
 * @param config.appName - The application name to use in the log directory path.
 * @param config.filename - The file path to use for logging to a file.
 * @param config.level - The minimum log level to log messages.
 * @returns A logger instance with logging methods.
 */
export function createLogger(inputConfig: InputLoggerConfig): Logger {
  let config: FullLoggerConfig = loggerConfigMorph.assert(inputConfig);
  let logMeta: Record<string, unknown> = {};

  const queue: Promise<void>[] = [];

  const log = (
    level: LogLevel,
    message: unknown,
    meta?: Record<string, unknown>,
  ): void => {
    if (!config.levels.includes(level)) return;

    ensureDirSync(dirname(getLogFilePath(config.appName, config.filename)));

    // Merge logger-level meta with call-specific meta
    const mergedMeta = { ...logMeta, ...(meta ?? {}) };

    queue.push(appendFile(config.filename, formatMessage(level, message, mergedMeta)));
  };

  const debug = (message: unknown, meta?: Record<string, unknown>): void =>
    log("DEBUG", message, meta);

  const info = (message: unknown, meta?: Record<string, unknown>): void =>
    log("INFO", message, meta);

  const warn = (message: unknown, meta?: Record<string, unknown>): void =>
    log("WARN", message, meta);

  const error = (message: unknown, meta?: Record<string, unknown>): void =>
    log("ERROR", message, meta);

  const fatal = (message: unknown, meta?: Record<string, unknown>): void =>
    log("FATAL", message, meta);

  const logger: Logger = {
    debug,
    info,
    warn,
    error,
    fatal,
    flush(): Promise<void[]> {
      return Promise.all(queue);
    },
    get config(): FullLoggerConfig {
      return { ...config };
    },
    /**
     * Updates the configuration of the logger instance.
     * @param newConfig - A partial configuration object to merge with the existing configuration.
     * This method updates the log levels based on the new configuration level, and then merges the new configuration with the existing configuration.
     */
    set config(newConfig: Partial<InputLoggerConfig>) {
      config = loggerConfigMorph.assert({ ...config, ...newConfig });
      logger.debug("Updated logger configuration", { config });
    },
    set meta(newMeta: Record<string, unknown>) {
      logMeta = newMeta;
    },
    get meta(): Record<string, unknown> {
      return { ...logMeta };
    },
    /**
     * Creates a child logger with additional context.
     * The context is merged with the parent's context and included in all log entries.
     * This is useful for adding persistent metadata like service names, module names, etc.
     * @param context - Additional context to add to this logger instance
     * @returns A new logger instance with the merged context
     */
    withContext(context: LoggerContext): Logger {
      const childLogger = createLogger(inputConfig);
      childLogger.meta = { ...logMeta, ...context };
      return childLogger;
    },
  };

  return logger;
}
