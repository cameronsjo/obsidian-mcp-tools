import { describe, expect, test } from "bun:test";
import {
  INPUT_LIMITS,
  assertValidInput,
  validateFileContent,
  validateInputSize,
  validatePathLength,
  validateRegexPattern,
  validateSearchQuery,
} from "./inputLimits";

describe("INPUT_LIMITS", () => {
  test("has reasonable default values", () => {
    expect(INPUT_LIMITS.FILE_CONTENT).toBe(10 * 1024 * 1024); // 10 MB
    expect(INPUT_LIMITS.SEARCH_QUERY).toBe(1000);
    expect(INPUT_LIMITS.PATH).toBe(4096);
    expect(INPUT_LIMITS.TEMPLATE_PARAMS).toBe(100 * 1024); // 100 KB
    expect(INPUT_LIMITS.URL).toBe(2048);
    expect(INPUT_LIMITS.REGEX_PATTERN).toBe(500);
    expect(INPUT_LIMITS.BATCH_SIZE).toBe(100);
    expect(INPUT_LIMITS.MAX_SCAN_FILES).toBe(500);
  });
});

describe("validateInputSize", () => {
  test("accepts undefined values", () => {
    const result = validateInputSize(undefined, 100, "field");
    expect(result.valid).toBe(true);
  });

  test("accepts values within limit", () => {
    const result = validateInputSize("hello", 100, "field");
    expect(result.valid).toBe(true);
  });

  test("accepts values at exactly the limit", () => {
    const result = validateInputSize("hello", 5, "field");
    expect(result.valid).toBe(true);
  });

  test("rejects values exceeding limit", () => {
    const result = validateInputSize("hello world", 5, "field");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("field");
    expect(result.error).toContain("5");
    expect(result.error).toContain("11");
  });

  test("includes field name in error message", () => {
    const result = validateInputSize("too long", 3, "MyField");
    expect(result.error).toContain("MyField");
  });
});

describe("validateFileContent", () => {
  test("accepts normal file content", () => {
    const content = "# My Note\n\nThis is some content.";
    const result = validateFileContent(content);
    expect(result.valid).toBe(true);
  });

  test("accepts undefined", () => {
    const result = validateFileContent(undefined);
    expect(result.valid).toBe(true);
  });

  test("rejects extremely large content", () => {
    // Create content larger than the limit
    const largeContent = "x".repeat(INPUT_LIMITS.FILE_CONTENT + 1);
    const result = validateFileContent(largeContent);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("File content");
  });
});

describe("validateSearchQuery", () => {
  test("accepts normal search queries", () => {
    const result = validateSearchQuery("how to implement authentication");
    expect(result.valid).toBe(true);
  });

  test("rejects very long search queries", () => {
    const longQuery = "x".repeat(INPUT_LIMITS.SEARCH_QUERY + 1);
    const result = validateSearchQuery(longQuery);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Search query");
  });
});

describe("validatePathLength", () => {
  test("accepts normal paths", () => {
    const result = validatePathLength("folder/subfolder/note.md");
    expect(result.valid).toBe(true);
  });

  test("rejects extremely long paths", () => {
    const longPath = "a/".repeat(INPUT_LIMITS.PATH);
    const result = validatePathLength(longPath);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Path");
  });
});

describe("validateRegexPattern", () => {
  test("accepts valid simple patterns", () => {
    expect(validateRegexPattern("hello").valid).toBe(true);
    expect(validateRegexPattern("\\d+").valid).toBe(true);
    expect(validateRegexPattern("^foo$").valid).toBe(true);
    expect(validateRegexPattern("[a-z]+").valid).toBe(true);
  });

  test("accepts undefined", () => {
    const result = validateRegexPattern(undefined);
    expect(result.valid).toBe(true);
  });

  test("rejects patterns that are too long", () => {
    const longPattern = "a".repeat(INPUT_LIMITS.REGEX_PATTERN + 1);
    const result = validateRegexPattern(longPattern);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("length");
  });

  test("rejects invalid regex syntax", () => {
    const result = validateRegexPattern("[invalid");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Invalid regex");
  });

  test("rejects dangerous nested quantifiers", () => {
    // These patterns could cause ReDoS
    expect(validateRegexPattern("(a+)+").valid).toBe(false);
    expect(validateRegexPattern("(a*)*").valid).toBe(false);
    expect(validateRegexPattern("([a-z]+)+").valid).toBe(false);
  });

  test("accepts safe quantifier patterns", () => {
    // These are safe patterns
    expect(validateRegexPattern("a+b+c+").valid).toBe(true);
    expect(validateRegexPattern("(abc)+").valid).toBe(true);
    expect(validateRegexPattern("[a-z]+").valid).toBe(true);
  });
});

describe("assertValidInput", () => {
  test("does not throw for valid input", () => {
    expect(() => assertValidInput({ valid: true })).not.toThrow();
  });

  test("throws for invalid input", () => {
    expect(() =>
      assertValidInput({ valid: false, error: "Test error" }),
    ).toThrow("Test error");
  });
});
