/**
 * Input Size Limits and Validation
 *
 * Centralized configuration for input size limits to prevent resource exhaustion.
 * These limits protect against denial-of-service attacks and memory exhaustion.
 */

/**
 * Input size limits in bytes/characters
 *
 * These can be overridden via environment variables:
 * - INPUT_LIMIT_FILE_CONTENT: Max file content size
 * - INPUT_LIMIT_SEARCH_QUERY: Max search query length
 * - INPUT_LIMIT_PATH: Max path length
 * - INPUT_LIMIT_TEMPLATE_PARAMS: Max template parameters JSON size
 */
export const INPUT_LIMITS = {
  /**
   * Maximum file content size (10 MB default)
   * Applies to: create_note, update_note, update_active_file, append operations
   */
  FILE_CONTENT: getEnvNumber("INPUT_LIMIT_FILE_CONTENT", 10 * 1024 * 1024),

  /**
   * Maximum search query length (1000 chars default)
   * Applies to: search, semantic_search, find operations
   */
  SEARCH_QUERY: getEnvNumber("INPUT_LIMIT_SEARCH_QUERY", 1000),

  /**
   * Maximum path length (4096 chars default, matches most filesystems)
   * Applies to: all path parameters
   */
  PATH: getEnvNumber("INPUT_LIMIT_PATH", 4096),

  /**
   * Maximum template parameters JSON size (100 KB default)
   * Applies to: execute_template
   */
  TEMPLATE_PARAMS: getEnvNumber("INPUT_LIMIT_TEMPLATE_PARAMS", 100 * 1024),

  /**
   * Maximum URL length (2048 chars default)
   * Applies to: fetch tool
   */
  URL: getEnvNumber("INPUT_LIMIT_URL", 2048),

  /**
   * Maximum regex pattern length (500 chars default)
   * Prevents ReDoS attacks
   */
  REGEX_PATTERN: getEnvNumber("INPUT_LIMIT_REGEX_PATTERN", 500),

  /**
   * Maximum batch size for bulk operations (100 default)
   * Applies to: bulk_delete, bulk_move, bulk_rename
   */
  BATCH_SIZE: getEnvNumber("INPUT_LIMIT_BATCH_SIZE", 100),

  /**
   * Maximum number of files to scan (500 default)
   * Applies to: find_orphan_attachments, find_broken_links
   */
  MAX_SCAN_FILES: getEnvNumber("INPUT_LIMIT_MAX_SCAN_FILES", 500),
} as const;

/**
 * Get a number from environment variable with fallback
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Validation result for input checks
 */
export interface InputValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates that a string input is within size limits
 *
 * @param value - The string to validate
 * @param maxLength - Maximum allowed length
 * @param fieldName - Name of the field for error messages
 */
export function validateInputSize(
  value: string | undefined,
  maxLength: number,
  fieldName: string,
): InputValidationResult {
  if (value === undefined) {
    return { valid: true };
  }

  if (value.length > maxLength) {
    return {
      valid: false,
      error: `${fieldName} exceeds maximum length of ${maxLength} characters (got ${value.length})`,
    };
  }

  return { valid: true };
}

/**
 * Validates file content size
 */
export function validateFileContent(
  content: string | undefined,
): InputValidationResult {
  return validateInputSize(content, INPUT_LIMITS.FILE_CONTENT, "File content");
}

/**
 * Validates search query length
 */
export function validateSearchQuery(
  query: string | undefined,
): InputValidationResult {
  return validateInputSize(query, INPUT_LIMITS.SEARCH_QUERY, "Search query");
}

/**
 * Validates path length
 */
export function validatePathLength(
  path: string | undefined,
): InputValidationResult {
  return validateInputSize(path, INPUT_LIMITS.PATH, "Path");
}

/**
 * Validates regex pattern to prevent ReDoS
 *
 * Checks both length and pattern complexity
 */
export function validateRegexPattern(
  pattern: string | undefined,
): InputValidationResult {
  if (pattern === undefined) {
    return { valid: true };
  }

  // Check length
  const lengthCheck = validateInputSize(
    pattern,
    INPUT_LIMITS.REGEX_PATTERN,
    "Regex pattern",
  );
  if (!lengthCheck.valid) {
    return lengthCheck;
  }

  // Check for dangerous patterns that could cause ReDoS
  // Nested quantifiers like (a+)+ or (a*)*
  const nestedQuantifiers = /(\([^)]*[+*]\)[+*])|(\[[^\]]*\][+*][+*])/;
  if (nestedQuantifiers.test(pattern)) {
    return {
      valid: false,
      error:
        "Regex pattern contains potentially dangerous nested quantifiers that could cause performance issues",
    };
  }

  // Try to compile the regex to catch syntax errors
  try {
    new RegExp(pattern);
  } catch (e) {
    return {
      valid: false,
      error: `Invalid regex pattern: ${e instanceof Error ? e.message : "unknown error"}`,
    };
  }

  return { valid: true };
}

/**
 * Helper to throw an error if validation fails
 */
export function assertValidInput(result: InputValidationResult): void {
  if (!result.valid) {
    throw new Error(result.error);
  }
}
