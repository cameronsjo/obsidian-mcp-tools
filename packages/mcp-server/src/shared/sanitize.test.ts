import { describe, expect, test } from "bun:test";
import { getSafeEnvForLogging, sanitizeForLogging } from "./sanitize";

describe("sanitizeForLogging", () => {
  describe("sensitive key detection", () => {
    test("redacts api_key fields", () => {
      const input = { api_key: "secret123", name: "test" };
      const result = sanitizeForLogging(input) as Record<string, unknown>;
      expect(result.api_key).toBe("[REDACTED]");
      expect(result.name).toBe("test");
    });

    test("redacts apiKey fields (camelCase)", () => {
      const input = { apiKey: "secret123" };
      const result = sanitizeForLogging(input) as Record<string, unknown>;
      expect(result.apiKey).toBe("[REDACTED]");
    });

    test("redacts password fields", () => {
      const input = { password: "hunter2", username: "admin" };
      const result = sanitizeForLogging(input) as Record<string, unknown>;
      expect(result.password).toBe("[REDACTED]");
      expect(result.username).toBe("admin");
    });

    test("redacts secret fields", () => {
      const input = { client_secret: "abc123" };
      const result = sanitizeForLogging(input) as Record<string, unknown>;
      expect(result.client_secret).toBe("[REDACTED]");
    });

    test("redacts authorization headers", () => {
      const input = { headers: { Authorization: "Bearer xyz" } };
      const result = sanitizeForLogging(input) as {
        headers: Record<string, unknown>;
      };
      expect(result.headers.Authorization).toBe("[REDACTED]");
    });

    test("redacts token fields", () => {
      const input = { access_token: "tok_123", refresh_token: "ref_456" };
      const result = sanitizeForLogging(input) as Record<string, unknown>;
      expect(result.access_token).toBe("[REDACTED]");
      expect(result.refresh_token).toBe("[REDACTED]");
    });

    test("redacts jwt fields", () => {
      const input = { jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." };
      const result = sanitizeForLogging(input) as Record<string, unknown>;
      expect(result.jwt).toBe("[REDACTED]");
    });
  });

  describe("sensitive value patterns", () => {
    test("redacts Bearer tokens in strings", () => {
      const input =
        "Request failed with Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature";
      const result = sanitizeForLogging(input) as string;
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    });

    test("redacts AWS-style keys", () => {
      const input = "AWS key: AKIAIOSFODNN7EXAMPLE";
      const result = sanitizeForLogging(input) as string;
      expect(result).toContain("[REDACTED]");
      expect(result).not.toContain("AKIAIOSFODNN7EXAMPLE");
    });

    test("redacts sk_ prefixed keys", () => {
      // Use a clearly fake key pattern that still matches the redaction regex
      const input = "Stripe key: sk_test_FAKEKEYFORTESTINGONLY1234";
      const result = sanitizeForLogging(input) as string;
      expect(result).toContain("[REDACTED]");
    });
  });

  describe("nested object handling", () => {
    test("sanitizes nested objects", () => {
      const input = {
        user: {
          name: "test",
          auth: {
            password: "secret",
          },
        },
      };
      const result = sanitizeForLogging(input) as {
        user: { auth: Record<string, unknown> };
      };
      expect(result.user.auth.password).toBe("[REDACTED]");
    });

    test("redacts entire credentials object", () => {
      // Keys containing 'credential' should be fully redacted
      const input = { credentials: { username: "admin" } };
      const result = sanitizeForLogging(input) as Record<string, unknown>;
      expect(result.credentials).toBe("[REDACTED]");
    });

    test("handles deeply nested structures", () => {
      const input = {
        level1: {
          level2: {
            level3: {
              api_key: "secret",
            },
          },
        },
      };
      const result = sanitizeForLogging(input) as {
        level1: { level2: { level3: Record<string, unknown> } };
      };
      expect(result.level1.level2.level3.api_key).toBe("[REDACTED]");
    });

    test("prevents infinite recursion", () => {
      // Create an object that would recurse deeply
      let obj: Record<string, unknown> = {};
      let current = obj;
      for (let i = 0; i < 15; i++) {
        current.nested = {};
        current = current.nested as Record<string, unknown>;
      }
      current.api_key = "secret";

      // Should not throw and should handle max depth
      const result = sanitizeForLogging(obj);
      expect(result).toBeDefined();
    });
  });

  describe("array handling", () => {
    test("sanitizes arrays", () => {
      const input = [{ api_key: "secret1" }, { api_key: "secret2" }];
      const result = sanitizeForLogging(input) as Record<string, unknown>[];
      expect(result[0].api_key).toBe("[REDACTED]");
      expect(result[1].api_key).toBe("[REDACTED]");
    });

    test("sanitizes mixed arrays", () => {
      const input = ["Bearer token123", { password: "secret" }];
      const result = sanitizeForLogging(input) as unknown[];
      expect(result[0]).toContain("[REDACTED]");
      expect((result[1] as Record<string, unknown>).password).toBe(
        "[REDACTED]",
      );
    });
  });

  describe("Error object handling", () => {
    test("sanitizes Error objects", () => {
      const error = new Error(
        "Failed with token: Bearer eyJhbGciOiJIUzI1NiJ9",
      );
      const result = sanitizeForLogging(error) as {
        message: string;
        name: string;
      };
      expect(result.name).toBe("Error");
      expect(result.message).toContain("[REDACTED]");
      expect(result.message).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    });
  });

  describe("primitive handling", () => {
    test("passes through null", () => {
      expect(sanitizeForLogging(null)).toBeNull();
    });

    test("passes through undefined", () => {
      expect(sanitizeForLogging(undefined)).toBeUndefined();
    });

    test("passes through numbers", () => {
      expect(sanitizeForLogging(42)).toBe(42);
    });

    test("passes through booleans", () => {
      expect(sanitizeForLogging(true)).toBe(true);
    });
  });
});

describe("getSafeEnvForLogging", () => {
  test("includes safe environment variables", () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      LOG_LEVEL: "debug",
    };

    const result = getSafeEnvForLogging();
    expect(result.NODE_ENV).toBe("test");
    expect(result.LOG_LEVEL).toBe("debug");

    process.env = originalEnv;
  });

  test("excludes sensitive environment variables", () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      OBSIDIAN_API_KEY: "secret_key",
      DATABASE_PASSWORD: "db_pass",
    };

    const result = getSafeEnvForLogging();
    expect(result).not.toHaveProperty("OBSIDIAN_API_KEY");
    expect(result).not.toHaveProperty("DATABASE_PASSWORD");

    process.env = originalEnv;
  });
});
