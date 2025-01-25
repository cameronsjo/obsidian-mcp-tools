import { Plugin, FileSystemAdapter } from "obsidian";

/**
 * Gets the file system adapter for the given plugin.
 *
 * @param plugin - The plugin to get the file system adapter for.
 * @returns The file system adapter, or `undefined` if not found.
 */
export function getFileSystemAdapter(
  plugin: Plugin,
): FileSystemAdapter | { error: string } {
  const adapter = plugin.app.vault.adapter;
  if (adapter instanceof FileSystemAdapter) {
    return adapter;
  }
  return { error: "Unsupported platform" };
}
