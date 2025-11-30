import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * Validates a vault-relative path to prevent path traversal attacks.
 *
 * Rejects paths that:
 * - Contain ".." segments (parent directory traversal)
 * - Start with "/" (absolute paths)
 * - Contain null bytes (null byte injection)
 * - Are empty or whitespace-only
 *
 * @param path - The path to validate (should be vault-relative)
 * @returns The normalized path if valid
 * @throws McpError if path is invalid or attempts traversal
 */
export function validateVaultPath(path: string): string {
  // Reject empty or whitespace-only paths
  if (!path || !path.trim()) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Path cannot be empty",
    );
  }

  // Reject null bytes (null byte injection attack)
  if (path.includes("\0")) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Path contains invalid characters",
    );
  }

  // Reject absolute paths
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Absolute paths are not allowed. Use vault-relative paths.",
    );
  }

  // Normalize the path and check for traversal
  const segments = path.split(/[/\\]/);
  const normalized: string[] = [];

  for (const segment of segments) {
    if (segment === "..") {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Path traversal (..) is not allowed",
      );
    }
    // Skip empty segments and current directory markers
    if (segment && segment !== ".") {
      normalized.push(segment);
    }
  }

  if (normalized.length === 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Path resolves to empty after normalization",
    );
  }

  return normalized.join("/");
}

/**
 * Validates an optional directory path.
 * Returns empty string for undefined/empty input, validated path otherwise.
 */
export function validateOptionalPath(path: string | undefined): string {
  if (!path || !path.trim()) {
    return "";
  }
  return validateVaultPath(path);
}
