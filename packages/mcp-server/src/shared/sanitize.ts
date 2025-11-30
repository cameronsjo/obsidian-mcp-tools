/**
 * Log sanitization utilities to prevent sensitive data leakage.
 *
 * This module provides functions to sanitize data before logging, redacting:
 * - API keys and Bearer tokens
 * - Email addresses
 * - Password fields
 * - File paths (optionally)
 * - Environment variables
 *
 * WHY: Prevents accidental exposure of sensitive data in logs, which is a
 * critical security vulnerability (OWASP A09: Logging Failures).
 */

const REDACTED = "[REDACTED]";
const EMAIL_REDACTED = "[EMAIL]";
const PATH_REDACTED = "[PATH]";

/**
 * Patterns that indicate sensitive data requiring redaction.
 * WHY: These patterns must be applied in a specific order to avoid conflicts.
 * Basic auth must be processed before email to prevent false matches.
 */
const SENSITIVE_PATTERNS = {
  /** Basic auth in URLs (must be before email pattern) */
  basicAuth: /(https?:\/\/)[^:@\s]+:[^@\s]+@/gi,
  /** Bearer tokens in Authorization headers */
  bearerToken: /Bearer\s+[\w\-._~+/]+=*/gi,
  /** API keys in query parameters or JSON */
  apiKey: /(['"]?(?:api[_-]?key|apikey|token|secret|password|passwd)['"]?\s*[:=]\s*)(['"]?)([^\s"',}]+)\2/gi,
  /** OBSIDIAN_API_KEY environment variable value */
  obsidianApiKey: /(OBSIDIAN_API_KEY['"]?\s*[:=]\s*)(['"]?)([^\s"',}]+)\2/gi,
  /** Email addresses (must be after basic auth) */
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
} as const;

/**
 * Field names that commonly contain sensitive data.
 * These fields will have their values redacted entirely.
 */
const SENSITIVE_FIELD_NAMES = new Set([
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "api_key",
  "apikey",
  "apiKey",
  "apiToken",
  "authorization",
  "auth",
  "credentials",
  "private_key",
  "privateKey",
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "session",
  "cookie",
  "OBSIDIAN_API_KEY",
]);

/**
 * Environment variable names that should never be logged.
 */
const SENSITIVE_ENV_VARS = new Set([
  "OBSIDIAN_API_KEY",
  "API_KEY",
  "SECRET",
  "TOKEN",
  "PASSWORD",
  "PASSWD",
  "PRIVATE_KEY",
  "ACCESS_TOKEN",
  "REFRESH_TOKEN",
  "SESSION_SECRET",
  "COOKIE_SECRET",
  "DATABASE_URL",
  "DB_PASSWORD",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_ACCESS_KEY_ID",
  "GITHUB_TOKEN",
  "NPM_TOKEN",
]);

export interface SanitizeOptions {
  /**
   * Whether to redact file paths to just filenames.
   * Default: false
   */
  redactPaths?: boolean;

  /**
   * Custom patterns to redact (in addition to built-in patterns).
   */
  customPatterns?: RegExp[];

  /**
   * Custom field names to redact (in addition to built-in field names).
   */
  customFieldNames?: string[];
}

/**
 * Sanitizes a string by redacting sensitive patterns.
 * WHY: Order matters - basic auth must be redacted before email pattern
 * to avoid false matches in URLs like user:pass@host.
 *
 * @param value - The string to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string with sensitive data redacted
 */
function sanitizeString(
  value: string,
  options: SanitizeOptions = {},
): string {
  let sanitized = value;

  // Redact basic auth in URLs FIRST (before email pattern)
  sanitized = sanitized.replace(
    SENSITIVE_PATTERNS.basicAuth,
    `$1${REDACTED}@`,
  );

  // Redact Bearer tokens
  sanitized = sanitized.replace(
    SENSITIVE_PATTERNS.bearerToken,
    `Bearer ${REDACTED}`,
  );

  // Redact API keys and secrets
  sanitized = sanitized.replace(
    SENSITIVE_PATTERNS.apiKey,
    `$1$2${REDACTED}$2`,
  );

  // Redact OBSIDIAN_API_KEY specifically
  sanitized = sanitized.replace(
    SENSITIVE_PATTERNS.obsidianApiKey,
    `$1$2${REDACTED}$2`,
  );

  // Redact email addresses LAST (after basic auth)
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.email, EMAIL_REDACTED);

  // Apply custom patterns
  if (options.customPatterns) {
    for (const pattern of options.customPatterns) {
      sanitized = sanitized.replace(pattern, REDACTED);
    }
  }

  // Redact file paths if requested
  if (options.redactPaths) {
    // Match common path patterns (Unix and Windows)
    sanitized = sanitized.replace(
      /(?:\/[^/\s:]+)+|(?:[A-Z]:\\(?:[^\\:\s]+\\)*[^\\:\s]+)/g,
      PATH_REDACTED,
    );
  }

  return sanitized;
}

/**
 * Checks if a field name is sensitive and should be redacted.
 *
 * @param key - The field name to check
 * @param customFieldNames - Additional field names to consider sensitive
 * @returns True if the field name is sensitive
 */
function isSensitiveFieldName(
  key: string,
  customFieldNames?: string[],
): boolean {
  const lowerKey = key.toLowerCase();

  // Check built-in sensitive field names
  if (SENSITIVE_FIELD_NAMES.has(key) || SENSITIVE_FIELD_NAMES.has(lowerKey)) {
    return true;
  }

  // Check custom field names
  if (customFieldNames) {
    return customFieldNames.some(
      (name) => name === key || name.toLowerCase() === lowerKey,
    );
  }

  return false;
}

/**
 * Sanitizes environment variables object.
 *
 * @param env - Environment variables object
 * @returns Sanitized environment variables
 */
function sanitizeEnv(
  env: Record<string, string | undefined>,
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      continue;
    }

    // Check if the env var name is sensitive
    const isSensitive = SENSITIVE_ENV_VARS.has(key) ||
      SENSITIVE_ENV_VARS.has(key.toUpperCase()) ||
      /(?:key|token|secret|password|passwd|credential)/i.test(key);

    sanitized[key] = isSensitive ? REDACTED : value;
  }

  return sanitized;
}

/**
 * Internal implementation of sanitizeForLog with circular reference detection.
 * WHY: Tracks visited objects to prevent infinite recursion on circular references.
 */
function sanitizeForLogInternal(
  data: unknown,
  options: SanitizeOptions,
  visited: WeakSet<object>,
): unknown {
  // Handle primitives
  if (
    data === null ||
    data === undefined ||
    typeof data === "number" ||
    typeof data === "boolean"
  ) {
    return data;
  }

  // Handle strings
  if (typeof data === "string") {
    return sanitizeString(data, options);
  }

  // Handle Date objects
  if (data instanceof Date) {
    return data.toISOString();
  }

  // Handle Error objects
  if (data instanceof Error) {
    return {
      name: data.name,
      message: sanitizeString(data.message, options),
      stack: options.redactPaths
        ? sanitizeString(data.stack ?? "", options)
        : data.stack,
    };
  }

  // Check for circular references
  if (typeof data === "object") {
    if (visited.has(data)) {
      return "[Circular]";
    }
    visited.add(data);
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLogInternal(item, options, visited));
  }

  // Handle plain objects
  if (typeof data === "object") {
    // Special handling for process.env
    if (data === process.env) {
      return sanitizeEnv(data as Record<string, string | undefined>);
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      // Check if the field name itself is sensitive
      if (isSensitiveFieldName(key, options.customFieldNames)) {
        sanitized[key] = REDACTED;
        continue;
      }

      // Special handling for 'env' field
      if (key === "env" && typeof value === "object" && value !== null) {
        sanitized[key] = sanitizeEnv(
          value as Record<string, string | undefined>,
        );
        continue;
      }

      // Recursively sanitize the value
      sanitized[key] = sanitizeForLogInternal(value, options, visited);
    }

    return sanitized;
  }

  // For other types (functions, symbols, etc.), convert to string
  return String(data);
}

/**
 * Recursively sanitizes data for safe logging.
 *
 * This function creates a sanitized copy of the input data without mutating
 * the original. It handles:
 * - Strings: Applies pattern-based redaction
 * - Objects: Recursively sanitizes properties, redacts sensitive field names
 * - Arrays: Recursively sanitizes elements
 * - Primitives: Returns as-is (numbers, booleans, null, undefined)
 * - Circular references: Detects and replaces with "[Circular]"
 *
 * WHY: Provides a safe way to log complex data structures that may contain
 * sensitive information at any depth.
 *
 * @param data - The data to sanitize (any type)
 * @param options - Sanitization options
 * @returns Sanitized copy of the data
 *
 * @example
 * ```typescript
 * const data = {
 *   user: "john@example.com",
 *   apiKey: "secret123",
 *   nested: { password: "pass123" }
 * };
 * const safe = sanitizeForLog(data);
 * // {
 * //   user: "[EMAIL]",
 * //   apiKey: "[REDACTED]",
 * //   nested: { password: "[REDACTED]" }
 * // }
 * ```
 */
export function sanitizeForLog(
  data: unknown,
  options: SanitizeOptions = {},
): unknown {
  return sanitizeForLogInternal(data, options, new WeakSet());
}

/**
 * Type guard to check if a value is likely sensitive based on context.
 *
 * @param key - The field name or context
 * @param value - The value to check
 * @returns True if the value appears to be sensitive
 */
export function isSensitiveValue(key: string, value: unknown): boolean {
  if (typeof value !== "string") {
    return false;
  }

  // Check if field name is sensitive
  if (isSensitiveFieldName(key)) {
    return true;
  }

  // Check if value matches sensitive patterns
  return (
    SENSITIVE_PATTERNS.bearerToken.test(value) ||
    SENSITIVE_PATTERNS.apiKey.test(value) ||
    SENSITIVE_PATTERNS.basicAuth.test(value)
  );
}
