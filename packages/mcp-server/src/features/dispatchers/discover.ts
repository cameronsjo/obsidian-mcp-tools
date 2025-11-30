/**
 * Discover Tool
 *
 * Provides runtime discovery of available operations across all dispatchers.
 * This enables LLMs to learn what operations are available without needing
 * all tool schemas in context.
 */

import { getVaultCapabilities } from "./vault";
import { getActiveFileCapabilities } from "./active-file";
import { getPluginCapabilities } from "./plugin";
import type { CapabilityManifest, DispatcherCapabilities } from "./types";

export type DiscoverCategory = "vault" | "active_file" | "plugins" | "all";

/**
 * Build capability manifest for the specified category
 */
export async function buildCapabilityManifest(
  category?: DiscoverCategory,
): Promise<Partial<CapabilityManifest> | DispatcherCapabilities> {
  const cat = category || "all";

  if (cat === "vault") {
    return getVaultCapabilities();
  }

  if (cat === "active_file") {
    return getActiveFileCapabilities();
  }

  if (cat === "plugins") {
    return { plugins: await getPluginCapabilities() };
  }

  // Return all capabilities
  return {
    vault: getVaultCapabilities(),
    active_file: getActiveFileCapabilities(),
    plugins: await getPluginCapabilities(),
  };
}

/**
 * Get a formatted help string for a specific category or operation
 */
export async function getOperationHelp(
  category: string,
  operation?: string,
): Promise<string> {
  const capabilities = await buildCapabilityManifest(
    category as DiscoverCategory,
  );

  if (!capabilities) {
    return `Unknown category: ${category}. Use discover() with category "all" to see available categories.`;
  }

  // If specific operation requested, return detailed help
  if (operation && "operations" in capabilities) {
    const ops = capabilities.operations as Record<
      string,
      { description: string; parameters: Record<string, unknown> }
    >;
    const op = ops[operation];

    if (!op) {
      return `Unknown operation: ${operation}. Available operations: ${Object.keys(ops).join(", ")}`;
    }

    return [
      `## ${category}.${operation}`,
      "",
      op.description,
      "",
      "### Parameters",
      "",
      ...Object.entries(op.parameters).map(([name, def]) => {
        const paramDef = def as { type: string; description?: string; required?: boolean };
        const required = paramDef.required ? " (required)" : "";
        return `- **${name}**${required}: ${paramDef.type}${paramDef.description ? ` - ${paramDef.description}` : ""}`;
      }),
    ].join("\n");
  }

  return JSON.stringify(capabilities, null, 2);
}
