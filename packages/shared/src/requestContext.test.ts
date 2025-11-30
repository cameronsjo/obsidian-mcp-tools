import { describe, test, expect } from "bun:test";
import {
  runWithContext,
  getContext,
  updateContext,
  getContextDuration,
  type RequestContext,
} from "./requestContext";

describe("requestContext", () => {
  test("should generate unique request IDs", () => {
    let id1: string | undefined;
    let id2: string | undefined;

    runWithContext({}, () => {
      id1 = getContext()?.requestId;
    });

    runWithContext({}, () => {
      id2 = getContext()?.requestId;
    });

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
  });

  test("should provide context within runWithContext", () => {
    runWithContext({ toolName: "test-tool" }, () => {
      const context = getContext();
      expect(context).toBeDefined();
      expect(context?.toolName).toBe("test-tool");
      expect(context?.requestId).toBeDefined();
      expect(context?.startTime).toBeDefined();
    });
  });

  test("should not have context outside runWithContext", () => {
    const context = getContext();
    expect(context).toBeUndefined();
  });

  test("should propagate context through async operations", async () => {
    await runWithContext({ toolName: "async-tool" }, async () => {
      const context1 = getContext();
      expect(context1?.toolName).toBe("async-tool");

      await new Promise((resolve) => setTimeout(resolve, 10));

      const context2 = getContext();
      expect(context2?.toolName).toBe("async-tool");
      expect(context2?.requestId).toBe(context1?.requestId);
    });
  });

  test("should allow updating context", () => {
    runWithContext({ toolName: "initial" }, () => {
      const initial = getContext();
      expect(initial?.toolName).toBe("initial");

      updateContext({ toolName: "updated", metadata: { key: "value" } });

      const updated = getContext();
      expect(updated?.toolName).toBe("updated");
      expect(updated?.metadata?.key).toBe("value");
    });
  });

  test("should calculate duration", async () => {
    await runWithContext({}, async () => {
      const initial = getContextDuration();
      expect(initial).toBeDefined();
      expect(initial).toBeGreaterThanOrEqual(0);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const after = getContextDuration();
      expect(after).toBeDefined();
      expect(after!).toBeGreaterThanOrEqual(50);
    });
  });

  test("should merge metadata on update", () => {
    runWithContext({ metadata: { key1: "value1" } }, () => {
      updateContext({ metadata: { key2: "value2" } });

      const context = getContext();
      expect(context?.metadata?.key1).toBe("value1");
      expect(context?.metadata?.key2).toBe("value2");
    });
  });

  test("should isolate contexts in nested operations", async () => {
    await runWithContext({ toolName: "outer" }, async () => {
      const outerContext = getContext();
      expect(outerContext?.toolName).toBe("outer");

      const innerResult = await new Promise<string>((resolve) => {
        runWithContext({ toolName: "inner" }, () => {
          const innerContext = getContext();
          expect(innerContext?.toolName).toBe("inner");
          expect(innerContext?.requestId).not.toBe(outerContext?.requestId);
          resolve(innerContext!.requestId);
        });
      });

      // After inner context completes, we're back in outer context
      const stillOuter = getContext();
      expect(stillOuter?.toolName).toBe("outer");
      expect(stillOuter?.requestId).toBe(outerContext?.requestId);
      expect(stillOuter?.requestId).not.toBe(innerResult);
    });
  });

  test("should accept custom request ID", () => {
    const customId = "custom-request-id-12345";

    runWithContext({ requestId: customId }, () => {
      const context = getContext();
      expect(context?.requestId).toBe(customId);
    });
  });

  test("should accept custom start time", () => {
    const customStart = Date.now() - 1000;

    runWithContext({ startTime: customStart }, () => {
      const context = getContext();
      expect(context?.startTime).toBe(customStart);

      const duration = getContextDuration();
      expect(duration).toBeGreaterThanOrEqual(1000);
    });
  });
});
