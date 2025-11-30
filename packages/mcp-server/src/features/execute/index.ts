/**
 * Tool-as-Code Execution Feature
 *
 * Provides a single `execute` tool that allows LLMs to write and execute
 * JavaScript code against the vault API instead of calling many individual tools.
 *
 * This follows the pattern described in Anthropic's blog post:
 * https://www.anthropic.com/engineering/code-execution-with-mcp
 *
 * Benefits:
 * - Reduces context usage (one tool vs 20+)
 * - Enables complex multi-step operations
 * - Allows custom logic (loops, conditions, etc.)
 * - More flexible than predefined operations
 */

import { type ToolRegistry, logger, SCOPES, requireScopeInSession } from "$/shared";
import { type } from "arktype";
import { executeInSandbox, API_DOCUMENTATION } from "./sandbox";

// Re-export types for external use
export * from "./types";

/**
 * Register the execute tool.
 *
 * The execute tool requires `plugins:execute` scope, which is included in
 * the "editor", "full", and "admin" presets.
 */
export function registerExecuteTool(tools: ToolRegistry) {
  tools.register(
    type({
      name: '"execute"',
      arguments: {
        code: type("string").describe(
          "JavaScript code to execute against the vault API. " +
            "Use 'vault.*' methods to interact with files. " +
            "Use 'return' to return a result. " +
            "Console output is captured.",
        ),
        "timeout?": type("number").describe(
          "Execution timeout in milliseconds (default: 30000, max: 120000).",
        ),
      },
    }).describe(
      "Execute JavaScript code with access to the Obsidian vault API. " +
        "This is the most flexible way to interact with the vault, allowing " +
        "complex operations like bulk processing, conditional logic, and data transformation. " +
        API_DOCUMENTATION,
    ),
    async ({ arguments: args }) => {
      // Require execute scope - this is a powerful capability
      requireScopeInSession(SCOPES.PLUGINS_EXECUTE);

      logger.info("Executing code via execute tool", {
        codeLength: args.code.length,
        timeout: args.timeout,
      });

      // Validate and cap timeout
      const timeout = Math.min(
        Math.max(args.timeout ?? 30_000, 1000),
        120_000, // Max 2 minutes
      );

      // Execute in sandbox
      const result = await executeInSandbox(args.code, { timeout });

      // Format response
      const responseContent: Array<{ type: "text"; text: string }> = [];

      // Add result if present
      if (result.success) {
        if (result.result !== undefined) {
          const resultText =
            typeof result.result === "string"
              ? result.result
              : JSON.stringify(result.result, null, 2);
          responseContent.push({
            type: "text",
            text: `Result:\n${resultText}`,
          });
        } else {
          responseContent.push({
            type: "text",
            text: "Execution completed successfully (no return value).",
          });
        }
      } else {
        responseContent.push({
          type: "text",
          text: `Error: ${result.error}`,
        });
      }

      // Add console output if present
      if (result.logs.length > 0) {
        responseContent.push({
          type: "text",
          text: `Console output:\n${result.logs.join("\n")}`,
        });
      }

      // Add timing info
      responseContent.push({
        type: "text",
        text: `Execution time: ${result.duration.toFixed(2)}ms`,
      });

      return {
        content: responseContent,
        isError: !result.success,
      };
    },
  );
}
