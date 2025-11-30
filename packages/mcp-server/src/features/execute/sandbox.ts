/**
 * Sandbox Execution using QuickJS WebAssembly
 *
 * Provides secure JavaScript execution with:
 * - Memory limits (configurable, default 128MB)
 * - Execution timeout (configurable, default 30s)
 * - No network access (fetch disabled)
 * - No filesystem access (fs disabled)
 * - Vault API injected via env object
 */

import { type SandboxOptions, loadQuickJs } from "@sebastianwessel/quickjs";
import variant from "@jitl/quickjs-ng-wasmfile-release-sync";
import { logger } from "$/shared";
import { createVaultProxy, createPluginsProxy } from "./api-proxy";
import type { ExecutionResult, ExecutionOptions, VaultAPI, PluginsAPI } from "./types";

// Lazy-loaded QuickJS instance (expensive to initialize)
let quickJsLoader: ReturnType<typeof loadQuickJs> | null = null;

/**
 * Initialize QuickJS WebAssembly runtime.
 * This is expensive and should be done once.
 */
async function getQuickJs() {
  if (!quickJsLoader) {
    logger.debug("Loading QuickJS WebAssembly runtime...");
    quickJsLoader = loadQuickJs(variant);
  }
  return quickJsLoader;
}

/**
 * Default execution options
 */
const DEFAULT_OPTIONS: Required<ExecutionOptions> = {
  timeout: 30_000, // 30 seconds
  memoryLimit: 128 * 1024 * 1024, // 128 MB
};

/**
 * Execute JavaScript code in a sandboxed environment.
 *
 * The sandbox provides:
 * - `vault` object with VaultAPI methods
 * - `plugins` object with optional plugin integrations
 * - `console.log/warn/error/info` for output capture
 * - No network access, no filesystem access
 *
 * @param code - JavaScript code to execute
 * @param options - Execution options (timeout, memory limit)
 * @returns Execution result with return value, logs, and timing
 */
export async function executeInSandbox(
  code: string,
  options?: ExecutionOptions,
): Promise<ExecutionResult> {
  const startTime = performance.now();
  const logs: string[] = [];

  const timeout = options?.timeout ?? DEFAULT_OPTIONS.timeout;
  const memoryLimit = options?.memoryLimit ?? DEFAULT_OPTIONS.memoryLimit;

  logger.debug("Executing code in sandbox", {
    codeLength: code.length,
    timeout,
    memoryLimit,
  });

  try {
    const { runSandboxed } = await getQuickJs();

    // Create API proxies that will be exposed to sandboxed code
    const vaultProxy = createVaultProxy();
    const pluginsProxy = createPluginsProxy();

    // Wrap vault methods to handle async properly
    // QuickJS sync variant needs promises to be awaited on host side
    const wrappedVault = wrapAsyncApi(vaultProxy);
    const wrappedPlugins = wrapAsyncApi(pluginsProxy);

    // Configure sandbox options
    const sandboxOptions: SandboxOptions = {
      executionTimeout: timeout,
      memoryLimit,

      // Security: disable network and filesystem
      allowFetch: false,
      allowFs: false,

      // Capture console output
      console: {
        log: (...args: unknown[]) => {
          const msg = args.map(formatArg).join(" ");
          logs.push(msg);
          logger.debug("[sandbox] log:", { msg });
        },
        warn: (...args: unknown[]) => {
          const msg = `[warn] ${args.map(formatArg).join(" ")}`;
          logs.push(msg);
          logger.debug("[sandbox] warn:", { msg });
        },
        error: (...args: unknown[]) => {
          const msg = `[error] ${args.map(formatArg).join(" ")}`;
          logs.push(msg);
          logger.debug("[sandbox] error:", { msg });
        },
        info: (...args: unknown[]) => {
          const msg = `[info] ${args.map(formatArg).join(" ")}`;
          logs.push(msg);
          logger.debug("[sandbox] info:", { msg });
        },
      },

      // Inject vault and plugins APIs via env
      env: {
        vault: wrappedVault,
        plugins: wrappedPlugins,
      },
    };

    // Wrap code in async IIFE to support top-level await
    // The code can return a value which becomes the result
    const wrappedCode = `
// Expose vault and plugins from env as globals
const vault = env.vault;
const plugins = env.plugins;

// Execute user code in async context
const __userCode = async () => {
${code}
};

export default await __userCode();
`;

    // Execute in sandbox
    const result = await runSandboxed(
      async ({ evalCode }) => evalCode(wrappedCode),
      sandboxOptions,
    );

    const duration = performance.now() - startTime;

    if (result.ok) {
      logger.debug("Sandbox execution successful", {
        duration,
        resultType: typeof result.data,
      });

      return {
        success: true,
        result: result.data,
        logs,
        duration,
      };
    } else {
      // Execution failed with an error
      const errorMessage = extractErrorMessage(result);
      logger.warn("Sandbox execution failed", {
        duration,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        logs,
        duration,
      };
    }
  } catch (err) {
    const duration = performance.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    logger.error("Sandbox execution threw exception", {
      duration,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
      logs,
      duration,
    };
  }
}

/**
 * Wrap an async API object so its methods can be called from QuickJS.
 *
 * QuickJS sync variant can't handle host promises directly, so we need
 * to wrap async methods in a way that works with the eval context.
 */
function wrapAsyncApi<T extends object>(api: T): T {
  const wrapped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(api)) {
    if (typeof value === "function") {
      // Wrap async functions
      wrapped[key] = value.bind(api);
    } else if (value && typeof value === "object") {
      // Recursively wrap nested objects
      wrapped[key] = wrapAsyncApi(value as object);
    } else {
      wrapped[key] = value;
    }
  }

  return wrapped as T;
}

/**
 * Format an argument for console output
 */
function formatArg(arg: unknown): string {
  if (arg === undefined) return "undefined";
  if (arg === null) return "null";
  if (typeof arg === "object") {
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

/**
 * Extract error message from QuickJS result
 */
function extractErrorMessage(result: { ok: false; error?: unknown }): string {
  if (!result.error) return "Unknown error";

  if (typeof result.error === "string") return result.error;

  if (result.error instanceof Error) return result.error.message;

  if (typeof result.error === "object" && result.error !== null) {
    const err = result.error as { message?: string; stack?: string };
    if (err.message) return err.message;
    if (err.stack) return err.stack;
  }

  return String(result.error);
}

/**
 * Generate API documentation for the sandbox environment.
 *
 * This is included in the tool description so LLMs know what's available.
 */
export const API_DOCUMENTATION = `
# Vault API

Execute JavaScript code with access to the Obsidian vault.

## Available APIs

### vault.read(path, options?)
Read a file's content. Returns string (markdown) or object (json format).
\`\`\`javascript
const content = await vault.read("notes/example.md");
const note = await vault.read("notes/example.md", { format: "json" });
\`\`\`

### vault.write(path, content)
Create or overwrite a file.
\`\`\`javascript
await vault.write("new-note.md", "# Hello World");
\`\`\`

### vault.append(path, content)
Append content to an existing file.
\`\`\`javascript
await vault.append("log.md", "\\n- New entry");
\`\`\`

### vault.delete(path)
Delete a file (respects mcp-protected tag).
\`\`\`javascript
await vault.delete("old-note.md");
\`\`\`

### vault.move(source, destination)
Move a file to a new path.
\`\`\`javascript
await vault.move("inbox/note.md", "processed/note.md");
\`\`\`

### vault.rename(path, newName)
Rename a file (same directory).
\`\`\`javascript
await vault.rename("note.md", "better-name.md");
\`\`\`

### vault.list(directory?)
List files in a directory (or root).
\`\`\`javascript
const files = await vault.list("projects");
\`\`\`

### vault.exists(path)
Check if a file exists.
\`\`\`javascript
if (await vault.exists("config.md")) { ... }
\`\`\`

### vault.search(query, options?)
Search for files. Options: type ("text", "glob", "regex"), limit, directory.
\`\`\`javascript
const results = await vault.search("meeting notes");
const mdFiles = await vault.search("**/*.md", { type: "glob" });
\`\`\`

### vault.bulkDelete(pattern, options?)
Delete multiple files matching a glob pattern. Use dryRun: true to preview.
\`\`\`javascript
const preview = await vault.bulkDelete("temp/**", { dryRun: true });
await vault.bulkDelete("temp/**", { dryRun: false });
\`\`\`

### vault.getFrontmatter(path)
Get parsed frontmatter from a file.
\`\`\`javascript
const fm = await vault.getFrontmatter("note.md");
console.log(fm.title, fm.tags);
\`\`\`

### vault.setFrontmatter(path, data)
Update frontmatter fields.
\`\`\`javascript
await vault.setFrontmatter("note.md", { status: "done" });
\`\`\`

### vault.getTags(path)
Get all tags from a file.
\`\`\`javascript
const tags = await vault.getTags("note.md");
\`\`\`

## Limitations

- No network access (fetch disabled)
- No filesystem access outside vault
- 30 second timeout (configurable)
- 128MB memory limit (configurable)
- Protected files (mcp-protected tag) cannot be deleted
- Read-only files (mcp-readonly tag) cannot be modified
- Hidden files (mcp-hidden tag) are not visible

## Example

\`\`\`javascript
// Find all meeting notes and create a summary
const meetings = await vault.search("daily/2024-*", { type: "glob" });
const contents = await Promise.all(
  meetings.slice(0, 10).map(f => vault.read(f.path))
);
const summary = contents.join("\\n---\\n");
await vault.write("summaries/recent.md", "# Recent Notes\\n\\n" + summary);
return { processed: meetings.length };
\`\`\`
`;
