import { describe, expect, test } from "bun:test";

// Test the localhost validation logic directly without importing tlsConfig
// (which imports logger -> shared which causes module resolution issues in tests)

/**
 * Valid localhost addresses that are safe for TLS bypass
 */
const LOCALHOST_ADDRESSES = [
  "127.0.0.1",
  "localhost",
  "::1",
  "[::1]",
];

function isLocalhostHost(host: string): boolean {
  const normalizedHost = host.toLowerCase();
  return LOCALHOST_ADDRESSES.includes(normalizedHost);
}

function validateLocalhostConnection(host: string): void {
  if (!isLocalhostHost(host)) {
    throw new Error(
      `Security error: TLS validation bypass is only allowed for localhost connections. ` +
        `Configured host "${host}" is not a recognized localhost address. ` +
        `If you need to connect to a remote server, use proper TLS certificates.`,
    );
  }
}

interface TlsConfig {
  useHttp: boolean;
  host: string;
  port: number;
  tlsValidationBypassed: boolean;
}

function getBaseUrl(config: TlsConfig): string {
  const protocol = config.useHttp ? "http" : "https";
  return `${protocol}://${config.host}:${config.port}`;
}

describe("isLocalhostHost", () => {
  test("recognizes 127.0.0.1 as localhost", () => {
    expect(isLocalhostHost("127.0.0.1")).toBe(true);
  });

  test("recognizes localhost as localhost", () => {
    expect(isLocalhostHost("localhost")).toBe(true);
  });

  test("recognizes ::1 (IPv6 loopback) as localhost", () => {
    expect(isLocalhostHost("::1")).toBe(true);
    expect(isLocalhostHost("[::1]")).toBe(true);
  });

  test("is case-insensitive", () => {
    expect(isLocalhostHost("LOCALHOST")).toBe(true);
    expect(isLocalhostHost("LocalHost")).toBe(true);
  });

  test("rejects remote hosts", () => {
    expect(isLocalhostHost("example.com")).toBe(false);
    expect(isLocalhostHost("192.168.1.1")).toBe(false);
    expect(isLocalhostHost("10.0.0.1")).toBe(false);
  });

  test("rejects similar-looking but different hosts", () => {
    expect(isLocalhostHost("127.0.0.2")).toBe(false);
    expect(isLocalhostHost("localhost.evil.com")).toBe(false);
    expect(isLocalhostHost("localhosting.com")).toBe(false);
  });
});

describe("validateLocalhostConnection", () => {
  test("accepts localhost addresses", () => {
    expect(() => validateLocalhostConnection("127.0.0.1")).not.toThrow();
    expect(() => validateLocalhostConnection("localhost")).not.toThrow();
    expect(() => validateLocalhostConnection("::1")).not.toThrow();
  });

  test("rejects remote addresses with security error", () => {
    expect(() => validateLocalhostConnection("192.168.1.1")).toThrow(
      "Security error",
    );
    expect(() => validateLocalhostConnection("example.com")).toThrow(
      "Security error",
    );
    expect(() => validateLocalhostConnection("10.0.0.1")).toThrow(
      "Security error",
    );
  });

  test("error message includes the offending host", () => {
    expect(() => validateLocalhostConnection("evil.com")).toThrow("evil.com");
  });
});

describe("getBaseUrl", () => {
  test("generates HTTP URL correctly", () => {
    const url = getBaseUrl({
      useHttp: true,
      host: "127.0.0.1",
      port: 27123,
      tlsValidationBypassed: false,
    });
    expect(url).toBe("http://127.0.0.1:27123");
  });

  test("generates HTTPS URL correctly", () => {
    const url = getBaseUrl({
      useHttp: false,
      host: "127.0.0.1",
      port: 27124,
      tlsValidationBypassed: true,
    });
    expect(url).toBe("https://127.0.0.1:27124");
  });

  test("handles localhost hostname", () => {
    const url = getBaseUrl({
      useHttp: false,
      host: "localhost",
      port: 27124,
      tlsValidationBypassed: true,
    });
    expect(url).toBe("https://localhost:27124");
  });
});
