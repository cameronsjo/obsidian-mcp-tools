import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

/**
 * Context information for a request/operation.
 * Provides structured metadata that flows through all async operations.
 */
export interface RequestContext {
  /** Unique identifier for this request/operation */
  requestId: string;
  /** Name of the tool being executed */
  toolName?: string;
  /** Start time of the operation in milliseconds */
  startTime: number;
  /** Additional custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * AsyncLocalStorage for request context propagation.
 * This enables context to flow through async operations without explicit passing.
 */
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Generates a unique request ID.
 * Uses cryptographically secure random bytes for uniqueness.
 * @returns A hex-encoded request ID
 */
function generateRequestId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Runs a function with a new request context.
 * All async operations within the callback will have access to this context.
 * @param context - Partial context to initialize (requestId will be auto-generated if not provided)
 * @param callback - Function to execute with the context
 * @returns The result of the callback
 */
export function runWithContext<T>(
  context: Partial<RequestContext>,
  callback: () => T,
): T {
  const fullContext: RequestContext = {
    requestId: context.requestId ?? generateRequestId(),
    startTime: context.startTime ?? Date.now(),
    toolName: context.toolName,
    metadata: context.metadata,
  };

  return asyncLocalStorage.run(fullContext, callback);
}

/**
 * Gets the current request context.
 * @returns The current context, or undefined if not in a context
 */
export function getContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Updates the current request context with additional data.
 * This merges new data into the existing context.
 * @param updates - Partial context updates to apply
 */
export function updateContext(updates: Partial<RequestContext>): void {
  const current = asyncLocalStorage.getStore();
  if (!current) {
    return;
  }

  // Merge updates into current context
  Object.assign(current, {
    ...updates,
    metadata: { ...current.metadata, ...updates.metadata },
  });
}

/**
 * Gets the duration in milliseconds since the context started.
 * @returns Duration in ms, or undefined if not in a context
 */
export function getContextDuration(): number | undefined {
  const context = getContext();
  if (!context) {
    return undefined;
  }
  return Date.now() - context.startTime;
}
