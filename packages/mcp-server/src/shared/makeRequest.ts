import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type, type Type } from "arktype";
import { logger } from "./logger";
import { getSafeEnvForLogging } from "./sanitize";
import { getBaseUrl, initializeTlsConfig } from "./tlsConfig";

// Initialize TLS configuration with localhost validation
// This validates that we're only connecting to localhost before bypassing TLS
const tlsConfig = initializeTlsConfig();
export const BASE_URL = getBaseUrl(tlsConfig);

/**
 * Makes a request to the Obsidian Local REST API with the provided path and optional request options.
 * Automatically adds the required API key to the request headers.
 * Throws an `McpError` if the API response is not successful.
 *
 * @param path - The path to the Obsidian API endpoint.
 * @param init - Optional request options to pass to the `fetch` function.
 * @returns The response from the Obsidian API.
 */

export async function makeRequest<
  T extends
    | Type<{}, {}>
    | Type<null | undefined, {}>
    | Type<{} | null | undefined, {}>,
>(schema: T, path: string, init?: RequestInit): Promise<T["infer"]> {
  const API_KEY = process.env.OBSIDIAN_API_KEY;
  if (!API_KEY) {
    // Security: Only log safe environment variables, never the full process.env
    logger.error("OBSIDIAN_API_KEY environment variable is required", {
      configuredEnv: getSafeEnvForLogging(),
      hint: "Set OBSIDIAN_API_KEY to the API key from Local REST API plugin settings",
    });
    throw new Error("OBSIDIAN_API_KEY environment variable is required");
  }

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "text/markdown",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    const message = `${init?.method ?? "GET"} ${path} ${response.status}: ${error}`;
    throw new McpError(ErrorCode.InternalError, message);
  }

  const isJSON = !!response.headers.get("Content-Type")?.includes("json");
  const data = isJSON ? await response.json() : await response.text();
  // 204 No Content responses should be validated as undefined
  const validated = response.status === 204 ? undefined : schema(data);
  if (validated instanceof type.errors) {
    const stackError = new Error();
    Error.captureStackTrace(stackError, makeRequest);
    logger.error("Invalid response from Obsidian API", {
      status: response.status,
      error: validated.summary,
      stack: stackError.stack,
      data,
    });
    throw new McpError(
      ErrorCode.InternalError,
      `${init?.method ?? "GET"} ${path} ${response.status}: ${validated.summary}`,
    );
  }

  return validated;
}
