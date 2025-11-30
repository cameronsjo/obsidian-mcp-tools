/**
 * Unit tests for OperationRegistry
 *
 * Addresses PR-1#4: Core dispatch logic was untested
 */

import { describe, expect, it } from "bun:test";
import { OperationRegistry, type OperationResult } from "./types";

describe("OperationRegistry", () => {
  describe("register()", () => {
    it("should register an operation", () => {
      const registry = new OperationRegistry();
      registry.register({
        name: "test",
        description: "Test operation",
        parameters: {},
        handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
      });

      expect(registry.list()).toContain("test");
    });

    it("should return this for chaining", () => {
      const registry = new OperationRegistry();
      const result = registry.register({
        name: "test",
        description: "Test",
        parameters: {},
        handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
      });

      expect(result).toBe(registry);
    });

    it("should allow registering multiple operations", () => {
      const registry = new OperationRegistry();
      registry
        .register({
          name: "op1",
          description: "First",
          parameters: {},
          handler: async () => ({ content: [{ type: "text", text: "1" }] }),
        })
        .register({
          name: "op2",
          description: "Second",
          parameters: {},
          handler: async () => ({ content: [{ type: "text", text: "2" }] }),
        });

      expect(registry.list()).toEqual(["op1", "op2"]);
    });

    it("should overwrite operation with same name", () => {
      const registry = new OperationRegistry();
      registry.register({
        name: "test",
        description: "Original",
        parameters: {},
        handler: async () => ({ content: [{ type: "text", text: "original" }] }),
      });
      registry.register({
        name: "test",
        description: "Replacement",
        parameters: {},
        handler: async () => ({ content: [{ type: "text", text: "replaced" }] }),
      });

      const op = registry.get("test");
      expect(op?.description).toBe("Replacement");
    });
  });

  describe("get()", () => {
    it("should return registered operation", () => {
      const registry = new OperationRegistry();
      const operation = {
        name: "test",
        description: "Test operation",
        parameters: { foo: { type: "string", required: true } },
        handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
      };
      registry.register(operation);

      const result = registry.get("test");
      expect(result).toBeDefined();
      expect(result?.name).toBe("test");
      expect(result?.description).toBe("Test operation");
      expect(result?.parameters).toEqual({ foo: { type: "string", required: true } });
    });

    it("should return undefined for non-existent operation", () => {
      const registry = new OperationRegistry();
      expect(registry.get("nonexistent")).toBeUndefined();
    });
  });

  describe("list()", () => {
    it("should return empty array when no operations registered", () => {
      const registry = new OperationRegistry();
      expect(registry.list()).toEqual([]);
    });

    it("should return all registered operation names", () => {
      const registry = new OperationRegistry();
      registry.register({
        name: "alpha",
        description: "A",
        parameters: {},
        handler: async () => ({ content: [{ type: "text", text: "a" }] }),
      });
      registry.register({
        name: "beta",
        description: "B",
        parameters: {},
        handler: async () => ({ content: [{ type: "text", text: "b" }] }),
      });

      expect(registry.list()).toEqual(["alpha", "beta"]);
    });
  });

  describe("getCapabilities()", () => {
    it("should return empty object when no operations", () => {
      const registry = new OperationRegistry();
      expect(registry.getCapabilities()).toEqual({});
    });

    it("should return capabilities without handler", () => {
      const registry = new OperationRegistry();
      registry.register({
        name: "test",
        description: "Test operation",
        parameters: { input: { type: "string", description: "Input value" } },
        handler: async () => ({ content: [{ type: "text", text: "ok" }] }),
      });

      const capabilities = registry.getCapabilities();

      expect(capabilities).toEqual({
        test: {
          name: "test",
          description: "Test operation",
          parameters: { input: { type: "string", description: "Input value" } },
        },
      });
      // Verify handler is not included
      expect("handler" in (capabilities.test as object)).toBe(false);
    });
  });

  describe("dispatch()", () => {
    it("should call handler with params and return result", async () => {
      const registry = new OperationRegistry();
      registry.register({
        name: "echo",
        description: "Echo input",
        parameters: { message: { type: "string" } },
        handler: async (params) => ({
          content: [{ type: "text", text: `Echo: ${params.message}` }],
        }),
      });

      const result = await registry.dispatch("echo", { message: "hello" });

      expect(result.content[0]).toEqual({ type: "text", text: "Echo: hello" });
      expect(result.isError).toBeUndefined();
    });

    it("should return error for unknown operation", async () => {
      const registry = new OperationRegistry();

      const result = await registry.dispatch("nonexistent", {});

      expect(result.isError).toBe(true);
      expect(result.content[0].type).toBe("text");
      expect((result.content[0] as { type: "text"; text: string }).text).toContain(
        "Unknown operation: nonexistent"
      );
    });

    it("should list available operations in error message", async () => {
      const registry = new OperationRegistry();
      registry.register({
        name: "op1",
        description: "First",
        parameters: {},
        handler: async () => ({ content: [{ type: "text", text: "1" }] }),
      });
      registry.register({
        name: "op2",
        description: "Second",
        parameters: {},
        handler: async () => ({ content: [{ type: "text", text: "2" }] }),
      });

      const result = await registry.dispatch("unknown", {});

      const text = (result.content[0] as { type: "text"; text: string }).text;
      expect(text).toContain("op1");
      expect(text).toContain("op2");
    });

    it("should propagate errors from handler", async () => {
      const registry = new OperationRegistry();
      registry.register({
        name: "fail",
        description: "Always fails",
        parameters: {},
        handler: async () => {
          throw new Error("Handler failed");
        },
      });

      await expect(registry.dispatch("fail", {})).rejects.toThrow("Handler failed");
    });

    it("should pass empty params to handler", async () => {
      const registry = new OperationRegistry();
      let receivedParams: Record<string, unknown> | undefined;
      registry.register({
        name: "capture",
        description: "Captures params",
        parameters: {},
        handler: async (params) => {
          receivedParams = params;
          return { content: [{ type: "text", text: "ok" }] };
        },
      });

      await registry.dispatch("capture", {});

      expect(receivedParams).toEqual({});
    });
  });
});
