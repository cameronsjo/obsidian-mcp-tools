/**
 * Log Sanitization Utilities
 *
 * Prevents accidental leakage of sensitive information in log output.
 * Redacts API keys, tokens, passwords, and other PII from log entries.
 */

/**
 * Patterns that indicate sensitive keys in objects
 */
const SENSITIVE_KEY_PATTERNS = [
  /api[_-]?key/i,
  /auth[_-]?token/i,
  /access[_-]?token/i,
  /secret/i,
  /password/i,
  /passwd/i,
  /credential/i,
  /private[_-]?key/i,
  /bearer/i,
  /authorization/i,
  /session[_-]?id/i,
  /cookie/i,
  /jwt/i,
  /token/i,
];

/**
 * Patterns that indicate sensitive values (for string content)
 */
const SENSITIVE_VALUE_PATTERNS = [
  // Bearer tokens
  /Bearer\s+[A-Za-z0-9\-_]+\.?[A-Za-z0-9\-_]*\.?[A-Za-z0-9\-_]*/gi,
  // Stripe-style keys (sk_test_xxx, pk_live_xxx, etc.)
  /(?:sk|pk|api)_(?:test|live|prod)?_?[A-Za-z0-9]{20,}/gi,
  // AWS keys
  /AKIA[0-9A-Z]{16}/gi,
  // Generic long alphanumeric strings that look like keys (32+ chars)
  /[A-Za-z0-9]{32,}/g,
];

/**
 * Redaction placeholder
 */
const REDACTED = "[REDACTED]";

/**
 * Check if a key name suggests sensitive data
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Redact sensitive patterns from a string value
 */
function redactSensitivePatterns(value: string): string {
  let result = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    result = result.replace(pattern, REDACTED);
  }
  return result;
}

/**
 * Recursively sanitize an object for safe logging
 *
 * @param obj - The object to sanitize
 * @param depth - Current recursion depth (prevents infinite loops)
 * @returns A sanitized copy of the object safe for logging
 */
export function sanitizeForLogging(
  obj: unknown,
  depth = 0,
): unknown {
  const MAX_DEPTH = 10;

  if (depth > MAX_DEPTH) {
    return "[MAX_DEPTH_EXCEEDED]";
  }

  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj === "string") {
    return redactSensitivePatterns(obj);
  }

  if (typeof obj !== "object") {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item, depth + 1));
  }

  // Handle Error objects
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: redactSensitivePatterns(obj.message),
      stack: obj.stack ? redactSensitivePatterns(obj.stack) : undefined,
    };
  }

  // Handle plain objects
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = REDACTED;
    } else if (typeof value === "string") {
      sanitized[key] = redactSensitivePatterns(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForLogging(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Environment variable keys that are safe to log
 */
const SAFE_ENV_KEYS = [
  "NODE_ENV",
  "LOG_LEVEL",
  "OBSIDIAN_HOST",
  "OBSIDIAN_USE_HTTP",
  "OBSIDIAN_MCP_SCOPES",
  "FETCH_ALLOW_PRIVATE_IPS",
  "FETCH_ALLOW_LOCALHOST",
  "FETCH_ALLOWED_DOMAINS",
  "FETCH_BLOCKED_DOMAINS",
];

/**
 * Get a sanitized subset of environment variables safe for logging
 *
 * Only includes non-sensitive configuration variables.
 * Never includes API keys, tokens, or secrets.
 */
export function getSafeEnvForLogging(): Record<string, string | undefined> {
  const safeEnv: Record<string, string | undefined> = {};
  for (const key of SAFE_ENV_KEYS) {
    if (process.env[key] !== undefined) {
      safeEnv[key] = process.env[key];
    }
  }
  return safeEnv;
}
