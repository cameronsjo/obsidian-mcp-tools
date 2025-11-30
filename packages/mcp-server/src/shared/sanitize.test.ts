import { describe, expect, test } from "bun:test";
import {
  isSensitiveValue,
  sanitizeForLog,
  type SanitizeOptions,
} from "./sanitize";

describe("sanitizeForLog", () => {
  describe("primitives", () => {
    test("returns null as-is", () => {
      expect(sanitizeForLog(null)).toBe(null);
    });

    test("returns undefined as-is", () => {
      expect(sanitizeForLog(undefined)).toBe(undefined);
    });

    test("returns numbers as-is", () => {
      expect(sanitizeForLog(42)).toBe(42);
      expect(sanitizeForLog(3.14)).toBe(3.14);
      expect(sanitizeForLog(-100)).toBe(-100);
    });

    test("returns booleans as-is", () => {
      expect(sanitizeForLog(true)).toBe(true);
      expect(sanitizeForLog(false)).toBe(false);
    });
  });

  describe("strings", () => {
    test("returns safe strings unchanged", () => {
      const safe = "This is a safe log message";
      expect(sanitizeForLog(safe)).toBe(safe);
    });

    test("redacts Bearer tokens", () => {
      const input = "Authorization: Bearer abc123xyz";
      const result = sanitizeForLog(input);
      expect(result).toBe("Authorization: Bearer [REDACTED]");
    });

    test("redacts Bearer tokens case-insensitively", () => {
      const input = "Authorization: BEARER abc123xyz";
      const result = sanitizeForLog(input);
      expect(result).toBe("Authorization: Bearer [REDACTED]");
    });

    test("redacts multiple Bearer tokens", () => {
      const input = "Bearer token1 and Bearer token2";
      const result = sanitizeForLog(input);
      expect(result).toBe("Bearer [REDACTED] and Bearer [REDACTED]");
    });

    test("redacts API keys in query parameters", () => {
      const input = "https://api.example.com?api_key=secret123";
      const result = sanitizeForLog(input);
      expect(result).toContain("api_key=[REDACTED]");
    });

    test("redacts API keys with quotes", () => {
      const input = '{"api_key": "secret123"}';
      const result = sanitizeForLog(input);
      expect(result).toContain('"api_key": "[REDACTED]"');
    });

    test("redacts apiKey camelCase", () => {
      const input = "apiKey=secret123";
      const result = sanitizeForLog(input);
      expect(result).toContain("apiKey=[REDACTED]");
    });

    test("redacts token fields", () => {
      const input = "token: abc123";
      const result = sanitizeForLog(input);
      expect(result).toContain("token: [REDACTED]");
    });

    test("redacts secret fields", () => {
      const input = "secret=mysecret";
      const result = sanitizeForLog(input);
      expect(result).toContain("secret=[REDACTED]");
    });

    test("redacts password fields", () => {
      const input = "password: pass123";
      const result = sanitizeForLog(input);
      expect(result).toContain("password: [REDACTED]");
    });

    test("redacts OBSIDIAN_API_KEY specifically", () => {
      const input = "OBSIDIAN_API_KEY=super_secret_key_123";
      const result = sanitizeForLog(input);
      expect(result).toContain("OBSIDIAN_API_KEY=[REDACTED]");
    });

    test("redacts OBSIDIAN_API_KEY with quotes", () => {
      const input = 'OBSIDIAN_API_KEY="super_secret_key_123"';
      const result = sanitizeForLog(input);
      expect(result).toContain('OBSIDIAN_API_KEY="[REDACTED]"');
    });

    test("redacts email addresses", () => {
      const input = "User: john.doe@example.com logged in";
      const result = sanitizeForLog(input);
      expect(result).toBe("User: [EMAIL] logged in");
    });

    test("redacts multiple email addresses", () => {
      const input = "From: alice@test.com To: bob@test.org";
      const result = sanitizeForLog(input);
      expect(result).toBe("From: [EMAIL] To: [EMAIL]");
    });

    test("redacts basic auth in URLs", () => {
      const input = "https://user:pass@example.com/api";
      const result = sanitizeForLog(input);
      expect(result).toBe("https://[REDACTED]@example.com/api");
    });

    test("redacts http basic auth", () => {
      const input = "http://admin:secret@localhost:8080/";
      const result = sanitizeForLog(input);
      expect(result).toBe("http://[REDACTED]@localhost:8080/");
    });

    test("applies custom patterns", () => {
      const input = "SSN: 123-45-6789";
      const options: SanitizeOptions = {
        customPatterns: [/\d{3}-\d{2}-\d{4}/g],
      };
      const result = sanitizeForLog(input, options);
      expect(result).toBe("SSN: [REDACTED]");
    });

    test("redacts file paths when option enabled", () => {
      const input = "File at /Users/john/Documents/secret.txt";
      const options: SanitizeOptions = { redactPaths: true };
      const result = sanitizeForLog(input, options);
      expect(result).toBe("File at [PATH]");
    });

    test("redacts Windows paths when option enabled", () => {
      const input = "File at C:\\Users\\john\\Documents\\secret.txt";
      const options: SanitizeOptions = { redactPaths: true };
      const result = sanitizeForLog(input, options);
      expect(result).toBe("File at [PATH]");
    });

    test("preserves paths when option disabled", () => {
      const input = "File at /Users/john/Documents/file.txt";
      const result = sanitizeForLog(input);
      expect(result).toBe(input);
    });
  });

  describe("arrays", () => {
    test("sanitizes array elements", () => {
      const input = [
        "safe message",
        "Bearer token123",
        "user@example.com",
      ];
      const result = sanitizeForLog(input);
      expect(result).toEqual([
        "safe message",
        "Bearer [REDACTED]",
        "[EMAIL]",
      ]);
    });

    test("sanitizes nested arrays", () => {
      const input = [
        ["Bearer token1"],
        ["api_key=secret"],
      ];
      const result = sanitizeForLog(input);
      expect(result).toEqual([
        ["Bearer [REDACTED]"],
        ["api_key=[REDACTED]"],
      ]);
    });

    test("sanitizes mixed type arrays", () => {
      const input = [42, "Bearer token", true, null];
      const result = sanitizeForLog(input);
      expect(result).toEqual([42, "Bearer [REDACTED]", true, null]);
    });
  });

  describe("objects", () => {
    test("sanitizes object values", () => {
      const input = {
        message: "safe",
        header: "Bearer secret123",
      };
      const result = sanitizeForLog(input);
      expect(result).toEqual({
        message: "safe",
        header: "Bearer [REDACTED]",
      });
    });

    test("redacts sensitive field names", () => {
      const input = {
        username: "john",
        password: "pass123",
        apiKey: "secret",
        normal: "value",
      };
      const result = sanitizeForLog(input);
      expect(result).toEqual({
        username: "john",
        password: "[REDACTED]",
        apiKey: "[REDACTED]",
        normal: "value",
      });
    });

    test("redacts sensitive field names case-insensitively", () => {
      const input = {
        PASSWORD: "pass123",
        ApiKey: "secret",
        SeCrEt: "value",
      };
      const result = sanitizeForLog(input);
      expect(result).toEqual({
        PASSWORD: "[REDACTED]",
        ApiKey: "[REDACTED]",
        SeCrEt: "[REDACTED]",
      });
    });

    test("redacts OBSIDIAN_API_KEY field", () => {
      const input = {
        OBSIDIAN_API_KEY: "super_secret",
        other: "safe",
      };
      const result = sanitizeForLog(input);
      expect(result).toEqual({
        OBSIDIAN_API_KEY: "[REDACTED]",
        other: "safe",
      });
    });

    test("sanitizes nested objects", () => {
      const input = {
        user: {
          name: "john",
          email: "john@example.com",
          settings: {
            password: "pass123",
            apiToken: "secret",
          },
        },
      };
      const result = sanitizeForLog(input);
      expect(result).toEqual({
        user: {
          name: "john",
          email: "[EMAIL]",
          settings: {
            password: "[REDACTED]",
            apiToken: "[REDACTED]",
          },
        },
      });
    });

    test("sanitizes objects with custom field names", () => {
      const input = {
        customSecret: "value123",
        normal: "safe",
      };
      const options: SanitizeOptions = {
        customFieldNames: ["customSecret"],
      };
      const result = sanitizeForLog(input, options);
      expect(result).toEqual({
        customSecret: "[REDACTED]",
        normal: "safe",
      });
    });

    test("sanitizes env field specially", () => {
      const input = {
        message: "test",
        env: {
          NODE_ENV: "production",
          OBSIDIAN_API_KEY: "secret123",
          PORT: "3000",
        },
      };
      const result = sanitizeForLog(input);
      expect(result).toEqual({
        message: "test",
        env: {
          NODE_ENV: "production",
          OBSIDIAN_API_KEY: "[REDACTED]",
          PORT: "3000",
        },
      });
    });

    test("handles process.env object", () => {
      // Create a mock env object that looks like process.env
      const mockEnv = {
        NODE_ENV: "test",
        OBSIDIAN_API_KEY: "secret",
        API_KEY: "another_secret",
        PORT: "3000",
        PATH: "/usr/bin",
      };

      const result = sanitizeForLog({ env: mockEnv });
      expect(result).toEqual({
        env: {
          NODE_ENV: "test",
          OBSIDIAN_API_KEY: "[REDACTED]",
          API_KEY: "[REDACTED]",
          PORT: "3000",
          PATH: "/usr/bin",
        },
      });
    });

    test("redacts common sensitive env var names", () => {
      const mockEnv = {
        PASSWORD: "pass",
        SECRET: "secret",
        TOKEN: "token",
        PRIVATE_KEY: "key",
        ACCESS_TOKEN: "access",
        DATABASE_URL: "postgres://user:pass@host/db",
      };

      const result = sanitizeForLog({ env: mockEnv });
      const sanitized = result as { env: Record<string, string> };

      expect(sanitized.env.PASSWORD).toBe("[REDACTED]");
      expect(sanitized.env.SECRET).toBe("[REDACTED]");
      expect(sanitized.env.TOKEN).toBe("[REDACTED]");
      expect(sanitized.env.PRIVATE_KEY).toBe("[REDACTED]");
      expect(sanitized.env.ACCESS_TOKEN).toBe("[REDACTED]");
      expect(sanitized.env.DATABASE_URL).toBe("[REDACTED]");
    });

    test("does not mutate original object", () => {
      const input = {
        password: "secret123",
        nested: { token: "abc" },
      };
      const original = JSON.parse(JSON.stringify(input));

      sanitizeForLog(input);

      expect(input).toEqual(original);
    });
  });

  describe("special types", () => {
    test("converts Date to ISO string", () => {
      const date = new Date("2024-01-15T12:00:00Z");
      const result = sanitizeForLog(date);
      expect(result).toBe("2024-01-15T12:00:00.000Z");
    });

    test("sanitizes Error objects", () => {
      const error = new Error("Bearer token123 failed");
      const result = sanitizeForLog(error) as {
        name: string;
        message: string;
        stack?: string;
      };

      expect(result.name).toBe("Error");
      expect(result.message).toBe("Bearer [REDACTED] failed");
      expect(result.stack).toBeDefined();
    });

    test("redacts paths in Error stack when option enabled", () => {
      const error = new Error("Error at /Users/john/file.ts line 10");
      error.stack = "Error: Error at /Users/john/file.ts line 10\n  at /Users/john/file.ts line 10";

      const result = sanitizeForLog(error, { redactPaths: true }) as {
        name: string;
        message: string;
        stack: string;
      };

      expect(result.message).toBe("Error at [PATH] line 10");
      expect(result.stack).toContain("[PATH]");
    });

    test("converts functions to string", () => {
      const fn = function myFunction() {
        return "test";
      };
      const result = sanitizeForLog(fn);
      expect(typeof result).toBe("string");
      expect(result).toContain("function");
    });

    test("converts symbols to string", () => {
      const sym = Symbol("test");
      const result = sanitizeForLog(sym);
      expect(typeof result).toBe("string");
      expect(result).toContain("Symbol");
    });
  });

  describe("complex scenarios", () => {
    test("sanitizes real-world log object", () => {
      const input = {
        timestamp: "2024-01-15T12:00:00Z",
        level: "error",
        message: "API request failed",
        error: {
          status: 401,
          message: "Invalid auth header: Bearer abc123",
        },
        context: {
          user: "john@example.com",
          apiKey: "secret123",
          url: "https://api.example.com",
        },
        env: {
          NODE_ENV: "production",
          OBSIDIAN_API_KEY: "super_secret",
        },
      };

      const result = sanitizeForLog(input);

      expect(result).toEqual({
        timestamp: "2024-01-15T12:00:00Z",
        level: "error",
        message: "API request failed",
        error: {
          status: 401,
          message: "Invalid auth header: Bearer [REDACTED]",
        },
        context: {
          user: "[EMAIL]",
          apiKey: "[REDACTED]",
          url: "https://api.example.com",
        },
        env: {
          NODE_ENV: "production",
          OBSIDIAN_API_KEY: "[REDACTED]",
        },
      });
    });

    test("sanitizes deeply nested structures", () => {
      const input = {
        level1: {
          level2: {
            level3: {
              password: "deep_secret",
              email: "test@example.com",
            },
          },
        },
      };

      const result = sanitizeForLog(input);

      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              password: "[REDACTED]",
              email: "[EMAIL]",
            },
          },
        },
      });
    });

    test("handles circular references gracefully", () => {
      const obj: Record<string, unknown> = { name: "test" };
      obj.self = obj; // Create circular reference

      // Should not throw, may convert to string or handle specially
      expect(() => sanitizeForLog(obj)).not.toThrow();
    });

    test("sanitizes array of objects with sensitive data", () => {
      const input = [
        { user: "alice@example.com", password: "pass1" },
        { user: "bob@example.com", token: "secret2" },
      ];

      const result = sanitizeForLog(input);

      expect(result).toEqual([
        { user: "[EMAIL]", password: "[REDACTED]" },
        { user: "[EMAIL]", token: "[REDACTED]" },
      ]);
    });
  });

  describe("edge cases", () => {
    test("handles empty string", () => {
      expect(sanitizeForLog("")).toBe("");
    });

    test("handles empty array", () => {
      expect(sanitizeForLog([])).toEqual([]);
    });

    test("handles empty object", () => {
      expect(sanitizeForLog({})).toEqual({});
    });

    test("handles object with null values", () => {
      const input = { key1: null, key2: undefined };
      const result = sanitizeForLog(input);
      expect(result).toEqual({ key1: null, key2: undefined });
    });

    test("handles very long strings efficiently", () => {
      const longString = "safe ".repeat(10000);
      const result = sanitizeForLog(longString);
      expect(result).toBe(longString);
    });

    test("handles special characters in strings", () => {
      const input = "Message with 特殊文字 and émojis 🔑";
      const result = sanitizeForLog(input);
      expect(result).toBe(input);
    });

    test("handles strings with newlines and tabs", () => {
      const input = "Line 1\nLine 2\tTabbed";
      const result = sanitizeForLog(input);
      expect(result).toBe(input);
    });
  });
});

describe("isSensitiveValue", () => {
  test("returns true for Bearer tokens", () => {
    expect(isSensitiveValue("auth", "Bearer abc123")).toBe(true);
  });

  test("returns true for API keys", () => {
    expect(isSensitiveValue("config", "api_key=secret")).toBe(true);
  });

  test("returns true for basic auth URLs", () => {
    expect(isSensitiveValue("url", "https://user:pass@example.com")).toBe(
      true,
    );
  });

  test("returns true for sensitive field names", () => {
    expect(isSensitiveValue("password", "any_value")).toBe(true);
    expect(isSensitiveValue("apiKey", "any_value")).toBe(true);
    expect(isSensitiveValue("secret", "any_value")).toBe(true);
  });

  test("returns false for safe values", () => {
    expect(isSensitiveValue("message", "This is safe")).toBe(false);
    expect(isSensitiveValue("count", "42")).toBe(false);
  });

  test("returns false for non-string values", () => {
    expect(isSensitiveValue("count", 42)).toBe(false);
    expect(isSensitiveValue("flag", true)).toBe(false);
    expect(isSensitiveValue("data", null)).toBe(false);
  });
});
