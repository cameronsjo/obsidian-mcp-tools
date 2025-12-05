import { describe, expect, test } from "bun:test";
import { validateUrl } from "./validateUrl";

describe("validateUrl", () => {
  describe("protocol validation", () => {
    test("allows https URLs", () => {
      const result = validateUrl("https://example.com/path");
      expect(result.valid).toBe(true);
      expect(result.url?.hostname).toBe("example.com");
    });

    test("allows http URLs", () => {
      const result = validateUrl("http://example.com/path");
      expect(result.valid).toBe(true);
    });

    test("rejects file:// protocol", () => {
      const result = validateUrl("file:///etc/passwd");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Protocol");
    });

    test("rejects ftp:// protocol", () => {
      const result = validateUrl("ftp://example.com/file");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Protocol");
    });

    test("rejects javascript: protocol", () => {
      const result = validateUrl("javascript:alert(1)");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Protocol");
    });

    test("rejects data: protocol", () => {
      const result = validateUrl("data:text/html,<script>alert(1)</script>");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Protocol");
    });
  });

  describe("localhost blocking", () => {
    test("blocks localhost by default", () => {
      const result = validateUrl("http://localhost/admin");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("localhost");
    });

    test("blocks localhost with port", () => {
      const result = validateUrl("http://localhost:8080/admin");
      expect(result.valid).toBe(false);
    });

    test("blocks localhost.localdomain", () => {
      const result = validateUrl("http://localhost.localdomain/admin");
      expect(result.valid).toBe(false);
    });

    test("allows localhost when explicitly permitted", () => {
      const result = validateUrl("http://localhost/api", {
        allowLocalhost: true,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("private IP blocking", () => {
    test("blocks 127.0.0.1 (loopback)", () => {
      const result = validateUrl("http://127.0.0.1/");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Private IP");
    });

    test("blocks 127.x.x.x range", () => {
      const result = validateUrl("http://127.255.255.255/");
      expect(result.valid).toBe(false);
    });

    test("blocks 10.x.x.x (private class A)", () => {
      const result = validateUrl("http://10.0.0.1/internal");
      expect(result.valid).toBe(false);
    });

    test("blocks 172.16.x.x - 172.31.x.x (private class B)", () => {
      expect(validateUrl("http://172.16.0.1/").valid).toBe(false);
      expect(validateUrl("http://172.20.10.5/").valid).toBe(false);
      expect(validateUrl("http://172.31.255.255/").valid).toBe(false);
    });

    test("allows 172.15.x.x and 172.32.x.x (not private)", () => {
      // These are public IPs
      expect(validateUrl("http://172.15.0.1/").valid).toBe(true);
      expect(validateUrl("http://172.32.0.1/").valid).toBe(true);
    });

    test("blocks 192.168.x.x (private class C)", () => {
      const result = validateUrl("http://192.168.1.1/router");
      expect(result.valid).toBe(false);
    });

    test("blocks 169.254.x.x (link-local)", () => {
      const result = validateUrl("http://169.254.169.254/latest/meta-data/");
      expect(result.valid).toBe(false);
    });

    test("blocks 0.0.0.0", () => {
      const result = validateUrl("http://0.0.0.0/");
      expect(result.valid).toBe(false);
    });

    test("allows private IPs when explicitly permitted", () => {
      const result = validateUrl("http://192.168.1.1/api", {
        allowPrivateIPs: true,
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("IPv6 blocking", () => {
    test("blocks ::1 (IPv6 loopback)", () => {
      const result = validateUrl("http://[::1]/");
      expect(result.valid).toBe(false);
    });
  });

  describe("cloud metadata endpoints", () => {
    test("blocks AWS/GCP metadata endpoint (169.254.169.254)", () => {
      const result = validateUrl("http://169.254.169.254/latest/meta-data/");
      expect(result.valid).toBe(false);
    });

    test("blocks Google Cloud metadata hostname", () => {
      const result = validateUrl("http://metadata.google.internal/");
      expect(result.valid).toBe(false);
    });
  });

  describe("domain allowlist", () => {
    test("allows domains in allowlist", () => {
      const result = validateUrl("https://api.example.com/data", {
        allowedDomains: ["example.com", "api.example.com"],
      });
      expect(result.valid).toBe(true);
    });

    test("blocks domains not in allowlist", () => {
      const result = validateUrl("https://evil.com/data", {
        allowedDomains: ["example.com"],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("allowlist");
    });

    test("supports wildcard domains in allowlist", () => {
      const result = validateUrl("https://sub.example.com/data", {
        allowedDomains: ["*.example.com"],
      });
      expect(result.valid).toBe(true);
    });

    test("wildcard matches exact domain too", () => {
      const result = validateUrl("https://example.com/data", {
        allowedDomains: ["*.example.com"],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("domain blocklist", () => {
    test("blocks domains in blocklist", () => {
      const result = validateUrl("https://evil.com/data", {
        blockedDomains: ["evil.com"],
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("blocked");
    });

    test("supports wildcard in blocklist", () => {
      const result = validateUrl("https://sub.evil.com/data", {
        blockedDomains: ["*.evil.com"],
      });
      expect(result.valid).toBe(false);
    });

    test("blocklist takes precedence over allowlist", () => {
      const result = validateUrl("https://blocked.example.com/data", {
        allowedDomains: ["*.example.com"],
        blockedDomains: ["blocked.example.com"],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("URL length limits", () => {
    test("accepts URLs within length limit", () => {
      const result = validateUrl("https://example.com/short", {
        maxUrlLength: 100,
      });
      expect(result.valid).toBe(true);
    });

    test("rejects URLs exceeding length limit", () => {
      const longPath = "a".repeat(3000);
      const result = validateUrl(`https://example.com/${longPath}`, {
        maxUrlLength: 2048,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("length");
    });
  });

  describe("URL parsing", () => {
    test("rejects invalid URLs", () => {
      const result = validateUrl("not-a-valid-url");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid URL");
    });

    test("rejects empty string", () => {
      const result = validateUrl("");
      expect(result.valid).toBe(false);
    });

    test("handles URLs with ports", () => {
      const result = validateUrl("https://example.com:8443/api");
      expect(result.valid).toBe(true);
      expect(result.url?.port).toBe("8443");
    });

    test("handles URLs with query strings", () => {
      const result = validateUrl("https://example.com/search?q=test&page=1");
      expect(result.valid).toBe(true);
      expect(result.url?.search).toBe("?q=test&page=1");
    });

    test("handles URLs with fragments", () => {
      const result = validateUrl("https://example.com/page#section");
      expect(result.valid).toBe(true);
    });
  });

  describe("internal hostname blocking", () => {
    test("blocks kubernetes.default", () => {
      const result = validateUrl("http://kubernetes.default/api");
      expect(result.valid).toBe(false);
    });

    test("blocks kubernetes.default.svc", () => {
      const result = validateUrl("http://kubernetes.default.svc/api");
      expect(result.valid).toBe(false);
    });

    test("blocks subdomains of blocked hostnames", () => {
      const result = validateUrl("http://api.localhost/data");
      expect(result.valid).toBe(false);
    });
  });
});
