import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

/**
 * MCP Authorization Scopes
 *
 * OAuth-style permission scopes to control what operations MCP clients can perform.
 *
 * Hierarchy:
 *   admin:* (grants all)
 *   ├── vault:* (all vault operations)
 *   │   ├── vault:read
 *   │   ├── vault:write
 *   │   ├── vault:delete
 *   │   ├── vault:move
 *   │   ├── vault:search
 *   │   └── vault:list
 *   └── plugins:* (all plugin operations)
 *       ├── plugins:read
 *       └── plugins:execute
 */

export const SCOPES = {
  // Vault operations
  VAULT_READ: "vault:read",
  VAULT_WRITE: "vault:write",
  VAULT_DELETE: "vault:delete",
  VAULT_MOVE: "vault:move",
  VAULT_SEARCH: "vault:search",
  VAULT_LIST: "vault:list",

  // Plugin operations
  PLUGINS_READ: "plugins:read",
  PLUGINS_EXECUTE: "plugins:execute",

  // Wildcards
  VAULT_ALL: "vault:*",
  PLUGINS_ALL: "plugins:*",
  ADMIN: "admin:*",
} as const;

export type Scope = (typeof SCOPES)[keyof typeof SCOPES];

/**
 * Preset scope bundles for common use cases
 */
export const PRESETS: Record<string, Scope[]> = {
  // Read-only access - browse and search vault
  readonly: [
    SCOPES.VAULT_READ,
    SCOPES.VAULT_LIST,
    SCOPES.VAULT_SEARCH,
    SCOPES.PLUGINS_READ,
  ],

  // Editor access - read and write, but no delete/move
  editor: [
    SCOPES.VAULT_READ,
    SCOPES.VAULT_WRITE,
    SCOPES.VAULT_LIST,
    SCOPES.VAULT_SEARCH,
    SCOPES.PLUGINS_READ,
    SCOPES.PLUGINS_EXECUTE,
  ],

  // Full access - all operations except admin
  full: [
    SCOPES.VAULT_ALL,
    SCOPES.PLUGINS_ALL,
  ],

  // Admin access - everything
  admin: [SCOPES.ADMIN],
};

/**
 * Parse scopes from environment variable or preset name
 *
 * Accepts:
 * - Preset name: "readonly", "editor", "full", "admin"
 * - Comma-separated scopes: "vault:read,vault:list,vault:search"
 * - Wildcard scopes: "vault:*,plugins:read"
 */
export function parseScopes(scopeString: string | undefined): Scope[] {
  if (!scopeString || scopeString.trim() === "") {
    // Default to admin for backward compatibility
    return [SCOPES.ADMIN];
  }

  const trimmed = scopeString.trim().toLowerCase();

  // Check if it's a preset name
  if (trimmed in PRESETS) {
    return PRESETS[trimmed];
  }

  // Parse comma-separated scopes
  const scopes = trimmed.split(",").map((s) => s.trim()) as Scope[];

  // Validate each scope
  const validScopes = Object.values(SCOPES);
  for (const scope of scopes) {
    if (!validScopes.includes(scope)) {
      throw new Error(
        `Invalid scope: "${scope}". Valid scopes: ${validScopes.join(", ")} or presets: ${Object.keys(PRESETS).join(", ")}`
      );
    }
  }

  return scopes;
}

/**
 * Check if granted scopes include the required scope
 *
 * Supports wildcard matching:
 * - "admin:*" grants everything
 * - "vault:*" grants all vault:X scopes
 * - "plugins:*" grants all plugins:X scopes
 */
export function hasScope(granted: Scope[], required: Scope): boolean {
  // admin:* grants everything
  if (granted.includes(SCOPES.ADMIN)) {
    return true;
  }

  // Check exact match
  if (granted.includes(required)) {
    return true;
  }

  // Check wildcard match
  const [category] = required.split(":");
  const wildcard = `${category}:*` as Scope;
  if (granted.includes(wildcard)) {
    return true;
  }

  return false;
}

/**
 * Require a scope, throwing McpError if not granted
 */
export function requireScope(granted: Scope[], required: Scope): void {
  if (!hasScope(granted, required)) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Permission denied: operation requires scope '${required}'. ` +
        `Granted scopes: ${granted.join(", ") || "(none)"}. ` +
        `To enable this operation, set OBSIDIAN_MCP_SCOPES to include '${required}' or use a preset like 'full' or 'admin'.`
    );
  }
}

/**
 * Get current scopes from environment
 */
let cachedScopes: Scope[] | null = null;

export function getGrantedScopes(): Scope[] {
  if (cachedScopes === null) {
    cachedScopes = parseScopes(process.env.OBSIDIAN_MCP_SCOPES);
  }
  return cachedScopes;
}

/**
 * Check if current session has a scope
 */
export function currentSessionHasScope(required: Scope): boolean {
  return hasScope(getGrantedScopes(), required);
}

/**
 * Require a scope in current session
 */
export function requireScopeInSession(required: Scope): void {
  requireScope(getGrantedScopes(), required);
}

/**
 * Get human-readable description of current permissions
 */
export function describePermissions(): string {
  const scopes = getGrantedScopes();

  if (scopes.includes(SCOPES.ADMIN)) {
    return "Full admin access (all operations allowed)";
  }

  const capabilities: string[] = [];

  if (hasScope(scopes, SCOPES.VAULT_READ)) capabilities.push("read files");
  if (hasScope(scopes, SCOPES.VAULT_WRITE)) capabilities.push("write files");
  if (hasScope(scopes, SCOPES.VAULT_DELETE)) capabilities.push("delete files");
  if (hasScope(scopes, SCOPES.VAULT_MOVE)) capabilities.push("move/rename files");
  if (hasScope(scopes, SCOPES.VAULT_SEARCH)) capabilities.push("search vault");
  if (hasScope(scopes, SCOPES.VAULT_LIST)) capabilities.push("list files");
  if (hasScope(scopes, SCOPES.PLUGINS_READ)) capabilities.push("read plugin data");
  if (hasScope(scopes, SCOPES.PLUGINS_EXECUTE)) capabilities.push("execute plugins");

  return capabilities.length > 0
    ? `Allowed: ${capabilities.join(", ")}`
    : "No permissions granted";
}
