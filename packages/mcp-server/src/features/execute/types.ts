/**
 * Type definitions for the Tool-as-Code execution feature.
 *
 * These interfaces define the API surface exposed to sandboxed code.
 * LLMs write JavaScript that uses these APIs to interact with the vault.
 */

/**
 * File statistics returned by vault.stat()
 */
export interface FileStat {
  /** File creation time (Unix timestamp ms) */
  ctime: number;
  /** File modification time (Unix timestamp ms) */
  mtime: number;
  /** File size in bytes */
  size: number;
  /** File extension (e.g., ".md") */
  extension: string;
}

/**
 * Note JSON representation with parsed frontmatter
 */
export interface NoteJson {
  /** File path relative to vault root */
  path: string;
  /** Raw markdown content */
  content: string;
  /** Parsed frontmatter as key-value pairs */
  frontmatter?: Record<string, unknown>;
  /** Tags extracted from frontmatter and inline */
  tags?: string[];
}

/**
 * Search result from vault.search()
 */
export interface SearchResult {
  /** File path relative to vault root */
  path: string;
  /** File name without extension */
  filename: string;
  /** Matched content snippet (for text search) */
  snippet?: string;
  /** Match score (higher = more relevant) */
  score?: number;
}

/**
 * Options for vault.search()
 */
export interface SearchOptions {
  /** Search type: "text" (default), "glob", or "regex" */
  type?: "text" | "glob" | "regex";
  /** Maximum results to return */
  limit?: number;
  /** Search within specific directory */
  directory?: string;
}

/**
 * Options for vault.read()
 */
export interface ReadOptions {
  /** Response format: "markdown" (default) or "json" (includes frontmatter) */
  format?: "markdown" | "json";
}

/**
 * Result of bulk operations
 */
export interface BulkResult {
  /** Number of files processed */
  processed: number;
  /** Number of files that matched */
  matched: number;
  /** Number of files that failed */
  failed: number;
  /** List of processed file paths */
  files: string[];
  /** Error messages for failed files */
  errors?: Array<{ path: string; error: string }>;
}

/**
 * Options for bulk delete operations
 */
export interface BulkDeleteOptions {
  /** If true, only report what would be deleted without actually deleting */
  dryRun?: boolean;
}

/**
 * The Vault API exposed to sandboxed code.
 *
 * This is the primary interface for interacting with the Obsidian vault
 * from within Tool-as-Code execution.
 */
export interface VaultAPI {
  // Reading
  /** Read a file's content */
  read(path: string, options?: ReadOptions): Promise<string | NoteJson>;
  /** List files in a directory (or root if not specified) */
  list(directory?: string): Promise<string[]>;
  /** Check if a file exists */
  exists(path: string): Promise<boolean>;
  /** Get file statistics */
  stat(path: string): Promise<FileStat>;

  // Writing
  /** Create or overwrite a file */
  write(path: string, content: string): Promise<void>;
  /** Append content to a file */
  append(path: string, content: string): Promise<void>;

  // Organization
  /** Delete a file */
  delete(path: string): Promise<void>;
  /** Move a file to a new path */
  move(source: string, destination: string): Promise<void>;
  /** Rename a file (same directory, new name) */
  rename(path: string, newName: string): Promise<void>;

  // Search
  /** Search for files matching a query */
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;

  // Bulk operations
  /** Delete multiple files matching a pattern */
  bulkDelete(pattern: string, options?: BulkDeleteOptions): Promise<BulkResult>;

  // Metadata
  /** Get frontmatter of a file */
  getFrontmatter(path: string): Promise<Record<string, unknown>>;
  /** Set frontmatter of a file */
  setFrontmatter(path: string, data: Record<string, unknown>): Promise<void>;
  /** Get tags from a file */
  getTags(path: string): Promise<string[]>;
}

/**
 * Dataview plugin API (if available)
 */
export interface DataviewAPI {
  /** Execute a Dataview Query Language query */
  query(dql: string): Promise<unknown>;
  /** Execute Dataview JavaScript */
  js(code: string): Promise<unknown>;
}

/**
 * Templater plugin API (if available)
 */
export interface TemplaterAPI {
  /** Execute a Templater template */
  execute(
    template: string,
    params?: Record<string, unknown>,
  ): Promise<string>;
}

/**
 * Smart Connections plugin API (if available)
 */
export interface SmartConnectionsAPI {
  /** Semantic search for similar content */
  search(query: string, limit?: number): Promise<SearchResult[]>;
}

/**
 * Plugin APIs exposed to sandboxed code.
 *
 * These are optional and may not be available if the corresponding
 * Obsidian plugin is not installed.
 */
export interface PluginsAPI {
  dataview?: DataviewAPI;
  templater?: TemplaterAPI;
  smartConnections?: SmartConnectionsAPI;
}

/**
 * Console-like interface for capturing output from sandboxed code
 */
export interface SandboxConsole {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  info(...args: unknown[]): void;
}

/**
 * Result of sandbox execution
 */
export interface ExecutionResult {
  /** Return value from the code (if any) */
  result?: unknown;
  /** Console output captured during execution */
  logs: string[];
  /** Execution time in milliseconds */
  duration: number;
  /** Whether execution completed successfully */
  success: boolean;
  /** Error message if execution failed */
  error?: string;
}

/**
 * Options for sandbox execution
 */
export interface ExecutionOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Memory limit in MB (default: 128) */
  memoryLimit?: number;
}
