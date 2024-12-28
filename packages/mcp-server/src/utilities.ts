import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype";
import { zip } from "radash";

/**
 * Formats a template string with the provided values, while preserving the original indentation.
 * This function is used to format error messages or other string templates that need to preserve
 * the original formatting.
 *
 * @param strings - An array of template strings.
 * @param values - The values to be interpolated into the template strings.
 * @returns The formatted string with the values interpolated.
 *
 * @example
 * const f``
 */
export const f = (strings: TemplateStringsArray, ...values: any[]) => {
  const stack = { stack: "" };
  Error.captureStackTrace(stack, f);

  // Get the first caller's line from the stack trace
  const stackLine = stack.stack.split("\n")[1];

  // Extract column number using regex
  // This matches the column number at the end of the line like: "at filename:line:column"
  const columnMatch = stackLine.match(/:(\d+)$/);
  const columnNumber = columnMatch ? parseInt(columnMatch[1]) - 1 : 0;

  return zip(
    strings.map((s) => s.replace(new RegExp(`\n\s{${columnNumber}}`), "\n")),
    values,
  )
    .flat()
    .join("")
    .trim();
};

/**
 * A Map-like data structure that automatically evicts the oldest entry when the maximum number of entries is reached.
 */
export class CacheMap<K, V> extends Map<K, V> {
  constructor(private readonly maxEntries: number) {
    super();
  }

  set(key: K, value: V) {
    if (this.size >= this.maxEntries) {
      const oldest = this.keys().next().value;
      if (oldest) this.delete(oldest);
    }
    return super.set(key, value);
  }
}

export function formatMcpError(error: unknown) {
  if (error instanceof McpError) {
    return error;
  }

  if (error instanceof type.errors) {
    const message = error.summary;
    return new McpError(ErrorCode.InvalidParams, message);
  }

  if (type({ message: "string" }).allows(error)) {
    return new McpError(ErrorCode.InternalError, error.message);
  }

  return new McpError(
    ErrorCode.InternalError,
    "An unexpected error occurred",
    error,
  );
}
