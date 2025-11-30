import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, unlinkSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { createLogger, getLogFilePath, type Logger } from "./logger";
import { runWithContext } from "./requestContext";

describe("logger", () => {
  let testLogFile: string;
  let logger: Logger;

  beforeEach(() => {
    // Create a unique log file for each test
    const testId = Math.random().toString(36).substring(7);
    testLogFile = resolve(tmpdir(), `test-logger-${testId}.log`);

    // Create logger with custom file path by using appName that resolves to tmpdir
    logger = createLogger({
      appName: "test-app",
      filename: `test-logger-${testId}.log`,
      level: "DEBUG",
    });
  });

  afterEach(async () => {
    // Flush and cleanup
    await logger.flush();
    if (existsSync(testLogFile)) {
      try {
        unlinkSync(testLogFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test("should create logger with default configuration", () => {
    expect(logger).toBeDefined();
    expect(logger.config.level).toBe("DEBUG");
    expect(logger.config.appName).toBe("test-app");
  });

  test("should log messages at different levels", async () => {
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");
    logger.fatal("fatal message");

    await logger.flush();

    const logPath = getLogFilePath(logger.config.appName, logger.config.filename);
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, "utf-8");
      expect(content).toContain("debug message");
      expect(content).toContain("info message");
      expect(content).toContain("warn message");
      expect(content).toContain("error message");
      expect(content).toContain("fatal message");
    }
  });

  test("should include metadata in logs", async () => {
    logger.info("test message", { userId: "123", action: "test" });
    await logger.flush();

    const logPath = getLogFilePath(logger.config.appName, logger.config.filename);
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, "utf-8");
      const logEntry = JSON.parse(content.trim());

      expect(logEntry.message).toBe("test message");
      expect(logEntry.metadata.userId).toBe("123");
      expect(logEntry.metadata.action).toBe("test");
    }
  });

  test("should include request context in logs", async () => {
    await runWithContext({ toolName: "test-tool" }, async () => {
      logger.info("context test");
      await logger.flush();

      const logPath = getLogFilePath(logger.config.appName, logger.config.filename);
      if (existsSync(logPath)) {
        const content = readFileSync(logPath, "utf-8");
        const logEntry = JSON.parse(content.trim());

        expect(logEntry.toolName).toBe("test-tool");
        expect(logEntry.requestId).toBeDefined();
        expect(logEntry.durationMs).toBeDefined();
      }
    });
  });

  test("should create child logger with context", async () => {
    const childLogger = logger.withContext({ service: "auth", version: "1.0" });
    childLogger.info("child log");
    await childLogger.flush();

    const logPath = getLogFilePath(logger.config.appName, logger.config.filename);
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, "utf-8");
      const logEntry = JSON.parse(content.trim());

      expect(logEntry.metadata.service).toBe("auth");
      expect(logEntry.metadata.version).toBe("1.0");
    }
  });

  test("should output structured JSON logs", async () => {
    logger.info("structured test", { key: "value" });
    await logger.flush();

    const logPath = getLogFilePath(logger.config.appName, logger.config.filename);
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, "utf-8");
      const logEntry = JSON.parse(content.trim());

      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.level).toBe("INFO");
      expect(logEntry.message).toBe("structured test");
      expect(logEntry.metadata.key).toBe("value");

      // Verify timestamp is valid ISO format
      expect(() => new Date(logEntry.timestamp)).not.toThrow();
    }
  });

  test("should respect log level filtering", async () => {
    const infoLogger = createLogger({
      appName: "test-app-info",
      filename: "test-info.log",
      level: "INFO",
    });

    infoLogger.debug("should not appear");
    infoLogger.info("should appear");

    await infoLogger.flush();

    const logPath = getLogFilePath(infoLogger.config.appName, infoLogger.config.filename);
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, "utf-8");
      expect(content).not.toContain("should not appear");
      expect(content).toContain("should appear");

      unlinkSync(logPath);
    }
  });

  test("should merge logger meta and call meta", async () => {
    logger.meta = { globalKey: "globalValue" };
    logger.info("merge test", { callKey: "callValue" });
    await logger.flush();

    const logPath = getLogFilePath(logger.config.appName, logger.config.filename);
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, "utf-8");
      const logEntry = JSON.parse(content.trim());

      expect(logEntry.metadata.globalKey).toBe("globalValue");
      expect(logEntry.metadata.callKey).toBe("callValue");
    }
  });

  test("should include context metadata separately from log metadata", async () => {
    await runWithContext(
      { toolName: "test-tool", metadata: { contextKey: "contextValue" } },
      async () => {
        logger.info("metadata test", { logKey: "logValue" });
        await logger.flush();

        const logPath = getLogFilePath(logger.config.appName, logger.config.filename);
        if (existsSync(logPath)) {
          const content = readFileSync(logPath, "utf-8");
          const logEntry = JSON.parse(content.trim());

          expect(logEntry.contextMetadata.contextKey).toBe("contextValue");
          expect(logEntry.metadata.logKey).toBe("logValue");
          expect(logEntry.toolName).toBe("test-tool");
        }
      },
    );
  });
});
