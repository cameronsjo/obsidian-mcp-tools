/**
 * Tests for sandbox execution
 *
 * Note: These tests use isolated mocking to avoid polluting other test files.
 */

import { describe, expect, it, beforeEach, mock, spyOn } from "bun:test";

// We need to test the sandbox in isolation without making real API calls
// The approach is to test the sandbox's code execution capabilities only

describe("executeInSandbox", () => {
  // Import dynamically to allow mocking
  let executeInSandbox: typeof import("./sandbox").executeInSandbox;

  beforeEach(async () => {
    // Fresh import for each test
    const sandbox = await import("./sandbox");
    executeInSandbox = sandbox.executeInSandbox;
  });

  it("executes simple code and returns result", async () => {
    const result = await executeInSandbox("return 1 + 2");

    expect(result.success).toBe(true);
    expect(result.result).toBe(3);
    expect(result.duration).toBeGreaterThan(0);
  });

  it("captures console output", async () => {
    const result = await executeInSandbox(`
      console.log("hello");
      console.warn("warning");
      console.error("error");
      return "done";
    `);

    expect(result.success).toBe(true);
    expect(result.logs).toContain("hello");
    expect(result.logs.some((l) => l.includes("warn"))).toBe(true);
    expect(result.logs.some((l) => l.includes("error"))).toBe(true);
  });

  it("handles async code", async () => {
    const result = await executeInSandbox(`
      const delay = (ms) => new Promise(r => setTimeout(r, ms));
      await delay(10);
      return "async done";
    `);

    expect(result.success).toBe(true);
    expect(result.result).toBe("async done");
  });

  it("handles errors gracefully", async () => {
    const result = await executeInSandbox(`
      throw new Error("test error");
    `);

    expect(result.success).toBe(false);
    expect(result.error).toContain("test error");
  });

  it("respects timeout", async () => {
    const result = await executeInSandbox(
      `
      while (true) {} // infinite loop
    `,
      { timeout: 100 },
    );

    expect(result.success).toBe(false);
    // Should fail due to timeout
    expect(result.duration).toBeLessThan(5000);
  });

  it("returns objects as JSON", async () => {
    const result = await executeInSandbox(`
      return { foo: "bar", count: 42 };
    `);

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ foo: "bar", count: 42 });
  });

  it("has vault API available", async () => {
    const result = await executeInSandbox(`
      return typeof vault;
    `);

    expect(result.success).toBe(true);
    expect(result.result).toBe("object");
  });

  it("has plugins API available", async () => {
    const result = await executeInSandbox(`
      return typeof plugins;
    `);

    expect(result.success).toBe(true);
    expect(result.result).toBe("object");
  });
});
