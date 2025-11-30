import { describe, expect, test } from "bun:test";
import { McpError } from "@modelcontextprotocol/sdk/types.js";
import {
  LIMITS,
  validateFileContent,
  validateSearchQuery,
  validatePath,
  validateBulkCount,
  validateUrl,
} from "./limits";

describe("LIMITS constants", () => {
  test("defines expected limits", () => {
    expect(LIMITS.MAX_FILE_CONTENT_SIZE).toBe(10 * 1024 * 1024); // 10MB
    expect(LIMITS.MAX_SEARCH_QUERY_LENGTH).toBe(1000);
    expect(LIMITS.MAX_PATH_LENGTH).toBe(500);
    expect(LIMITS.MAX_BULK_OPERATION_COUNT).toBe(1000);
    expect(LIMITS.MAX_URL_LENGTH).toBe(2048);
  });

  test("limits are immutable", () => {
    // Object.freeze ensures runtime immutability
    expect(Object.isFrozen(LIMITS)).toBe(true);
    // Attempting to modify throws in strict mode
    const originalValue = LIMITS.MAX_FILE_CONTENT_SIZE;
    expect(() => {
      // @ts-expect-error - Testing runtime behavior
      LIMITS.MAX_FILE_CONTENT_SIZE = 999;
    }).toThrow(TypeError);
    // Value should remain unchanged
    expect(LIMITS.MAX_FILE_CONTENT_SIZE).toBe(originalValue);
  });
});

describe("validateFileContent", () => {
  test("accepts content under the limit", () => {
    const smallContent = "Hello, world!";
    expect(() => validateFileContent(smallContent)).not.toThrow();

    // 1MB content
    const mediumContent = "x".repeat(1024 * 1024);
    expect(() => validateFileContent(mediumContent)).not.toThrow();

    // Just under 10MB
    const largeContent = "y".repeat(10 * 1024 * 1024 - 1);
    expect(() => validateFileContent(largeContent)).not.toThrow();
  });

  test("accepts content exactly at the limit", () => {
    const exactContent = "z".repeat(10 * 1024 * 1024);
    expect(() => validateFileContent(exactContent)).not.toThrow();
  });

  test("rejects content over the limit", () => {
    const oversizedContent = "a".repeat(10 * 1024 * 1024 + 1);

    expect(() => validateFileContent(oversizedContent)).toThrow(McpError);

    try {
      validateFileContent(oversizedContent);
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).message).toContain("10.00 MB");
      expect((error as McpError).message).toContain("exceeds maximum");
    }
  });

  test("handles multi-byte UTF-8 characters correctly", () => {
    // UTF-8 emoji: 4 bytes each
    const emojiCount = Math.floor(10 * 1024 * 1024 / 4) + 1;
    const emojiContent = "😀".repeat(emojiCount);

    expect(() => validateFileContent(emojiContent)).toThrow(McpError);
  });

  test("accepts empty content", () => {
    expect(() => validateFileContent("")).not.toThrow();
  });

  test("error message includes human-readable sizes", () => {
    const content = "x".repeat(11 * 1024 * 1024);

    try {
      validateFileContent(content);
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect((error as McpError).message).toMatch(/\d+\.\d+ MB/);
      expect((error as McpError).message).toContain("10.00 MB");
    }
  });
});

describe("validateSearchQuery", () => {
  test("accepts queries under the limit", () => {
    expect(() => validateSearchQuery("short query")).not.toThrow();
    expect(() => validateSearchQuery("x".repeat(999))).not.toThrow();
  });

  test("accepts queries exactly at the limit", () => {
    const exactQuery = "y".repeat(1000);
    expect(() => validateSearchQuery(exactQuery)).not.toThrow();
  });

  test("rejects queries over the limit", () => {
    const longQuery = "z".repeat(1001);

    expect(() => validateSearchQuery(longQuery)).toThrow(McpError);

    try {
      validateSearchQuery(longQuery);
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).message).toContain("1001 characters");
      expect((error as McpError).message).toContain("1000 characters");
    }
  });

  test("accepts empty query", () => {
    expect(() => validateSearchQuery("")).not.toThrow();
  });

  test("handles multi-byte characters", () => {
    const query = "😀".repeat(501); // 501 characters (not bytes)
    expect(() => validateSearchQuery(query)).toThrow(McpError);
  });
});

describe("validatePath", () => {
  test("accepts paths under the limit", () => {
    expect(() => validatePath("folder/file.md")).not.toThrow();
    // 491 a's + "/file.md" (8 chars) = 499 chars, under the 500 limit
    expect(() => validatePath("a".repeat(491) + "/file.md")).not.toThrow();
  });

  test("accepts paths exactly at the limit", () => {
    const exactPath = "x".repeat(500);
    expect(() => validatePath(exactPath)).not.toThrow();
  });

  test("rejects paths over the limit", () => {
    const longPath = "y".repeat(501);

    expect(() => validatePath(longPath)).toThrow(McpError);

    try {
      validatePath(longPath);
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).message).toContain("501 characters");
      expect((error as McpError).message).toContain("500 characters");
    }
  });

  test("accepts empty path", () => {
    // Note: validateVaultPath would reject this, but validatePath only checks length
    expect(() => validatePath("")).not.toThrow();
  });

  test("handles deeply nested paths", () => {
    const deepPath = "folder/".repeat(100) + "file.md";

    if (deepPath.length > 500) {
      expect(() => validatePath(deepPath)).toThrow(McpError);
    } else {
      expect(() => validatePath(deepPath)).not.toThrow();
    }
  });
});

describe("validateBulkCount", () => {
  test("accepts counts under the limit", () => {
    expect(() => validateBulkCount(0)).not.toThrow();
    expect(() => validateBulkCount(1)).not.toThrow();
    expect(() => validateBulkCount(100)).not.toThrow();
    expect(() => validateBulkCount(999)).not.toThrow();
  });

  test("accepts count exactly at the limit", () => {
    expect(() => validateBulkCount(1000)).not.toThrow();
  });

  test("rejects counts over the limit", () => {
    expect(() => validateBulkCount(1001)).toThrow(McpError);
    expect(() => validateBulkCount(10000)).toThrow(McpError);

    try {
      validateBulkCount(1001);
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).message).toContain("1001 items");
      expect((error as McpError).message).toContain("1000 items");
    }
  });

  test("rejects negative counts", () => {
    expect(() => validateBulkCount(-1)).toThrow(McpError);
    expect(() => validateBulkCount(-100)).toThrow(McpError);

    try {
      validateBulkCount(-1);
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).message).toContain("cannot be negative");
    }
  });

  test("handles edge case of zero", () => {
    expect(() => validateBulkCount(0)).not.toThrow();
  });
});

describe("validateUrl", () => {
  test("accepts URLs under the limit", () => {
    expect(() => validateUrl("https://example.com")).not.toThrow();
    expect(() => validateUrl("https://example.com/" + "x".repeat(2000))).not.toThrow();
  });

  test("accepts URLs exactly at the limit", () => {
    const exactUrl = "https://example.com/" + "y".repeat(2048 - 20);
    expect(() => validateUrl(exactUrl)).not.toThrow();
  });

  test("rejects URLs over the limit", () => {
    const longUrl = "https://example.com/" + "z".repeat(2048);

    expect(() => validateUrl(longUrl)).toThrow(McpError);

    try {
      validateUrl(longUrl);
    } catch (error) {
      expect(error).toBeInstanceOf(McpError);
      expect((error as McpError).message).toContain("characters");
      expect((error as McpError).message).toContain("2048 characters");
    }
  });

  test("accepts empty URL", () => {
    // Note: URL parsing would reject this, but validateUrl only checks length
    expect(() => validateUrl("")).not.toThrow();
  });

  test("handles URLs with query parameters", () => {
    const queryParams = "?param1=value1&param2=value2".repeat(100);
    const urlWithParams = `https://example.com/api${queryParams}`;

    if (urlWithParams.length > 2048) {
      expect(() => validateUrl(urlWithParams)).toThrow(McpError);
    } else {
      expect(() => validateUrl(urlWithParams)).not.toThrow();
    }
  });

  test("handles URLs with fragments", () => {
    const fragment = "#section-" + "x".repeat(2000);
    const urlWithFragment = `https://example.com/${fragment}`;

    if (urlWithFragment.length > 2048) {
      expect(() => validateUrl(urlWithFragment)).toThrow(McpError);
    } else {
      expect(() => validateUrl(urlWithFragment)).not.toThrow();
    }
  });
});

describe("integration scenarios", () => {
  test("validates typical file write operation", () => {
    const content = "# My Note\n\nThis is some content.";
    const path = "notes/2024/january/my-note.md";

    expect(() => {
      validateFileContent(content);
      validatePath(path);
    }).not.toThrow();
  });

  test("validates typical search operation", () => {
    const query = "search term with some complexity";

    expect(() => {
      validateSearchQuery(query);
    }).not.toThrow();
  });

  test("validates typical bulk operation", () => {
    const fileCount = 50;

    expect(() => {
      validateBulkCount(fileCount);
    }).not.toThrow();
  });

  test("rejects malicious oversized inputs", () => {
    const maliciousContent = "x".repeat(100 * 1024 * 1024); // 100MB
    const maliciousQuery = "y".repeat(10000);
    const maliciousPath = "z".repeat(10000);

    expect(() => validateFileContent(maliciousContent)).toThrow(McpError);
    expect(() => validateSearchQuery(maliciousQuery)).toThrow(McpError);
    expect(() => validatePath(maliciousPath)).toThrow(McpError);
  });
});
