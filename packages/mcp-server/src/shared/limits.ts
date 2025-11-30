import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * Resource limits to prevent resource exhaustion attacks.
 *
 * These limits apply to all operations to ensure the MCP server
 * remains responsive and doesn't consume excessive resources.
 */
export const LIMITS = Object.freeze({
  /** Maximum size for file content being written (10MB) */
  MAX_FILE_CONTENT_SIZE: 10 * 1024 * 1024,

  /** Maximum length for search queries (1000 characters) */
  MAX_SEARCH_QUERY_LENGTH: 1000,

  /** Maximum path length (500 characters) */
  MAX_PATH_LENGTH: 500,

  /** Maximum number of files in bulk operations (1000 files) */
  MAX_BULK_OPERATION_COUNT: 1000,

  /** Maximum URL length for fetch operations (2048 characters) */
  MAX_URL_LENGTH: 2048,
}) as const;

/**
 * Formats byte size in human-readable format.
 *
 * @param bytes - The size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Validates that file content size is within acceptable limits.
 *
 * Prevents resource exhaustion from extremely large file writes.
 *
 * @param content - The file content to validate
 * @throws McpError if content exceeds MAX_FILE_CONTENT_SIZE
 */
export function validateFileContent(content: string): void {
  const size = Buffer.byteLength(content, "utf8");

  if (size > LIMITS.MAX_FILE_CONTENT_SIZE) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `File content size (${formatBytes(size)}) exceeds maximum allowed size (${formatBytes(LIMITS.MAX_FILE_CONTENT_SIZE)})`,
    );
  }
}

/**
 * Validates that search query length is within acceptable limits.
 *
 * Prevents performance issues from excessively long search queries.
 *
 * @param query - The search query to validate
 * @throws McpError if query exceeds MAX_SEARCH_QUERY_LENGTH
 */
export function validateSearchQuery(query: string): void {
  if (query.length > LIMITS.MAX_SEARCH_QUERY_LENGTH) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Search query length (${query.length} characters) exceeds maximum allowed length (${LIMITS.MAX_SEARCH_QUERY_LENGTH} characters)`,
    );
  }
}

/**
 * Validates that path length is within acceptable limits.
 *
 * Prevents issues with extremely long paths that could cause
 * filesystem or API errors.
 *
 * @param path - The path to validate
 * @throws McpError if path exceeds MAX_PATH_LENGTH
 */
export function validatePath(path: string): void {
  if (path.length > LIMITS.MAX_PATH_LENGTH) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Path length (${path.length} characters) exceeds maximum allowed length (${LIMITS.MAX_PATH_LENGTH} characters)`,
    );
  }
}

/**
 * Validates that bulk operation count is within acceptable limits.
 *
 * Prevents resource exhaustion from operations on too many files
 * at once.
 *
 * @param count - The number of items in the bulk operation
 * @throws McpError if count exceeds MAX_BULK_OPERATION_COUNT
 */
export function validateBulkCount(count: number): void {
  if (count > LIMITS.MAX_BULK_OPERATION_COUNT) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Bulk operation count (${count} items) exceeds maximum allowed count (${LIMITS.MAX_BULK_OPERATION_COUNT} items)`,
    );
  }

  if (count < 0) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Bulk operation count cannot be negative",
    );
  }
}

/**
 * Validates that URL length is within acceptable limits.
 *
 * Prevents issues with excessively long URLs that could cause
 * HTTP client errors or performance issues.
 *
 * @param url - The URL to validate
 * @throws McpError if URL exceeds MAX_URL_LENGTH
 */
export function validateUrl(url: string): void {
  if (url.length > LIMITS.MAX_URL_LENGTH) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `URL length (${url.length} characters) exceeds maximum allowed length (${LIMITS.MAX_URL_LENGTH} characters)`,
    );
  }
}
